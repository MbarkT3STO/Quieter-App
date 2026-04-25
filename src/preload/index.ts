/**
 * Preload script — exposes typed window.peakMacAPI via contextBridge.
 * No business logic here — only bridge wiring.
 * contextIsolation: true is enforced in main/index.ts.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../main/ipc/channels.js';
import type {
  PeakMacAPI,
  ServiceChange,
  AppSettings,
  ApplyProgress,
} from '../shared/types.js';

const api: PeakMacAPI = {
  getServices() {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SERVICES);
  },

  getSystemStats() {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SYSTEM_STATS);
  },

  applyChanges(changes: ServiceChange[]) {
    return ipcRenderer.invoke(IPC_CHANNELS.APPLY_CHANGES, changes);
  },

  revertAll() {
    return ipcRenderer.invoke(IPC_CHANNELS.REVERT_ALL);
  },

  exportReport() {
    return ipcRenderer.invoke(IPC_CHANNELS.EXPORT_REPORT);
  },

  hasBackup() {
    return ipcRenderer.invoke(IPC_CHANNELS.HAS_BACKUP);
  },

  isFirstLaunch() {
    return ipcRenderer.invoke(IPC_CHANNELS.IS_FIRST_LAUNCH);
  },

  markFirstLaunchDone() {
    return ipcRenderer.invoke(IPC_CHANNELS.MARK_FIRST_LAUNCH_DONE);
  },

  getSettings() {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS);
  },

  saveSettings(settings: AppSettings) {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings);
  },

  onApplyProgress(cb: (progress: ApplyProgress) => void) {
    ipcRenderer.on(IPC_CHANNELS.APPLY_PROGRESS, (_event, progress: ApplyProgress) => {
      cb(progress);
    });
  },

  offApplyProgress() {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.APPLY_PROGRESS);
  },
};

contextBridge.exposeInMainWorld('peakMacAPI', api);
