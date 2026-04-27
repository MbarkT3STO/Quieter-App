import { TWEAK_REGISTRY } from '../../shared/tweakRegistry.js';
import { SystemTweak, TweakWithState, Result } from '../../shared/types.js';
import { safeExec, safeExecOutput, sudoExec } from '../utils/shell.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'TweakManager';

export class TweakManager {
  private static instance: TweakManager;

  private constructor() {}

  public static getInstance(): TweakManager {
    if (TweakManager.instance === undefined) {
      TweakManager.instance = new TweakManager();
    }
    return TweakManager.instance;
  }

  /**
   * Get all tweaks with their current applied state.
   */
  public async getAllTweaksWithState(): Promise<Result<TweakWithState[]>> {
    const results: TweakWithState[] = [];

    for (const tweak of TWEAK_REGISTRY) {
      if (!tweak.stateCmd) {
        // One-off actions are never "applied" in a persistent way
        results.push({ ...tweak, isApplied: false });
        continue;
      }

      const check = await safeExecOutput(tweak.stateCmd, tweak.stateArgs, CONTEXT);
      // Normalize whitespace for more robust matching (especially for pmset output)
      const normalizedOutput = check.success ? check.data.replace(/\s+/g, ' ').trim() : '';
      const isApplied = check.success && normalizedOutput.includes(tweak.appliedValue);
      
      results.push({ ...tweak, isApplied });
    }

    return { success: true, data: results };
  }

  /**
   * Apply or revert a tweak.
   */
  public async applyTweak(tweakId: string, shouldApply: boolean): Promise<Result<void>> {
    const tweak = TWEAK_REGISTRY.find(t => t.id === tweakId);
    if (!tweak) return { success: false, error: 'Tweak not found', code: 'TWEAK_NOT_FOUND' };

    const cmd = shouldApply ? tweak.applyCmd : tweak.revertCmd;
    const args = shouldApply ? tweak.applyArgs : tweak.revertArgs;

    if (!cmd) return { success: false, error: 'No command for this action', code: 'NO_COMMAND' };

    logger.info(CONTEXT, `${shouldApply ? 'Applying' : 'Reverting'} tweak: ${tweak.id}`);
    
    let result: Result<any>;
    if (tweak.requiresAdmin) {
      // Use sudoExec which prompts for password via osascript
      result = await sudoExec(cmd, args, CONTEXT);
    } else {
      result = await safeExec(cmd, args, CONTEXT);
    }

    if (!result.success) return result;

    // Relaunch process if needed
    if (tweak.relaunchProcess) {
      await safeExec('/usr/bin/killall', [tweak.relaunchProcess], CONTEXT);
    }

    return { success: true, data: undefined };
  }

  /**
   * Run a one-off action (like RAM purge).
   */
  public async runAction(tweakId: string): Promise<Result<string>> {
    const tweak = TWEAK_REGISTRY.find(t => t.id === tweakId);
    if (!tweak) return { success: false, error: 'Action not found' };

    logger.info(CONTEXT, `Running action: ${tweak.id}`);
    
    let result: Result<any>;
    if (tweak.requiresAdmin) {
      result = await sudoExec(tweak.applyCmd, tweak.applyArgs, CONTEXT);
    } else {
      result = await safeExecOutput(tweak.applyCmd, tweak.applyArgs, CONTEXT);
    }

    if (!result.success) return result;

    return { success: true, data: result.data?.stdout || '' };
  }
}
