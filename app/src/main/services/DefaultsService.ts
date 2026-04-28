/**
 * DefaultsService — wraps 'defaults write' / 'defaults read' commands.
 * Manages macOS user defaults (NSUserDefaults) for services controlled via preferences.
 */

import { safeExec, safeExecOutput, sudoExec } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import type { Result, DefaultsCommand } from '../../shared/types.js';
import { ServiceState } from '../../shared/types.js';

const DEFAULTS = '/usr/bin/defaults';
const CONTEXT = 'DefaultsService';

export class DefaultsService {
  private static instance: DefaultsService;

  private constructor() {}

  /** Get the singleton instance */
  public static getInstance(): DefaultsService {
    if (DefaultsService.instance === undefined) {
      DefaultsService.instance = new DefaultsService();
    }
    return DefaultsService.instance;
  }

  /**
   * Read the current value of a defaults key.
   *
   * @param domain - The defaults domain, e.g. "com.apple.CrashReporter"
   * @param key - The defaults key, e.g. "DialogType"
   */
  public async readValue(domain: string, key: string): Promise<Result<string>> {
    const result = await safeExecOutput(DEFAULTS, ['read', domain, key], CONTEXT);

    if (!result.success) {
      // Key not found is a normal state (means it's using the system default)
      if (result.error.includes('does not exist') || result.code === '1') {
        return { success: true, data: '' };
      }
      return result;
    }

    return { success: true, data: result.data.trim() };
  }

  /**
   * Write a value to a defaults key.
   *
   * @param domain - The defaults domain
   * @param key - The defaults key
   * @param type - The value type flag (string, bool, int, float)
   * @param value - The value to write
   * @param requiresAdmin - Whether to elevate via osascript (sudo prompt)
   */
  public async writeValue(
    domain: string,
    key: string,
    type: DefaultsCommand['type'],
    value: string,
    requiresAdmin = false,
  ): Promise<Result<void>> {
    logger.info(CONTEXT, `Writing defaults: ${domain} ${key} = ${value} (${type})`);

    // For bool type, convert '0'/'1' to 'false'/'true' (defaults CLI requirement)
    let actualValue = value;
    if (type === 'bool') {
      if (value === '0') actualValue = 'false';
      else if (value === '1') actualValue = 'true';
      // 'true', 'false', 'yes', 'no' pass through unchanged
    }

    const exec = requiresAdmin ? sudoExec : safeExec;
    const result = await exec(DEFAULTS, ['write', domain, key, `-${type}`, actualValue], CONTEXT);

    if (!result.success) {
      return {
        success: false,
        error: `Failed to write defaults ${domain} ${key}: ${result.error}`,
        ...(result.code !== undefined ? { code: result.code } : {}),
      };
    }

    return { success: true, data: undefined };
  }

  /**
   * Delete a defaults key (restores to system default).
   *
   * @param domain - The defaults domain
   * @param key - The defaults key to delete
   */
  public async deleteValue(domain: string, key: string): Promise<Result<void>> {
    logger.info(CONTEXT, `Deleting defaults key: ${domain} ${key}`);

    const result = await safeExec(DEFAULTS, ['delete', domain, key], CONTEXT);

    if (!result.success) {
      // Key not existing is fine
      if (result.error.includes('does not exist') || result.code === '1') {
        return { success: true, data: undefined };
      }
      return {
        success: false,
        error: `Failed to delete defaults ${domain} ${key}: ${result.error}`,
        ...(result.code !== undefined ? { code: result.code } : {}),
      };
    }

    return { success: true, data: undefined };
  }

  /**
   * Determine the current state of a service controlled via defaults.
   * Compares the current value against the disabledValue.
   *
   * @param cmd - The DefaultsCommand definition from the service registry
   */
  public async getServiceState(cmd: DefaultsCommand): Promise<Result<ServiceState>> {
    const result = await this.readValue(cmd.domain, cmd.key);

    if (!result.success) {
      return result;
    }

    const currentValue = result.data;

    // Empty means key doesn't exist — service is using default (enabled)
    if (currentValue === '') {
      return { success: true, data: ServiceState.Enabled };
    }

    // Compare against disabled value
    if (currentValue === cmd.disabledValue) {
      return { success: true, data: ServiceState.Disabled };
    }

    return { success: true, data: ServiceState.Enabled };
  }

  /**
   * Disable a service by writing its disabled value.
   *
   * @param cmd - The DefaultsCommand definition
   * @param requiresAdmin - Whether to elevate via osascript (sudo prompt)
   */
  public async disableService(cmd: DefaultsCommand, requiresAdmin = false): Promise<Result<void>> {
    return this.writeValue(cmd.domain, cmd.key, cmd.type, cmd.disabledValue, requiresAdmin);
  }

  /**
   * Enable a service by writing its enabled value (or deleting the key to restore default).
   *
   * @param cmd - The DefaultsCommand definition
   * @param requiresAdmin - Whether to elevate via osascript (sudo prompt)
   */
  public async enableService(cmd: DefaultsCommand, requiresAdmin = false): Promise<Result<void>> {
    // Write the explicit enabled value
    return this.writeValue(cmd.domain, cmd.key, cmd.type, cmd.enabledValue, requiresAdmin);
  }
}
