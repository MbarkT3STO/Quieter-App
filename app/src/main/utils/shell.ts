/**
 * Safe shell execution wrapper.
 * - Sanitizes all inputs to prevent shell injection
 * - Times out after SHELL_TIMEOUT_MS
 * - Returns typed Result<T> — never throws
 * - Logs every command in structured format
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { SHELL_TIMEOUT_MS } from '../../shared/constants.js';
import type { Result } from '../../shared/types.js';
import { logger } from './logger.js';

/** Path to the defaults binary — used to suppress expected "key not found" errors */
const DEFAULTS_CMD = '/usr/bin/defaults';

const execFileAsync = promisify(execFile);

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Sanitize a single shell argument.
 * Rejects arguments containing shell metacharacters that could cause injection.
 */
function sanitizeArg(arg: string): Result<string> {
  // Allow alphanumeric, dots, hyphens, underscores, slashes, @, =, spaces (for defaults values)
  const SAFE_PATTERN = /^[a-zA-Z0-9._\-/@ =:,~]+$/;
  if (!SAFE_PATTERN.test(arg)) {
    return {
      success: false,
      error: `Unsafe shell argument rejected: "${arg}"`,
      code: 'SHELL_INJECTION',
    };
  }
  return { success: true, data: arg };
}

/**
 * Execute a command safely using execFile (not exec/shell).
 * Uses execFile to avoid shell interpretation entirely.
 *
 * @param command - The executable path (e.g. '/bin/launchctl')
 * @param args - Array of arguments (each sanitized individually)
 * @param context - Logging context label
 */
export async function safeExec(
  command: string,
  args: string[],
  context: string,
  ignoreExitCodes: string[] = [],
): Promise<Result<ShellResult>> {
  // Sanitize each argument
  for (const arg of args) {
    const sanitized = sanitizeArg(arg);
    if (!sanitized.success) {
      logger.error(context, sanitized.error, { command, args });
      return sanitized;
    }
  }

  const fullCmd = `${command} ${args.join(' ')}`;
  logger.debug(context, `Executing: ${fullCmd}`);

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: SHELL_TIMEOUT_MS,
      maxBuffer: 1024 * 1024, // 1 MB
    });

    const result: ShellResult = {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };

    logger.debug(context, `Command succeeded`, { stdout: result.stdout.slice(0, 200) });
    return { success: true, data: result };
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: string | number;
      killed?: boolean;
    };

    const exitCode = typeof error.code === 'number' ? error.code : 1;
    const stdout = (error.stdout ?? '').trim();
    const stderr = (error.stderr ?? '').trim();

    if (error.killed === true) {
      logger.error(context, `Command timed out after ${SHELL_TIMEOUT_MS}ms`, { command, args });
      return {
        success: false,
        error: `Command timed out: ${fullCmd}`,
        code: 'TIMEOUT',
      };
    }

    // 'defaults read' exits 1 when a key simply doesn't exist — that's normal,
    // not an error worth logging at ERROR level.
    const isExpectedMissing =
      command === DEFAULTS_CMD &&
      exitCode === 1 &&
      stderr.includes('does not exist');

    if (isExpectedMissing || ignoreExitCodes.includes(String(exitCode))) {
      logger.debug(context, `Command result (ignored exit code ${exitCode})`, { command, args });
    } else {
      logger.error(context, `Command failed (exit ${exitCode})`, {
        command,
        args,
        stderr,
        stdout,
      });
    }

    return {
      success: false,
      error: stderr.length > 0 ? stderr : `Command failed with exit code ${exitCode}`,
      code: String(exitCode),
    };
  }
}

/**
 * Execute a command and return stdout as a string.
 * Convenience wrapper around safeExec.
 */
export async function safeExecOutput(
  command: string,
  args: string[],
  context: string,
): Promise<Result<string>> {
  const result = await safeExec(command, args, context);
  if (!result.success) return result;
  return { success: true, data: result.data.stdout };
}

/**
 * Executes a command with administrator privileges via osascript.
 * This will trigger a macOS system password prompt.
 */
export async function sudoExec(
  command: string,
  args: string[],
  context: string,
): Promise<Result<ShellResult>> {
  // Build a POSIX-safe quoted command string for the inner shell
  const quotedParts = [command, ...args].map(
    (a) => "'" + a.replace(/'/g, "'\\''") + "'",
  );
  const fullCommand = quotedParts.join(' ');

  // Pass the script as a direct argument to osascript — no outer shell quoting needed
  const osaScript = `do shell script "${fullCommand.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" with administrator privileges`;

  logger.info(context, `Requesting sudo for: ${command}`, { args });

  return new Promise((resolve) => {
    // Use execFile so the osaScript string is passed as a raw argument,
    // completely bypassing shell quoting issues.
    execFile('/usr/bin/osascript', ['-e', osaScript], (error, stdout, stderr) => {
      const rawCode = error ? (error as NodeJS.ErrnoException).code : undefined;
      const exitCode = error ? (typeof rawCode === 'number' ? rawCode : 1) : 0;

      if (exitCode === 0) {
        resolve({ success: true, data: { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 } });
      } else {
        logger.error(context, `Sudo command failed (exit ${exitCode})`, { command, stderr });
        resolve({
          success: false,
          error: stderr || 'Sudo execution failed or was cancelled',
          code: String(exitCode),
        });
      }
    });
  });
}
