/**
 * IPC handlers — all ipcMain.handle() registrations.
 * Every handler is wrapped in try/catch and returns a typed Result.
 */

import { ipcMain, BrowserWindow, app } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { IPC_CHANNELS } from './channels.js';
import { ServiceManager } from '../services/ServiceManager.js';
import { SystemInfoService } from '../services/SystemInfoService.js';
import { logger } from '../utils/logger.js';
import type { Result, ServiceChange, AppSettings, SystemReport } from '../../shared/types.js';
import {
  DATA_DIR_NAME,
  SETTINGS_FILENAME,
  FIRST_LAUNCH_FILENAME,
  DEFAULT_SETTINGS,
  APP_VERSION,
} from '../../shared/constants.js';

const CONTEXT = 'IpcHandlers';

/**
 * Register all IPC handlers. Call once during app initialization.
 *
 * @param getWindow - Function that returns the current BrowserWindow
 */
export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  const serviceManager = ServiceManager.getInstance();
  const sysInfo = SystemInfoService.getInstance();
  const dataDir = path.join(os.homedir(), DATA_DIR_NAME);
  const settingsPath = path.join(dataDir, SETTINGS_FILENAME);
  const firstLaunchPath = path.join(dataDir, FIRST_LAUNCH_FILENAME);

  // ─── getServices ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.GET_SERVICES, async (): Promise<Result<unknown>> => {
    try {
      return await serviceManager.getAllServicesWithState();
    } catch (err) {
      logger.error(CONTEXT, 'getServices failed', { err });
      return { success: false, error: 'Failed to load services', code: 'GET_SERVICES_FAILED' };
    }
  });

  // ─── getSystemStats ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.GET_SYSTEM_STATS, async (): Promise<Result<unknown>> => {
    try {
      return await sysInfo.getStats();
    } catch (err) {
      logger.error(CONTEXT, 'getSystemStats failed', { err });
      return { success: false, error: 'Failed to get system stats', code: 'STATS_FAILED' };
    }
  });

  // ─── applyChanges ────────────────────────────────────────────────────────────
  ipcMain.handle(
    IPC_CHANNELS.APPLY_CHANGES,
    async (_event, changes: ServiceChange[]): Promise<Result<unknown>> => {
      try {
        const window = getWindow();
        if (window === null) {
          return { success: false, error: 'No active window', code: 'NO_WINDOW' };
        }
        return await serviceManager.applyChanges(changes, window);
      } catch (err) {
        logger.error(CONTEXT, 'applyChanges failed', { err });
        return { success: false, error: 'Failed to apply changes', code: 'APPLY_FAILED' };
      }
    },
  );

  // ─── revertAll ───────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.REVERT_ALL, async (): Promise<Result<unknown>> => {
    try {
      const window = getWindow();
      if (window === null) {
        return { success: false, error: 'No active window', code: 'NO_WINDOW' };
      }
      return await serviceManager.revertAll(window);
    } catch (err) {
      logger.error(CONTEXT, 'revertAll failed', { err });
      return { success: false, error: 'Failed to revert changes', code: 'REVERT_FAILED' };
    }
  });

  // ─── exportReport ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.EXPORT_REPORT, async (): Promise<Result<unknown>> => {
    try {
      const [servicesResult, statsResult] = await Promise.all([
        serviceManager.getAllServicesWithState(),
        sysInfo.getStats(),
      ]);

      const settings = loadSettings(settingsPath);

      const report: SystemReport = {
        generatedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        macosVersion: process.getSystemVersion(),
        systemStats: statsResult.success
          ? statsResult.data
          : {
              cpuUsagePercent: 0,
              ramUsedGB: 0,
              ramTotalGB: 0,
              ramUsedPercent: 0,
              activeServicesCount: 0,
              disabledServicesCount: 0,
              timestamp: new Date().toISOString(),
            },
        services: servicesResult.success ? servicesResult.data : [],
        settings,
      };

      return { success: true, data: JSON.stringify(report, null, 2) };
    } catch (err) {
      logger.error(CONTEXT, 'exportReport failed', { err });
      return { success: false, error: 'Failed to export report', code: 'EXPORT_FAILED' };
    }
  });

  // ─── hasBackup ───────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.HAS_BACKUP, (): Result<unknown> => {
    try {
      return { success: true, data: serviceManager.hasBackup() };
    } catch (err) {
      logger.error(CONTEXT, 'hasBackup failed', { err });
      return { success: false, error: 'Failed to check backup', code: 'BACKUP_CHECK_FAILED' };
    }
  });

  // ─── isFirstLaunch ───────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.IS_FIRST_LAUNCH, (): Result<unknown> => {
    try {
      const isDone = fs.existsSync(firstLaunchPath);
      return { success: true, data: !isDone };
    } catch (err) {
      logger.error(CONTEXT, 'isFirstLaunch failed', { err });
      return { success: false, error: 'Failed to check first launch', code: 'FIRST_LAUNCH_FAILED' };
    }
  });

  // ─── markFirstLaunchDone ─────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.MARK_FIRST_LAUNCH_DONE, (): Result<unknown> => {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(firstLaunchPath, new Date().toISOString(), 'utf-8');
      return { success: true, data: undefined };
    } catch (err) {
      logger.error(CONTEXT, 'markFirstLaunchDone failed', { err });
      return { success: false, error: 'Failed to mark first launch', code: 'MARK_LAUNCH_FAILED' };
    }
  });

  // ─── getSettings ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, (): Result<unknown> => {
    try {
      return { success: true, data: loadSettings(settingsPath) };
    } catch (err) {
      logger.error(CONTEXT, 'getSettings failed', { err });
      return { success: false, error: 'Failed to load settings', code: 'SETTINGS_LOAD_FAILED' };
    }
  });

  // ─── saveSettings ────────────────────────────────────────────────────────────
  ipcMain.handle(
    IPC_CHANNELS.SAVE_SETTINGS,
    (_event, settings: AppSettings): Result<unknown> => {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

        // Handle launch at login
        app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });

        logger.info(CONTEXT, 'Settings saved', { settings });
        return { success: true, data: undefined };
      } catch (err) {
        logger.error(CONTEXT, 'saveSettings failed', { err });
        return { success: false, error: 'Failed to save settings', code: 'SETTINGS_SAVE_FAILED' };
      }
    },
  );

  logger.info(CONTEXT, 'All IPC handlers registered');
}

/** Load settings from disk, falling back to defaults */
function loadSettings(settingsPath: string): AppSettings {
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(raw) as AppSettings;
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_SETTINGS };
}
