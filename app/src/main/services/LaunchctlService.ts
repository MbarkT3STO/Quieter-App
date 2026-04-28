/**
 * LaunchctlService — wraps launchctl CLI commands for managing launchd services.
 * Uses 'launchctl disable' + 'launchctl bootout' for persistent disable (survives reboots).
 * Uses 'launchctl enable' + 'launchctl bootstrap' for persistent enable.
 * Domain is derived from the plist path location, not from requiresAdmin.
 */

import fs from 'fs';
import os from 'os';
import { safeExec, safeExecOutput, sudoExec } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import type { Result } from '../../shared/types.js';
import { ServiceState } from '../../shared/types.js';

const LAUNCHCTL = '/bin/launchctl';
const CONTEXT = 'LaunchctlService';

interface PlistInfo {
  path: string;
  domain: string; // 'system' | 'gui/501'
}

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
   * Resolve the plist file path and domain for a given bundle ID.
   * Domain is derived from WHERE the plist lives on disk:
   *   /LaunchDaemons/ → domain = 'system'
   *   /LaunchAgents/  → domain = 'gui/{uid}'
   */
  private resolvePlist(bundleId: string): PlistInfo | null {
    const uid = process.getuid?.() ?? 501;
    const candidates: PlistInfo[] = [
      { path: `/System/Library/LaunchDaemons/${bundleId}.plist`, domain: 'system' },
      { path: `/Library/LaunchDaemons/${bundleId}.plist`,        domain: 'system' },
      { path: `/System/Library/LaunchAgents/${bundleId}.plist`,  domain: `gui/${uid}` },
      { path: `/Library/LaunchAgents/${bundleId}.plist`,         domain: `gui/${uid}` },
      { path: `${os.homedir()}/Library/LaunchAgents/${bundleId}.plist`, domain: `gui/${uid}` },
    ];

    for (const c of candidates) {
      if (fs.existsSync(c.path)) return c;
    }
    return null;
  }

  /**
   * Get the current state of a launchd service by its bundle ID.
   * Uses print-disabled for accurate persistent state detection.
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
   * Read the persistent disabled registry via 'launchctl print-disabled'.
   * Returns a map of bundleId → true (disabled) / false (enabled).
   */
  private async readPersistentDisabledMap(): Promise<Map<string, boolean>> {
    const uid = process.getuid?.() ?? 501;
    const result = new Map<string, boolean>();

    // Read user-domain disabled registry
    const guiResult = await safeExecOutput(LAUNCHCTL, ['print-disabled', `gui/${uid}`], CONTEXT);
    if (guiResult.success) this.parsePrintDisabled(guiResult.data, result);

    // Read system-domain disabled registry (may fail without root — that's OK)
    const sysResult = await safeExecOutput(LAUNCHCTL, ['print-disabled', 'system'], CONTEXT);
    if (sysResult.success) this.parsePrintDisabled(sysResult.data, result);

    return result;
  }

  /**
   * Parse 'launchctl print-disabled' output into a map.
   * Each line looks like:  "com.apple.gamed" => true
   */
  private parsePrintDisabled(output: string, map: Map<string, boolean>): void {
    const linePattern = /"([^"]+)"\s*=>\s*(true|false)/g;
    let match: RegExpExecArray | null;
    while ((match = linePattern.exec(output)) !== null) {
      const bundleId = match[1];
      const value = match[2];
      if (bundleId !== undefined && value !== undefined) {
        map.set(bundleId, value === 'true');
      }
    }
  }

  /**
   * Check multiple services at once using both print-disabled and launchctl list.
   * print-disabled gives accurate persistent state; list gives currently-running state.
   *
   * @param bundleIds - Array of bundle IDs to check
   * @returns Map of bundleId -> ServiceState
   */
  public async getMultipleServiceStates(
    bundleIds: string[],
  ): Promise<Result<Map<string, ServiceState>>> {
    // Source 1: persistent disabled registry (survives reboots)
    const disabledMap = await this.readPersistentDisabledMap();

    // Source 2: currently running services
    const listResult = await safeExecOutput(LAUNCHCTL, ['list'], CONTEXT);
    const runningOutput = listResult.success ? listResult.data : '';

    const stateMap = new Map<string, ServiceState>();

    for (const bundleId of bundleIds) {
      if (disabledMap.get(bundleId) === true) {
        stateMap.set(bundleId, ServiceState.Disabled);        // explicitly disabled
      } else if (runningOutput.includes(bundleId)) {
        stateMap.set(bundleId, ServiceState.Enabled);         // running right now
      } else {
        stateMap.set(bundleId, ServiceState.Enabled);         // not disabled, on-demand
      }
    }

    return { success: true, data: stateMap };
  }

  /**
   * Disable a launchd service persistently.
   *
   * Step 1 — persist (survives reboots):
   *   launchctl disable {domain}/{bundleId}
   *   Log result but do NOT return early if this fails — attempt Step 2 anyway.
   *
   * Step 2 — stop now (current session):
   *   launchctl bootout {domain}/{bundleId}
   *   Exit code 113 = "not loaded" = acceptable, treat as success.
   *   Any other non-zero exit = log warning but do NOT fail the whole operation
   *   because the disable in Step 1 already made it persistent.
   *
   * Returns success if Step 1 succeeded. Step 2 is best-effort.
   *
   * @param bundleId - The launchd bundle ID to disable
   * @param requiresAdmin - Whether to elevate via osascript (sudo prompt)
   */
  public async disableService(bundleId: string, requiresAdmin = false): Promise<Result<void>> {
    logger.info(CONTEXT, `Disabling service: ${bundleId}`);

    const uid = process.getuid?.() ?? 501;
    const plistInfo = this.resolvePlist(bundleId);
    const domain = plistInfo !== null ? plistInfo.domain : `gui/${uid}`;

    const exec = requiresAdmin ? sudoExec : safeExec;

    // Step 1 — persist: launchctl disable {domain}/{bundleId}
    const disableResult = await exec(
      LAUNCHCTL,
      ['disable', `${domain}/${bundleId}`],
      CONTEXT,
    );

    if (!disableResult.success) {
      logger.warn(CONTEXT, `disable step failed for ${bundleId}`, { error: disableResult.error });
    } else {
      logger.info(CONTEXT, `disable step succeeded for ${bundleId}`);
    }

    // Step 2 — stop now (best-effort): launchctl bootout {domain}/{bundleId}
    // Always safeExec — bootout is best-effort and doesn't need elevation
    const bootoutResult = await safeExec(
      LAUNCHCTL,
      ['bootout', `${domain}/${bundleId}`],
      CONTEXT,
      ['3', '113'], // Ignore 3 (No such process) and 113 (Not loaded)
    );

    if (!bootoutResult.success) {
      // Exit code 113 = "not loaded" = acceptable
      if (bootoutResult.code === '113' || bootoutResult.error.includes('No such process')) {
        logger.info(CONTEXT, `bootout: ${bundleId} was not loaded (acceptable)`);
      } else {
        logger.warn(CONTEXT, `bootout step failed for ${bundleId} (non-fatal, disable persisted)`, {
          error: bootoutResult.error,
        });
      }
    } else {
      logger.info(CONTEXT, `bootout step succeeded for ${bundleId}`);
    }

    // Return success if Step 1 succeeded; Step 2 is best-effort
    if (disableResult.success) {
      return { success: true, data: undefined };
    }

    return {
      success: false,
      error: `Failed to disable service ${bundleId}: ${disableResult.error}`,
      code: 'LAUNCHCTL_DISABLE_FAILED',
    };
  }

  /**
   * Enable a launchd service persistently.
   *
   * Step 1 — un-persist:
   *   launchctl enable {domain}/{bundleId}
   *
   * Step 2 — start now:
   *   Resolve plist path. If found: launchctl bootstrap {domain} {plistPath}
   *   If plist not found, skip Step 2 (service will load on next login).
   *
   * Returns success if Step 1 succeeded.
   *
   * @param bundleId - The launchd bundle ID to enable
   * @param requiresAdmin - Whether to elevate via osascript (sudo prompt)
   */
  public async enableService(bundleId: string, requiresAdmin = false): Promise<Result<void>> {
    logger.info(CONTEXT, `Enabling service: ${bundleId}`);

    const uid = process.getuid?.() ?? 501;
    const plistInfo = this.resolvePlist(bundleId);
    const domain = plistInfo !== null ? plistInfo.domain : `gui/${uid}`;

    const exec = requiresAdmin ? sudoExec : safeExec;

    // Step 1 — un-persist: launchctl enable {domain}/{bundleId}
    const enableResult = await exec(
      LAUNCHCTL,
      ['enable', `${domain}/${bundleId}`],
      CONTEXT,
    );

    if (!enableResult.success) {
      logger.warn(CONTEXT, `enable step failed for ${bundleId}`, { error: enableResult.error });
      return {
        success: false,
        error: `Failed to enable service ${bundleId}: ${enableResult.error}`,
        code: 'LAUNCHCTL_ENABLE_FAILED',
      };
    }

    logger.info(CONTEXT, `enable step succeeded for ${bundleId}`);

    // Step 2 — start now (best-effort): launchctl bootstrap {domain} {plistPath}
    // Always safeExec — bootstrap is best-effort and doesn't need elevation
    if (plistInfo !== null) {
      const bootstrapResult = await safeExec(
        LAUNCHCTL,
        ['bootstrap', domain, plistInfo.path],
        CONTEXT,
        ['5'], // Ignore exit 5 (I/O error = service already loaded in current session)
      );

      if (!bootstrapResult.success) {
        logger.warn(CONTEXT, `bootstrap step failed for ${bundleId} (non-fatal, enable persisted)`, {
          error: bootstrapResult.error,
        });
      } else {
        logger.info(CONTEXT, `bootstrap step succeeded for ${bundleId}`);
      }
    } else {
      logger.info(CONTEXT, `No plist found for ${bundleId} — service will load on next login`);
    }

    return { success: true, data: undefined };
  }
}
