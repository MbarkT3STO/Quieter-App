/**
 * Quieter — Electron main process entry point.
 * Sets up BrowserWindow, registers IPC handlers, and starts system polling.
 */

import { app, BrowserWindow, shell, nativeTheme, nativeImage } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc/handlers.js';
import { SystemInfoService } from './services/SystemInfoService.js';
import { logger } from './utils/logger.js';
import { APP_NAME } from '../shared/constants.js';

const CONTEXT = 'Main';

let mainWindow: BrowserWindow | null = null;

/**
 * Create the main application window.
 */
function createWindow(): void {
  // Resolve icon path relative to the app resources
  const iconPath = path.join(__dirname, '../../src/Logos/AppIcon512.png');
  const appIcon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0D0D0F',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    icon: appIcon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  // Show window once ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    logger.info(CONTEXT, 'Main window shown');
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the renderer
  if (process.env['ELECTRON_RENDERER_URL'] !== undefined) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info(CONTEXT, 'BrowserWindow created');
}

/**
 * App lifecycle — ready
 */
app.whenReady().then(() => {
  logger.info(CONTEXT, `${APP_NAME} starting up`, {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions['electron'],
    nodeVersion: process.versions['node'],
  });

  // Apply dark theme
  nativeTheme.themeSource = 'dark';

  // Register all IPC handlers
  registerIpcHandlers(() => mainWindow);

  // Create the window
  createWindow();

  // Start system stats polling
  SystemInfoService.getInstance().startPolling();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * App lifecycle — all windows closed
 */
app.on('window-all-closed', () => {
  SystemInfoService.getInstance().stopPolling();
  logger.info(CONTEXT, 'All windows closed, quitting');
  logger.close();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Security: prevent new window creation
 */
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== 'null' && !url.startsWith('file://')) {
      event.preventDefault();
      logger.warn(CONTEXT, `Blocked navigation to: ${url}`);
    }
  });
});
