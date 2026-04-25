/**
 * ServiceManager — orchestrates all service operations.
 * Coordinates LaunchctlService, DefaultsService, and the service registry.
 * Handles snapshot/backup, apply-with-rollback, and state reading.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { BrowserWindow } from 'electron';
import { SERVICE_REGISTRY } from '../../shared/serviceRegistry.js';
import { LaunchctlService } from './LaunchctlService.js';
import { DefaultsService } from './DefaultsService.js';
import { SystemInfoService } from './SystemInfoService.js';
import { logger } from '../utils/logger.js';
import { IPC_CHANNELS } from '../ipc/channels.js';
import type {
  Result,
  MacService,
  ServiceWithState,
  ServiceRuntimeState,
  ServiceChange,
  ApplyProgress,
  ApplyResult,
} from '../../shared/types.js';
import {
  ServiceState,
  ChangeAction,
  ControlMethod,
} from '../../shared/types.js';
import {
  DATA_DIR_NAME,
  BACKUP_FILENAME,
  APP_VERSION,
} from '../../shared/constants.js';

const CONTEXT = 'ServiceManager';

interface BackupSnapshot {
  createdAt: string;
  appVersion: string;
  states: Array<{ serviceId: string; state: ServiceState }>;
}

export class ServiceManager {
  private static instance: ServiceManager;
  private readonly launchctl = LaunchctlService.getInstance();
  private readonly defaults = DefaultsService.getInstance();
  private readonly sysInfo = SystemInfoService.getInstance();
  private readonly dataDir: string;
  private readonly backupPath: string;

  private constructor() {
    this.dataDir = path.join(os.homedir(), DATA_DIR_NAME);
    this.backupPath = path.join(this.dataDir, BACKUP_FILENAME);
    fs.mkdirSync(this.dataDir, { recursive: true });
  }

  /** Get the singleton instance */
  public static getInstance(): ServiceManager {
    if (ServiceManager.instance === undefined) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Get all services with their current runtime states.
   * Reads actual system state — not cached.
   */
  public async getAllServicesWithState(): Promise<Result<ServiceWithState[]>> {
    logger.info(CONTEXT, 'Reading all service states from system');

    // Collect all launchctl bundle IDs for batch query
    const launchctlServices = SERVICE_REGISTRY.filter(
      (s) =>
        s.controlMethod === ControlMethod.Launchctl ||
        s.controlMethod === ControlMethod.Hybrid,
    );
    const bundleIds = launchctlServices
      .map((s) => s.launchAgentId)
      .filter((id): id is string => id !== undefined);

    // Batch read launchctl states
    const launchctlStates = await this.launchctl.getMultipleServiceStates(bundleIds);

    const results: ServiceWithState[] = [];
    const now = new Date().toISOString();

    for (const service of SERVICE_REGISTRY) {
      const state = await this.readServiceState(service, launchctlStates);
      const runtimeState: ServiceRuntimeState = {
        serviceId: service.id,
        currentState: state,
        lastChecked: now,
      };
      results.push({ ...service, runtimeState });
    }

    // Update service counts for system stats
    const active = results.filter((s) => s.runtimeState.currentState === ServiceState.Enabled).length;
    const disabled = results.filter((s) => s.runtimeState.currentState === ServiceState.Disabled).length;
    this.sysInfo.setServiceCounts(active, disabled);

    logger.info(CONTEXT, `Loaded ${results.length} services`, { active, disabled });
    return { success: true, data: results };
  }

  /**
   * Read the current state of a single service.
   */
  private async readServiceState(
    service: MacService,
    launchctlStates: Result<Map<string, ServiceState>>,
  ): Promise<ServiceState> {
    try {
      if (
        service.controlMethod === ControlMethod.Launchctl ||
        service.controlMethod === ControlMethod.Hybrid
      ) {
        if (service.launchAgentId !== undefined && launchctlStates.success) {
          return launchctlStates.data.get(service.launchAgentId) ?? ServiceState.Unknown;
        }
      }

      if (
        service.controlMethod === ControlMethod.Defaults ||
        service.controlMethod === ControlMethod.Hybrid
      ) {
        if (service.defaultsCommand !== undefined) {
          const result = await this.defaults.getServiceState(service.defaultsCommand);
          if (result.success) return result.data;
        }
      }

      return ServiceState.Unknown;
    } catch (err) {
      logger.warn(CONTEXT, `Failed to read state for ${service.id}`, { err });
      return ServiceState.Unknown;
    }
  }

  /**
   * Apply a batch of service changes with progress reporting and rollback on failure.
   *
   * @param changes - Array of service changes to apply
   * @param window - BrowserWindow to send progress events to
   */
  public async applyChanges(
    changes: ServiceChange[],
    window: BrowserWindow,
  ): Promise<Result<ApplyResult>> {
    logger.info(CONTEXT, `Applying ${changes.length} changes`);

    // Take a snapshot before applying
    const snapshotResult = await this.takeSnapshot();
    if (!snapshotResult.success) {
      logger.warn(CONTEXT, 'Failed to take snapshot before apply', { error: snapshotResult.error });
    }

    const applied: ServiceChange[] = [];
    const errors: string[] = [];

    const sendProgress = (progress: ApplyProgress): void => {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.APPLY_PROGRESS, progress);
      }
    };

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      if (change === undefined) continue;

      const service = SERVICE_REGISTRY.find((s) => s.id === change.serviceId);
      if (service === undefined) {
        errors.push(`Unknown service: ${change.serviceId}`);
        continue;
      }

      sendProgress({
        total: changes.length,
        completed: i,
        current: service.name,
        status: 'running',
      });

      const result = await this.applyChange(service, change.action);

      if (result.success) {
        applied.push(change);
        logger.info(CONTEXT, `Applied change: ${change.action} ${service.id}`);
      } else {
        errors.push(`${service.name}: ${result.error}`);
        logger.error(CONTEXT, `Failed to apply change`, {
          service: service.id,
          action: change.action,
          error: result.error,
        });

        // Rollback all applied changes
        sendProgress({
          total: changes.length,
          completed: i,
          current: service.name,
          status: 'rollingback',
          error: result.error,
        });

        const rollbackResult = await this.rollback(applied);
        if (!rollbackResult.success) {
          logger.error(CONTEXT, 'Rollback failed', { error: rollbackResult.error });
        }

        sendProgress({
          total: changes.length,
          completed: i,
          current: service.name,
          status: 'error',
          error: result.error,
        });

        return {
          success: true,
          data: {
            success: false,
            applied: applied.length,
            failed: errors.length,
            rolledBack: true,
            errors,
          },
        };
      }
    }

    sendProgress({
      total: changes.length,
      completed: changes.length,
      current: '',
      status: 'success',
    });

    return {
      success: true,
      data: {
        success: true,
        applied: applied.length,
        failed: 0,
        rolledBack: false,
        errors: [],
      },
    };
  }

  /**
   * Apply a single service change.
   */
  private async applyChange(service: MacService, action: ChangeAction): Promise<Result<void>> {
    const isDisable = action === ChangeAction.Disable;

    if (
      service.controlMethod === ControlMethod.Launchctl ||
      service.controlMethod === ControlMethod.Hybrid
    ) {
      if (service.launchAgentId !== undefined) {
        const result = isDisable
          ? await this.launchctl.disableService(service.launchAgentId, service.requiresAdmin)
          : await this.launchctl.enableService(service.launchAgentId, service.requiresAdmin);

        if (!result.success && service.controlMethod === ControlMethod.Launchctl) {
          return result;
        }
      }
    }

    if (
      service.controlMethod === ControlMethod.Defaults ||
      service.controlMethod === ControlMethod.Hybrid
    ) {
      if (service.defaultsCommand !== undefined) {
        const result = isDisable
          ? await this.defaults.disableService(service.defaultsCommand)
          : await this.defaults.enableService(service.defaultsCommand);

        if (!result.success) return result;
      }
    }

    return { success: true, data: undefined };
  }

  /**
   * Rollback a list of applied changes (reverse the actions).
   */
  private async rollback(applied: ServiceChange[]): Promise<Result<void>> {
    logger.info(CONTEXT, `Rolling back ${applied.length} changes`);

    for (const change of [...applied].reverse()) {
      const service = SERVICE_REGISTRY.find((s) => s.id === change.serviceId);
      if (service === undefined) continue;

      // Reverse the action
      const reverseAction =
        change.action === ChangeAction.Disable ? ChangeAction.Enable : ChangeAction.Disable;

      const result = await this.applyChange(service, reverseAction);
      if (!result.success) {
        logger.error(CONTEXT, `Rollback failed for ${service.id}`, { error: result.error });
      }
    }

    return { success: true, data: undefined };
  }

  /**
   * Take a snapshot of all current service states and write to backup.json.
   */
  public async takeSnapshot(): Promise<Result<void>> {
    const servicesResult = await this.getAllServicesWithState();
    if (!servicesResult.success) return servicesResult;

    const snapshot: BackupSnapshot = {
      createdAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      states: servicesResult.data.map((s) => ({
        serviceId: s.id,
        state: s.runtimeState.currentState,
      })),
    };

    try {
      fs.writeFileSync(this.backupPath, JSON.stringify(snapshot, null, 2), 'utf-8');
      logger.info(CONTEXT, `Snapshot written to ${this.backupPath}`);
      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        error: `Failed to write snapshot: ${String(err)}`,
        code: 'SNAPSHOT_WRITE_FAILED',
      };
    }
  }

  /**
   * Revert all services to the state recorded in the backup snapshot.
   */
  public async revertAll(window: BrowserWindow): Promise<Result<void>> {
    logger.info(CONTEXT, 'Reverting all changes from backup snapshot');

    let snapshot: BackupSnapshot;
    try {
      const raw = fs.readFileSync(this.backupPath, 'utf-8');
      snapshot = JSON.parse(raw) as BackupSnapshot;
    } catch (err) {
      return {
        success: false,
        error: `Failed to read backup snapshot: ${String(err)}`,
        code: 'SNAPSHOT_READ_FAILED',
      };
    }

    const changes: ServiceChange[] = snapshot.states.map((entry) => ({
      serviceId: entry.serviceId,
      action: entry.state === ServiceState.Enabled ? ChangeAction.Enable : ChangeAction.Disable,
    }));

    const result = await this.applyChanges(changes, window);
    if (!result.success) return { success: false, error: result.error ?? 'Revert failed' };

    return { success: true, data: undefined };
  }

  /**
   * Check if a backup snapshot exists.
   */
  public hasBackup(): boolean {
    return fs.existsSync(this.backupPath);
  }
}
