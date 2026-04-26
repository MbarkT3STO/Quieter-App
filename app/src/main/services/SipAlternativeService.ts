/**
 * SipAlternativeService — executes alternative commands for SIP-protected services.
 *
 * When a service has a `sipAlternative` defined, this service runs the alternative
 * disable/enable commands instead of launchctl. These alternatives achieve the same
 * user-visible effect (e.g., mdutil stops indexing, defaults toggles Bluetooth radio)
 * without needing to disable the daemon via launchctl, which SIP blocks.
 *
 * Also handles state-checking via the alternative's stateCheck fields.
 */

import { safeExec, safeExecOutput } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import type { Result, SipAlternative } from '../../shared/types.js';
import { ServiceState } from '../../shared/types.js';

const CONTEXT = 'SipAlternativeService';

export class SipAlternativeService {
  private static instance: SipAlternativeService;

  private constructor() {}

  /** Get the singleton instance */
  public static getInstance(): SipAlternativeService {
    if (SipAlternativeService.instance === undefined) {
      SipAlternativeService.instance = new SipAlternativeService();
    }
    return SipAlternativeService.instance;
  }

  /**
   * Execute the alternative disable command for a SIP-protected service.
   *
   * @param alt - The SipAlternative definition from the service registry
   * @param serviceId - The service ID for logging
   */
  public async disable(alt: SipAlternative, serviceId: string): Promise<Result<void>> {
    logger.info(CONTEXT, `Disabling via SIP alternative: ${serviceId}`, {
      mechanism: alt.mechanism,
      cmd: `${alt.disableCmd} ${alt.disableArgs.join(' ')}`,
    });

    const result = await safeExec(alt.disableCmd, alt.disableArgs, CONTEXT);

    if (!result.success) {
      logger.error(CONTEXT, `SIP alternative disable failed for ${serviceId}`, {
        error: result.error,
      });
      return {
        success: false,
        error: `SIP alternative disable failed: ${result.error}`,
        code: 'SIP_ALT_DISABLE_FAILED',
      };
    }

    logger.info(CONTEXT, `SIP alternative disable succeeded for ${serviceId}`);
    return { success: true, data: undefined };
  }

  /**
   * Execute the alternative enable command for a SIP-protected service.
   *
   * @param alt - The SipAlternative definition from the service registry
   * @param serviceId - The service ID for logging
   */
  public async enable(alt: SipAlternative, serviceId: string): Promise<Result<void>> {
    logger.info(CONTEXT, `Enabling via SIP alternative: ${serviceId}`, {
      mechanism: alt.mechanism,
      cmd: `${alt.enableCmd} ${alt.enableArgs.join(' ')}`,
    });

    const result = await safeExec(alt.enableCmd, alt.enableArgs, CONTEXT);

    if (!result.success) {
      logger.error(CONTEXT, `SIP alternative enable failed for ${serviceId}`, {
        error: result.error,
      });
      return {
        success: false,
        error: `SIP alternative enable failed: ${result.error}`,
        code: 'SIP_ALT_ENABLE_FAILED',
      };
    }

    logger.info(CONTEXT, `SIP alternative enable succeeded for ${serviceId}`);
    return { success: true, data: undefined };
  }

  /**
   * Check the current state of a SIP-protected service using its alternative state check.
   * Falls back to ServiceState.Unknown if no state check is defined.
   *
   * @param alt - The SipAlternative definition from the service registry
   * @param serviceId - The service ID for logging
   */
  public async getState(alt: SipAlternative, serviceId: string): Promise<Result<ServiceState>> {
    if (alt.stateCheckCmd === undefined || alt.stateCheckArgs === undefined) {
      // No state check available — fall back to unknown
      logger.debug(CONTEXT, `No state check for SIP alternative: ${serviceId}`);
      return { success: true, data: ServiceState.Unknown };
    }

    const result = await safeExecOutput(alt.stateCheckCmd, alt.stateCheckArgs, CONTEXT);

    if (!result.success) {
      // For defaults read, exit code 1 with "does not exist" means key not set = enabled (default)
      if (result.error.includes('does not exist') || result.code === '1') {
        logger.debug(CONTEXT, `State check key not set for ${serviceId}, assuming enabled`);
        return { success: true, data: ServiceState.Enabled };
      }
      logger.warn(CONTEXT, `State check failed for SIP alternative: ${serviceId}`, {
        error: result.error,
      });
      return { success: true, data: ServiceState.Unknown };
    }

    const output = result.data.trim();

    if (alt.stateCheckMode === 'outputContains' && alt.stateCheckDisabledValue !== undefined) {
      const isDisabled = output.includes(alt.stateCheckDisabledValue);
      logger.debug(CONTEXT, `State check for ${serviceId}`, {
        output: output.slice(0, 200),
        looking_for: alt.stateCheckDisabledValue,
        isDisabled,
      });
      return {
        success: true,
        data: isDisabled ? ServiceState.Disabled : ServiceState.Enabled,
      };
    }

    // Default: if command succeeded, consider it enabled
    return { success: true, data: ServiceState.Enabled };
  }
}
