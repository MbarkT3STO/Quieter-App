/**
 * Structured logger — writes to both console and ~/.quieter/logs/app.log.
 * Singleton pattern. Rotates log file when it exceeds MAX_LOG_SIZE_BYTES.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { MAX_LOG_SIZE_BYTES, DATA_DIR_NAME, LOG_DIR_NAME, LOG_FILENAME } from '../../shared/constants.js';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
}

class Logger {
  private static instance: Logger;
  private logFilePath: string;
  private logStream: fs.WriteStream | null = null;

  private constructor() {
    const logDir = path.join(os.homedir(), DATA_DIR_NAME, LOG_DIR_NAME);
    fs.mkdirSync(logDir, { recursive: true });
    this.logFilePath = path.join(logDir, LOG_FILENAME);
    this.openStream();
  }

  /** Get the singleton Logger instance */
  public static getInstance(): Logger {
    if (Logger.instance === undefined) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private openStream(): void {
    try {
      this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
      this.logStream.on('error', (err) => {
        console.error('[Logger] Stream error:', err);
      });
    } catch (err) {
      console.error('[Logger] Failed to open log stream:', err);
    }
  }

  private rotateIfNeeded(): void {
    try {
      const stat = fs.statSync(this.logFilePath);
      if (stat.size > MAX_LOG_SIZE_BYTES) {
        this.logStream?.end();
        const rotated = this.logFilePath.replace('.log', `.${Date.now()}.log`);
        fs.renameSync(this.logFilePath, rotated);
        this.openStream();
      }
    } catch {
      // File may not exist yet — that's fine
    }
  }

  private write(entry: LogEntry): void {
    this.rotateIfNeeded();
    const line = JSON.stringify(entry) + '\n';
    this.logStream?.write(line);

    const prefix = `[${entry.timestamp}] [${entry.level}] [${entry.context}]`;
    const msg = entry.data !== undefined
      ? `${prefix} ${entry.message} ${JSON.stringify(entry.data)}`
      : `${prefix} ${entry.message}`;

    if (entry.level === 'ERROR' || entry.level === 'WARN') {
      console.error(msg);
    } else {
      console.log(msg);
    }
  }

  private log(level: LogLevel, context: string, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...(data !== undefined ? { data } : {}),
    };
    this.write(entry);
  }

  /** Log a debug message */
  public debug(context: string, message: string, data?: unknown): void {
    this.log('DEBUG', context, message, data);
  }

  /** Log an info message */
  public info(context: string, message: string, data?: unknown): void {
    this.log('INFO', context, message, data);
  }

  /** Log a warning */
  public warn(context: string, message: string, data?: unknown): void {
    this.log('WARN', context, message, data);
  }

  /** Log an error */
  public error(context: string, message: string, data?: unknown): void {
    this.log('ERROR', context, message, data);
  }

  /** Close the log stream gracefully */
  public close(): void {
    this.logStream?.end();
  }
}

export const logger = Logger.getInstance();
