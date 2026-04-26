/**
 * LaunchctlService — wraps launchctl CLI commands for managing launchd services.
 * Uses 'launchctl bootout' / 'launchctl bootstrap' for macOS 10.11+ (El Capitan+).
 * Falls back to 'launchctl unload' / 'launchctl load' for compatibility.
 */

import fs from 'fs';
import os from 'os';
import { safeExec, safeExecOutput } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import type { Result } from '../../shared/types.js';
import { ServiceState } from '../../shared/types.js';

const LAUNCHCTL = '/bin/launchctl';
const CONTEXT = 'LaunchctlService';

export class LaunchctlService {
  private static instance: LaunchctlService;

  private constructor() {}

  /** Get the singleton instance */
  public static getInstance(): LaunchctlService {
    if (LaunchctlService.instance === undefined) {
      LaunchctlService.instance = new LaunchctlService();
    }
    return LaunchctlService.instance;
  }

  /**
   * Get the current state of a launchd service by its bundle ID.
   * Parses 'launchctl list' output to determine if the service is running.
   *
   * @param bundleId - e.g. "com.apple.metadata.mds"
   */
  public async getServiceState(bundleId: string): Promise<Result<ServiceState>> {
    const result = await safeExecOutput(LAUNCHCTL, ['list', bundleId], CONTEXT);

    if (!result.success) {
      // Exit code 113 means service not found / not loaded
      if (result.code === '113' || result.error.includes('Could not find service')) {
        return { success: true, data: ServiceState.Disabled };
      }
      // Other errors — return unknown
      logger.warn(CONTEXT, `Could not determine state for ${bundleId}`, { error: result.error });
      return { success: true, data: ServiceState.Unknown };
    }

    // If launchctl list returns output, the service is loaded/running
    return { success: true, data: ServiceState.Enabled };
  }

  /**
   * Check multiple services at once by parsing 'launchctl list' output.
   * More efficient than calling getServiceState for each service individually.
   *
   * @param bundleIds - Array of bundle IDs to check
   * @returns Map of bundleId -> ServiceState
   */
  public async getMultipleServiceStates(
    bundleIds: string[],
  ): Promise<Result<Map<string, ServiceState>>> {
    const result = await safeExecOutput(LAUNCHCTL, ['list'], CONTEXT);

    if (!result.success) {
      return result;
    }

    const output = result.data;
    const stateMap = new Map<string, ServiceState>();

    for (const bundleId of bundleIds) {
      const isRunning = output.includes(bundleId);
      stateMap.set(bundleId, isRunning ? ServiceState.Enabled : ServiceState.Disabled);
    }

    return { success: true, data: stateMap };
  }

  /**
   * Disable (unload) a launchd service.
   * Uses 'launchctl bootout' for macOS 10.11+ or falls back to 'launchctl unload'.
   *
   * @param bundleId - The launchd bundle ID to disable
   * @param requiresAdmin - Whether this service requires elevated privileges
   */
  public async disableService(bundleId: string, requiresAdmin: boolean): Promise<Result<void>> {
    logger.info(CONTEXT, `Disabling service: ${bundleId}`, { requiresAdmin });

    // Try bootout first (macOS 10.11+)
    const uid = process.getuid !== undefined ? process.getuid() : 501;
    const domain = requiresAdmin ? 'system' : `gui/${uid}`;

    const bootoutResult = await safeExec(
      LAUNCHCTL,
      ['bootout', `${domain}/${bundleId}`],
      CONTEXT,
    );

    if (bootoutResult.success) {
      logger.info(CONTEXT, `Successfully disabled ${bundleId} via bootout`);
      return { success: true, data: undefined };
    }

    // Fall back to unload
    const plistPath = this.resolvePlistPath(bundleId, requiresAdmin);
    if (plistPath !== null) {
      const unloadResult = await safeExec(LAUNCHCTL, ['unload', '-w', plistPath], CONTEXT);
      if (unloadResult.success) {
        logger.info(CONTEXT, `Successfully disabled ${bundleId} via unload`);
        return { success: true, data: undefined };
      }
    }

    // Try disable subcommand as last resort
    const disableResult = await safeExec(LAUNCHCTL, ['disable', `${domain}/${bundleId}`], CONTEXT);
    if (disableResult.success) {
      logger.info(CONTEXT, `Successfully disabled ${bundleId} via disable`);
      return { success: true, data: undefined };
    }

    return {
      success: false,
      error: `Failed to disable service ${bundleId}: ${bootoutResult.error}`,
      code: 'LAUNCHCTL_DISABLE_FAILED',
    };
  }

  /**
   * Enable (load) a launchd service.
   * Uses 'launchctl bootstrap' for macOS 10.11+ or falls back to 'launchctl load'.
   *
   * @param bundleId - The launchd bundle ID to enable
   * @param requiresAdmin - Whether this service requires elevated privileges
   */
  public async enableService(bundleId: string, requiresAdmin: boolean): Promise<Result<void>> {
    logger.info(CONTEXT, `Enabling service: ${bundleId}`, { requiresAdmin });

    const uid = process.getuid !== undefined ? process.getuid() : 501;
    const domain = requiresAdmin ? 'system' : `gui/${uid}`;

    // Try enable + bootstrap
    const enableResult = await safeExec(
      LAUNCHCTL,
      ['enable', `${domain}/${bundleId}`],
      CONTEXT,
    );

    if (enableResult.success) {
      const plistPath = this.resolvePlistPath(bundleId, requiresAdmin);
      if (plistPath !== null) {
        const bootstrapResult = await safeExec(
          LAUNCHCTL,
          ['bootstrap', domain, plistPath],
          CONTEXT,
        );
        if (bootstrapResult.success) {
          logger.info(CONTEXT, `Successfully enabled ${bundleId} via bootstrap`);
          return { success: true, data: undefined };
        }
      }
    }

    // Fall back to load
    const plistPath = this.resolvePlistPath(bundleId, requiresAdmin);
    if (plistPath !== null) {
      const loadResult = await safeExec(LAUNCHCTL, ['load', '-w', plistPath], CONTEXT);
      if (loadResult.success) {
        logger.info(CONTEXT, `Successfully enabled ${bundleId} via load`);
        return { success: true, data: undefined };
      }
    }

    return {
      success: false,
      error: `Failed to enable service ${bundleId}`,
      code: 'LAUNCHCTL_ENABLE_FAILED',
    };
  }

  /**
   * Resolve the plist file path for a given bundle ID.
   * Checks standard launchd plist locations.
   */
  private resolvePlistPath(bundleId: string, requiresAdmin: boolean): string | null {
    const systemPaths = [
      `/System/Library/LaunchDaemons/${bundleId}.plist`,
      `/Library/LaunchDaemons/${bundleId}.plist`,
    ];
    const userPaths = [
      `/System/Library/LaunchAgents/${bundleId}.plist`,
      `/Library/LaunchAgents/${bundleId}.plist`,
      `${os.homedir()}/Library/LaunchAgents/${bundleId}.plist`,
    ];

    const paths = requiresAdmin ? [...systemPaths, ...userPaths] : [...userPaths, ...systemPaths];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }
}
