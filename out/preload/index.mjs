import { contextBridge, ipcRenderer } from "electron";
const IPC_CHANNELS = {
  /** Fetch all services with runtime states */
  GET_SERVICES: "peakmac:get-services",
  /** Get current system CPU/RAM stats */
  GET_SYSTEM_STATS: "peakmac:get-system-stats",
  /** Apply a batch of service changes */
  APPLY_CHANGES: "peakmac:apply-changes",
  /** Revert all changes from backup snapshot */
  REVERT_ALL: "peakmac:revert-all",
  /** Export system report as JSON */
  EXPORT_REPORT: "peakmac:export-report",
  /** Check if backup snapshot exists */
  HAS_BACKUP: "peakmac:has-backup",
  /** Check if this is the first launch */
  IS_FIRST_LAUNCH: "peakmac:is-first-launch",
  /** Mark first launch as complete */
  MARK_FIRST_LAUNCH_DONE: "peakmac:mark-first-launch-done",
  /** Get app settings */
  GET_SETTINGS: "peakmac:get-settings",
  /** Save app settings */
  SAVE_SETTINGS: "peakmac:save-settings",
  /** Progress event pushed from main to renderer during apply */
  APPLY_PROGRESS: "peakmac:apply-progress"
};
const api = {
  getServices() {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SERVICES);
  },
  getSystemStats() {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SYSTEM_STATS);
  },
  applyChanges(changes) {
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
  saveSettings(settings) {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings);
  },
  onApplyProgress(cb) {
    ipcRenderer.on(IPC_CHANNELS.APPLY_PROGRESS, (_event, progress) => {
      cb(progress);
    });
  },
  offApplyProgress() {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.APPLY_PROGRESS);
  }
};
contextBridge.exposeInMainWorld("peakMacAPI", api);
