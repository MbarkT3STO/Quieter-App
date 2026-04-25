/**
 * DefaultsService — wraps 'defaults write' / 'defaults read' commands.
 * Manages macOS user defaults (NSUserDefaults) for services controlled via preferences.
 */

import { safeExec, safeExecOutput } from '../utils/shell.js';
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
   */
  public async writeValue(
    domain: string,
    key: string,
    type: DefaultsCommand['type'],
    value: string,
  ): Promise<Result<void>> {
    logger.info(CONTEXT, `Writing defaults: ${domain} ${key} = ${value} (${type})`);

    const result = await safeExec(DEFAULTS, ['write', domain, key, `-${type}`, value], CONTEXT);

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
   */
  public async disableService(cmd: DefaultsCommand): Promise<Result<void>> {
    return this.writeValue(cmd.domain, cmd.key, cmd.type, cmd.disabledValue);
  }

  /**
   * Enable a service by writing its enabled value (or deleting the key to restore default).
   *
   * @param cmd - The DefaultsCommand definition
   */
  public async enableService(cmd: DefaultsCommand): Promise<Result<void>> {
    // Write the explicit enabled value
    return this.writeValue(cmd.domain, cmd.key, cmd.type, cmd.enabledValue);
  }
}
