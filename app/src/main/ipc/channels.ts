/**
 * Typed IPC channel name constants.
 * All IPC communication must use these constants — no raw strings.
 */

export const IPC_CHANNELS = {
  /** Fetch all services with runtime states */
  GET_SERVICES: 'peakmac:get-services',
  /** Get current system CPU/RAM stats */
  GET_SYSTEM_STATS: 'peakmac:get-system-stats',
  /** Apply a batch of service changes */
  APPLY_CHANGES: 'peakmac:apply-changes',
  /** Revert all changes from backup snapshot */
  REVERT_ALL: 'peakmac:revert-all',
  /** Export system report as JSON */
  EXPORT_REPORT: 'peakmac:export-report',
  /** Check if backup snapshot exists */
  HAS_BACKUP: 'peakmac:has-backup',
  /** Check if this is the first launch */
  IS_FIRST_LAUNCH: 'peakmac:is-first-launch',
  /** Mark first launch as complete */
  MARK_FIRST_LAUNCH_DONE: 'peakmac:mark-first-launch-done',
  /** Get app settings */
  GET_SETTINGS: 'peakmac:get-settings',
  /** Save app settings */
  SAVE_SETTINGS: 'peakmac:save-settings',
  /** Progress event pushed from main to renderer during apply */
  APPLY_PROGRESS: 'peakmac:apply-progress',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
