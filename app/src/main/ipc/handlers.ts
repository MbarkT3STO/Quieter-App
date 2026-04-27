/**
 * IPC handlers — all ipcMain.handle() registrations.
 * Every handler is wrapped in try/catch and returns a typed Result.
 */

import { ipcMain, BrowserWindow, app, nativeTheme } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { IPC_CHANNELS } from './channels.js';
import { ServiceManager } from '../services/ServiceManager.js';
import { SystemInfoService } from '../services/SystemInfoService.js';
import { HistoryService } from '../services/HistoryService.js';
import { SipService } from '../services/SipService.js';
import { TweakManager } from '../services/TweakManager.js';
import { logger } from '../utils/logger.js';
import type { Result, ServiceChange, AppSettings, SystemReport } from '../../shared/types.js';
import { CpuMethod } from '../../shared/types.js';
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
  const tweakManager = TweakManager.getInstance();

  // Apply saved CPU method immediately on startup
  const savedSettings = loadSettings(settingsPath);
  sysInfo.setCpuMethod(savedSettings.cpuMethod ?? CpuMethod.LoadAvg);
  const sipService = SipService.getInstance();

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

        // Apply CPU method change immediately — no restart needed
        sysInfo.setCpuMethod(settings.cpuMethod ?? CpuMethod.LoadAvg);

        // Sync nativeTheme so prefers-color-scheme in renderer is accurate
        nativeTheme.themeSource = settings.theme === 'system' ? 'system' : settings.theme;

        logger.info(CONTEXT, 'Settings saved', { settings });
        return { success: true, data: undefined };
      } catch (err) {
        logger.error(CONTEXT, 'saveSettings failed', { err });
        return { success: false, error: 'Failed to save settings', code: 'SETTINGS_SAVE_FAILED' };
      }
    },
  );

  // ─── setEnforcerMode ─────────────────────────────────────────────────────────
  ipcMain.handle(
    IPC_CHANNELS.SET_ENFORCER_MODE,
    (_event, enabled: boolean): Result<unknown> => {
      try {
        if (enabled) {
          // Launch at login with --hidden so the app runs silently to re-disable services
          app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
          logger.info(CONTEXT, 'Persistent Enforcer enabled (launch at login with --hidden)');
        } else {
          // Remove the login item entirely (or keep it without --hidden if launchAtLogin is on)
          const settings = loadSettings(settingsPath);
          if (settings.launchAtLogin) {
            // Keep launch at login but without the --hidden flag
            app.setLoginItemSettings({ openAtLogin: true, args: [] });
          } else {
            app.setLoginItemSettings({ openAtLogin: false });
          }
          logger.info(CONTEXT, 'Persistent Enforcer disabled');
        }
        return { success: true, data: undefined };
      } catch (err) {
        logger.error(CONTEXT, 'setEnforcerMode failed', { err });
        return { success: false, error: 'Failed to set enforcer mode', code: 'ENFORCER_SET_FAILED' };
      }
    },
  );

  // ─── getEnforcerMode ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.GET_ENFORCER_MODE, (): Result<unknown> => {
    try {
      const loginSettings = app.getLoginItemSettings({ args: ['--hidden'] });
      return { success: true, data: loginSettings.openAtLogin };
    } catch (err) {
      logger.error(CONTEXT, 'getEnforcerMode failed', { err });
      return { success: false, error: 'Failed to get enforcer mode', code: 'ENFORCER_GET_FAILED' };
    }
  });

  // ─── getHistory ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, (): Result<unknown> => {
    try {
      return { success: true, data: HistoryService.getInstance().readAll() };
    } catch (err) {
      logger.error(CONTEXT, 'getHistory failed', { err });
      return { success: false, error: 'Failed to get history', code: 'HISTORY_GET_FAILED' };
    }
  });

  // ─── clearHistory ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.CLEAR_HISTORY, (): Result<unknown> => {
    try {
      HistoryService.getInstance().clear();
      return { success: true, data: undefined };
    } catch (err) {
      logger.error(CONTEXT, 'clearHistory failed', { err });
      return { success: false, error: 'Failed to clear history', code: 'HISTORY_CLEAR_FAILED' };
    }
  });

  // ─── hasIntent ───────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.HAS_INTENT, (): Result<unknown> => {
    try {
      return { success: true, data: serviceManager.hasIntent() };
    } catch (err) {
      logger.error(CONTEXT, 'hasIntent failed', { err });
      return { success: false, error: 'Failed to check intent', code: 'INTENT_CHECK_FAILED' };
    }
  });

  // ─── getSipStatus ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.GET_SIP_STATUS, async (): Promise<Result<boolean>> => {
    try {
      return await sipService.getSipStatus();
    } catch (err) {
      logger.error(CONTEXT, 'getSipStatus failed', { err });
      return { success: false, error: 'Failed to check SIP status', code: 'GET_SIP_STATUS_FAILED' };
    }
  });

  // ─── getTweaks ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.GET_TWEAKS, async (): Promise<Result<unknown>> => {
    try {
      return await tweakManager.getAllTweaksWithState();
    } catch (err) {
      logger.error(CONTEXT, 'getTweaks failed', { err });
      return { success: false, error: 'Failed to load tweaks', code: 'GET_TWEAKS_FAILED' };
    }
  });

  // ─── applyTweaks ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.APPLY_TWEAKS, async (_e, { tweakIds, shouldApply }): Promise<Result<void>> => {
    try {
      for (const id of tweakIds) {
        const result = await tweakManager.applyTweak(id, shouldApply);
        if (!result.success) return result;
      }
      return { success: true, data: undefined };
    } catch (err) {
      logger.error(CONTEXT, 'applyTweaks failed', { err });
      return { success: false, error: 'Failed to apply tweaks', code: 'APPLY_TWEAKS_FAILED' };
    }
  });

  // ─── runAction ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.RUN_ACTION, async (_e, actionId: string): Promise<Result<string>> => {
    try {
      return await tweakManager.runAction(actionId);
    } catch (err) {
      logger.error(CONTEXT, 'runAction failed', { err });
      return { success: false, error: 'Failed to run action', code: 'RUN_ACTION_FAILED' };
    }
  });

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
