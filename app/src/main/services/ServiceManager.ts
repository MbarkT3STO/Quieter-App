/**
 * ServiceManager — orchestrates all service operations.
 * Coordinates LaunchctlService, DefaultsService, SipAlternativeService, and the service registry.
 * Handles snapshot/backup, apply-with-rollback, state reading, intent tracking, and history.
 * SIP-protected services are routed through SipAlternativeService when they have a sipAlternative.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { BrowserWindow } from 'electron';
import { SERVICE_REGISTRY } from '../../shared/serviceRegistry.js';
import { LaunchctlService } from './LaunchctlService.js';
import { DefaultsService } from './DefaultsService.js';
import { SipAlternativeService } from './SipAlternativeService.js';
import { SipService } from './SipService.js';
import { SystemInfoService } from './SystemInfoService.js';
import { HistoryService } from './HistoryService.js';
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
  UserIntent,
} from '../../shared/types.js';
import {
  ServiceState,
  ChangeAction,
  ControlMethod,
} from '../../shared/types.js';
import {
  DATA_DIR_NAME,
  BACKUP_FILENAME,
  INTENT_FILENAME,
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
  private readonly sipAlt = SipAlternativeService.getInstance();
  private readonly sipStatus = SipService.getInstance();
  private readonly sysInfo = SystemInfoService.getInstance();
  private readonly dataDir: string;
  private readonly backupPath: string;
  private readonly intentPath: string;

  private constructor() {
    this.dataDir = path.join(os.homedir(), DATA_DIR_NAME);
    this.backupPath = path.join(this.dataDir, BACKUP_FILENAME);
    this.intentPath = path.join(this.dataDir, INTENT_FILENAME);
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
   * For SIP-protected services with a sipAlternative that has a state check,
   * uses the alternative state check instead of launchctl.
   */
  private async readServiceState(
    service: MacService,
    launchctlStates: Result<Map<string, ServiceState>>,
  ): Promise<ServiceState> {
    try {
      const sipActive = await this.sipStatus.getSipStatus();
      
      // If service has a SIP alternative with state checking, prefer it.
      // This gives accurate state for services where launchctl state might be unreliable.
      if (service.sipAlternative?.stateCheckCmd !== undefined) {
        const altState = await this.sipAlt.getState(service.sipAlternative, service.id);
        if (altState.success && altState.data !== ServiceState.Unknown) {
          return altState.data;
        }
      }

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
   * @param preloadedServices - Optional pre-loaded service states (avoids double-query)
   */
  public async applyChanges(
    changes: ServiceChange[],
    window: BrowserWindow,
    preloadedServices?: ServiceWithState[],
  ): Promise<Result<ApplyResult>> {
    logger.info(CONTEXT, `Applying ${changes.length} changes`);

    // Take a snapshot before applying (pass preloaded states to avoid double-query)
    const snapshotResult = await this.takeSnapshot(preloadedServices);
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

      // Append to history regardless of success/failure
      await HistoryService.getInstance().append({
        id: `${Date.now()}-${service.id}`,
        timestamp: new Date().toISOString(),
        action: change.action,
        serviceId: service.id,
        serviceName: service.name,
        success: result.success,
        ...(!result.success ? { error: result.error } : {}),
      });

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

    // Write intent after successful apply
    await this.writeIntent(applied);

    // Post-apply verification
    const mismatches = await this.verifyAppliedChanges(applied);
    if (mismatches.length > 0) {
      logger.warn(CONTEXT, `${mismatches.length} service(s) did not change state as expected`, {
        mismatches,
      });
    }

    return {
      success: true,
      data: {
        success: true,
        applied: applied.length,
        failed: 0,
        rolledBack: false,
        errors: [],
        verificationMismatches: mismatches,
      },
    };
  }

  /**
   * Apply a single service change.
   *
   * Routing priority:
   * 1. If service has a `sipAlternative`, use it (handles SIP-protected & auto-re-enabling services).
   * 2. Otherwise fall through to standard launchctl/defaults.
   *
   * For SIP services: the alternative is the ONLY path — launchctl will fail.
   * For non-SIP services with alternatives: try alternative first for robustness,
   * then also run launchctl/defaults for belt-and-suspenders coverage.
   */
  private async applyChange(service: MacService, action: ChangeAction): Promise<Result<void>> {
    const isDisable = action === ChangeAction.Disable;
    const sipActive = await this.sipStatus.getSipStatus();

    // ── SIP Alternative path ──────────────────────────────────────────────────
    // Only use alternatives if SIP is ACTIVE. If disabled, launchctl works fine.
    if (sipActive.success && sipActive.data === true && service.sipAlternative !== undefined) {
      const altResult = isDisable
        ? await this.sipAlt.disable(service.sipAlternative, service.id)
        : await this.sipAlt.enable(service.sipAlternative, service.id);

      if (!altResult.success) {
        logger.warn(CONTEXT, `SIP alternative failed for ${service.id}`, {
          error: altResult.error,
        });
        // If SIP-protected, we can't fall through — return the error
        if (service.requiresSip === true) {
          return altResult;
        }
        // For non-SIP services with alternatives, fall through to standard path
      } else if (service.requiresSip === true) {
        // SIP-protected service — alternative succeeded, skip standard path
        return altResult;
      }
      // Non-SIP with alternative: continue to also run standard path for coverage
    }

    // Guard: if SIP is active and this is a SIP-protected service with NO alternative,
    // we cannot proceed with the standard path as it will fail and cause UI resets.
    if (sipActive.success && sipActive.data === true && service.requiresSip === true && service.sipAlternative === undefined) {
      return {
        success: false,
        error: `Service "${service.name}" is protected by System Integrity Protection (SIP) and has no safe alternative command.`,
        code: 'SIP_LOCKED',
      };
    }

    // ── Standard launchctl path ────────────────────────────────────────────────
    if (
      service.controlMethod === ControlMethod.Launchctl ||
      service.controlMethod === ControlMethod.Hybrid
    ) {
      if (service.launchAgentId !== undefined) {
        const result = isDisable
          ? await this.launchctl.disableService(service.launchAgentId)
          : await this.launchctl.enableService(service.launchAgentId);

        if (!result.success && service.controlMethod === ControlMethod.Launchctl) {
          return result;
        }
      }
    }

    // ── Standard defaults path ─────────────────────────────────────────────────
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
   * Write the user's intent to intent.json after a successful apply.
   * Merges newly applied changes into any existing intent.
   */
  private async writeIntent(appliedChanges: ServiceChange[]): Promise<void> {
    // Load existing intent or start fresh
    let existing: Record<string, ServiceState> = {};
    try {
      if (fs.existsSync(this.intentPath)) {
        const raw = fs.readFileSync(this.intentPath, 'utf-8');
        const parsed = JSON.parse(raw) as UserIntent;
        existing = parsed.intendedStates;
      }
    } catch {
      // start fresh
    }

    // Merge the newly applied changes into intent
    for (const change of appliedChanges) {
      existing[change.serviceId] =
        change.action === ChangeAction.Disable
          ? ServiceState.Disabled
          : ServiceState.Enabled;
    }

    const intent: UserIntent = {
      updatedAt: new Date().toISOString(),
      intendedStates: existing,
    };

    try {
      fs.writeFileSync(this.intentPath, JSON.stringify(intent, null, 2), 'utf-8');
      logger.info(CONTEXT, `Intent written with ${Object.keys(existing).length} entries`);
    } catch (err) {
      logger.error(CONTEXT, 'Failed to write intent file', { err });
    }
  }

  /**
   * Verify that applied changes actually took effect.
   * Returns a list of mismatches (services that didn't change as expected).
   */
  private async verifyAppliedChanges(
    changes: ServiceChange[],
  ): Promise<NonNullable<ApplyResult['verificationMismatches']>> {
    const bundleIds = changes
      .map((c) => SERVICE_REGISTRY.find((s) => s.id === c.serviceId)?.launchAgentId)
      .filter((id): id is string => id !== undefined);

    if (bundleIds.length === 0) return [];

    // Small delay to let launchctl settle
    await new Promise<void>((resolve) => setTimeout(resolve, 800));

    const stateResult = await this.launchctl.getMultipleServiceStates(bundleIds);
    if (!stateResult.success) return [];

    const mismatches: NonNullable<ApplyResult['verificationMismatches']> = [];

    for (const change of changes) {
      const service = SERVICE_REGISTRY.find((s) => s.id === change.serviceId);
      if (service?.launchAgentId === undefined) continue;

      const actualState = stateResult.data.get(service.launchAgentId);
      const expectedState =
        change.action === ChangeAction.Disable ? ServiceState.Disabled : ServiceState.Enabled;

      if (actualState !== undefined && actualState !== expectedState) {
        mismatches.push({
          serviceId: service.id,
          serviceName: service.name,
          expectedState,
          actualState,
        });
      }
    }

    return mismatches;
  }

  /**
   * Take a snapshot of all current service states and write to backup.json.
   * Accepts optional pre-loaded states to avoid a redundant system query.
   */
  public async takeSnapshot(preloaded?: ServiceWithState[]): Promise<Result<void>> {
    // If preloaded states provided, use them. Otherwise query system.
    let services: ServiceWithState[];
    if (preloaded !== undefined) {
      services = preloaded;
    } else {
      const servicesResult = await this.getAllServicesWithState();
      if (!servicesResult.success) return servicesResult;
      services = servicesResult.data;
    }

    const snapshot: BackupSnapshot = {
      createdAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      states: services.map((s) => ({
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

  /**
   * Check if an intent file exists.
   */
  public hasIntent(): boolean {
    return fs.existsSync(this.intentPath);
  }

  /**
   * Enforce disabled states using intent.json as the source of truth.
   * Reads intent.json to determine which services should be disabled, then
   * re-disables any that macOS has re-enabled since the last run.
   * Designed to run silently at login (--hidden mode) with no BrowserWindow.
   */
  public async enforceDisabledStates(): Promise<void> {
    logger.info(CONTEXT, 'Enforcer: starting');

    if (!fs.existsSync(this.intentPath)) {
      logger.info(CONTEXT, 'Enforcer: no intent file found, nothing to enforce');
      return;
    }

    let intent: UserIntent;
    try {
      const raw = fs.readFileSync(this.intentPath, 'utf-8');
      intent = JSON.parse(raw) as UserIntent;
    } catch (err) {
      logger.error(CONTEXT, 'Enforcer: failed to read intent file', { err });
      return;
    }

    const shouldBeDisabled = Object.entries(intent.intendedStates)
      .filter(([, state]) => state === ServiceState.Disabled)
      .map(([serviceId]) => serviceId);

    if (shouldBeDisabled.length === 0) {
      logger.info(CONTEXT, 'Enforcer: no services marked for enforcement');
      return;
    }

    const liveResult = await this.getAllServicesWithState();
    if (!liveResult.success) {
      logger.error(CONTEXT, 'Enforcer: could not read live states', { error: liveResult.error });
      return;
    }

    const toDisable: ServiceChange[] = liveResult.data
      .filter(
        (s) =>
          shouldBeDisabled.includes(s.id) &&
          s.runtimeState.currentState === ServiceState.Enabled,
      )
      .map((s) => ({ serviceId: s.id, action: ChangeAction.Disable }));

    if (toDisable.length === 0) {
      logger.info(CONTEXT, 'Enforcer: all intended-disabled services are already disabled');
      return;
    }

    logger.info(CONTEXT, `Enforcer: re-disabling ${toDisable.length} services`);
    await this.applyChangesSilent(toDisable);
    logger.info(CONTEXT, 'Enforcer: done');
  }

  /**
   * Apply a batch of service changes without a BrowserWindow (silent mode).
   * Used by enforceDisabledStates when running headless at login.
   */
  private async applyChangesSilent(changes: ServiceChange[]): Promise<void> {
    for (const change of changes) {
      const service = SERVICE_REGISTRY.find((s) => s.id === change.serviceId);
      if (service === undefined) {
        logger.warn(CONTEXT, `Enforcer mode: unknown service ${change.serviceId}, skipping`);
        continue;
      }

      const result = await this.applyChange(service, change.action);

      // Append to history regardless of success/failure
      await HistoryService.getInstance().append({
        id: `${Date.now()}-${service.id}`,
        timestamp: new Date().toISOString(),
        action: change.action,
        serviceId: service.id,
        serviceName: service.name,
        success: result.success,
        ...(!result.success ? { error: result.error } : {}),
      });

      if (result.success) {
        logger.info(CONTEXT, `Enforcer mode: re-disabled ${service.id}`);
      } else {
        logger.error(CONTEXT, `Enforcer mode: failed to re-disable ${service.id}`, {
          error: result.error,
        });
      }
    }
  }
}
