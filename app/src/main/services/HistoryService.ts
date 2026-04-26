/**
 * HistoryService — rolling log of all applied service changes.
 * Stores up to MAX_HISTORY_ENTRIES entries in ~/.quieter/history.json.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { DATA_DIR_NAME, HISTORY_FILENAME } from '../../shared/constants.js';
import { logger } from '../utils/logger.js';
import type { HistoryEntry } from '../../shared/types.js';

const MAX_HISTORY_ENTRIES = 100;
const CONTEXT = 'HistoryService';

export class HistoryService {
  private static instance: HistoryService;
  private readonly historyPath: string;

  private constructor() {
    this.historyPath = path.join(os.homedir(), DATA_DIR_NAME, HISTORY_FILENAME);
  }

  public static getInstance(): HistoryService {
    if (HistoryService.instance === undefined) {
      HistoryService.instance = new HistoryService();
    }
    return HistoryService.instance;
  }

  /** Append a new entry to the history log (newest first). */
  public async append(entry: HistoryEntry): Promise<void> {
    const entries = this.readAll();
    entries.unshift(entry); // newest first
    const trimmed = entries.slice(0, MAX_HISTORY_ENTRIES);
    try {
      fs.writeFileSync(this.historyPath, JSON.stringify(trimmed, null, 2), 'utf-8');
    } catch (err) {
      logger.warn(CONTEXT, 'Failed to write history', { err });
    }
  }

  /** Read all history entries from disk. Returns empty array on error. */
  public readAll(): HistoryEntry[] {
    try {
      if (!fs.existsSync(this.historyPath)) return [];
      return JSON.parse(fs.readFileSync(this.historyPath, 'utf-8')) as HistoryEntry[];
    } catch {
      return [];
    }
  }

  /** Clear all history entries. */
  public clear(): void {
    try {
      fs.writeFileSync(this.historyPath, '[]', 'utf-8');
    } catch {
      // ignore
    }
  }
}
