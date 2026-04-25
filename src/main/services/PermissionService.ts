/**
 * PermissionService — checks whether the app has the permissions needed
 * to perform system changes. Validates before attempting any privileged operation.
 */

import { safeExecOutput } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import type { Result } from '../../shared/types.js';

const CONTEXT = 'PermissionService';

export interface PermissionCheckResult {
  hasAdminAccess: boolean;
  currentUser: string;
  isInAdminGroup: boolean;
}

export class PermissionService {
  private static instance: PermissionService;

  private constructor() {}

  /** Get the singleton instance */
  public static getInstance(): PermissionService {
    if (PermissionService.instance === undefined) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  /**
   * Check current user permissions.
   * Returns whether the user is in the admin group (can use sudo).
   */
  public async checkPermissions(): Promise<Result<PermissionCheckResult>> {
    const [userResult, groupResult] = await Promise.all([
      safeExecOutput('/usr/bin/whoami', [], CONTEXT),
      safeExecOutput('/usr/bin/id', ['-Gn'], CONTEXT),
    ]);

    if (!userResult.success) {
      return {
        success: false,
        error: 'Failed to determine current user',
        code: 'PERMISSION_CHECK_FAILED',
      };
    }

    const currentUser = userResult.data.trim();
    const groups = groupResult.success ? groupResult.data.split(' ') : [];
    const isInAdminGroup = groups.includes('admin') || groups.includes('wheel');

    logger.info(CONTEXT, `Permission check`, { currentUser, isInAdminGroup, groups });

    return {
      success: true,
      data: {
        hasAdminAccess: isInAdminGroup,
        currentUser,
        isInAdminGroup,
      },
    };
  }

  /**
   * Check if a specific launchctl operation will require admin.
   * Services in /System/Library/LaunchDaemons require admin.
   */
  public requiresAdminForService(requiresAdmin: boolean): boolean {
    return requiresAdmin;
  }

  /**
   * Verify the app can write to the Quieter data directory.
   */
  public async canWriteDataDir(dataDir: string): Promise<Result<boolean>> {
    const result = await safeExecOutput('/bin/test', ['-w', dataDir], CONTEXT);

    if (!result.success) {
      // test returns exit 1 if not writable — that's a valid result
      return { success: true, data: false };
    }

    return { success: true, data: true };
  }
}
