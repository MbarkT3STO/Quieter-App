/**
 * Shared constants used across main, preload, and renderer processes.
 */

export const APP_NAME = 'Quieter';
export const APP_VERSION = '1.0.0';

/** Directory for Quieter data files */
export const DATA_DIR_NAME = '.quieter';

/** Backup snapshot filename */
export const BACKUP_FILENAME = 'backup.json';

/** Log directory name */
export const LOG_DIR_NAME = 'logs';

/** Log filename */
export const LOG_FILENAME = 'app.log';

/** Settings filename */
export const SETTINGS_FILENAME = 'settings.json';

/** First launch flag filename */
export const FIRST_LAUNCH_FILENAME = '.first-launch-done';

/** Shell command timeout in milliseconds */
export const SHELL_TIMEOUT_MS = 10_000;

/** System stats polling interval in milliseconds */
export const STATS_POLL_INTERVAL_MS = 3_000;

/** Search debounce delay in milliseconds */
export const SEARCH_DEBOUNCE_MS = 150;

/** Maximum log file size in bytes (5 MB) */
export const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024;

/** Virtual scroll item height in pixels */
export const VIRTUAL_SCROLL_ITEM_HEIGHT = 160;

/** Threshold for enabling virtual scroll */
export const VIRTUAL_SCROLL_THRESHOLD = 50;

/** Default app settings */
export const DEFAULT_SETTINGS = {
  launchAtLogin: false,
  autoCheckOnStartup: true,
  theme: 'dark' as const,
};

/** GitHub repository URL */
export const GITHUB_URL = 'https://github.com/quieter-app/quieter';

/** Learn more URL */
export const LEARN_MORE_URL = 'https://github.com/quieter-app/quieter#readme';
