/**
 * SipService — checks the status of System Integrity Protection (SIP).
 */

import { safeExecOutput } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import type { Result } from '../../shared/types.js';

const CONTEXT = 'SipService';

export class SipService {
  private static instance: SipService;
  private isSipActive: boolean | null = null;

  private constructor() {}

  public static getInstance(): SipService {
    if (SipService.instance === undefined) {
      SipService.instance = new SipService();
    }
    return SipService.instance;
  }

  /**
   * Check if SIP is active.
   * Returns true if SIP is enabled, false if disabled.
   */
  public async getSipStatus(): Promise<Result<boolean>> {
    // If we already checked, return cached result
    if (this.isSipActive !== null) {
      return { success: true, data: this.isSipActive };
    }

    const result = await safeExecOutput('/usr/bin/csrutil', ['status'], CONTEXT);

    if (!result.success) {
      // If csrutil fails, assume SIP is enabled (safest)
      logger.warn(CONTEXT, 'Failed to check SIP status, assuming enabled', { error: result.error });
      return { success: true, data: true };
    }

    const output = result.data.toLowerCase();
    const isActive = output.includes('enabled') && !output.includes('disabled');
    
    this.isSipActive = isActive;
    logger.info(CONTEXT, `SIP Status: ${isActive ? 'Enabled' : 'Disabled'}`);
    
    return { success: true, data: isActive };
  }
}
