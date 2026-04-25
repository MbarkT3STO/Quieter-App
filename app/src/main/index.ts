/**
 * Quieter — Electron main process entry point.
 * macOS only. No default menu. DevTools disabled.
 */

import { app, BrowserWindow, shell, nativeTheme, nativeImage, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { registerIpcHandlers } from './ipc/handlers.js';
import { SystemInfoService } from './services/SystemInfoService.js';
import { logger } from './utils/logger.js';
import { APP_NAME } from '../shared/constants.js';

const CONTEXT = 'Main';

// ── macOS-only guard ──────────────────────────────────────────────────────────
if (process.platform !== 'darwin') {
  process.stderr.write('Quieter only runs on macOS.\n');
  process.exit(1);
}

let mainWindow: BrowserWindow | null = null;

/**
 * Create the main application window.
 */
function createWindow(): void {
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
      devTools: false,          // disable DevTools entirely
    },
  });

  // Show window once ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    logger.info(CONTEXT, 'Main window shown');
  });

  // Block any attempt to open DevTools
  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow?.webContents.closeDevTools();
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

  // ── Remove the default Electron menu entirely ─────────────────────────────
  Menu.setApplicationMenu(null);

  // ── Apply nativeTheme from saved settings ─────────────────────────────────
  const settingsFilePath = path.join(os.homedir(), '.quieter', 'settings.json');
  let savedTheme: 'dark' | 'light' | 'system' = 'dark';
  try {
    if (fs.existsSync(settingsFilePath)) {
      const raw = fs.readFileSync(settingsFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as { theme?: 'dark' | 'light' | 'system' };
      if (parsed.theme !== undefined) savedTheme = parsed.theme;
    }
  } catch { /* no settings yet — default to dark */ }
  nativeTheme.themeSource = savedTheme === 'system' ? 'system' : savedTheme;

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
  // On macOS apps stay active until Cmd+Q — standard behaviour
  // (no app.quit() here; the dock icon remains)
});

/**
 * Security: block all navigation away from the app origin,
 * and prevent any new window / DevTools from opening.
 */
app.on('web-contents-created', (_event, contents) => {
  // Block navigation to external URLs
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== 'null' && !url.startsWith('file://')) {
      event.preventDefault();
      logger.warn(CONTEXT, `Blocked navigation to: ${url}`);
    }
  });

  // Close DevTools immediately if somehow opened
  contents.on('devtools-opened', () => {
    contents.closeDevTools();
    logger.warn(CONTEXT, 'DevTools open attempt blocked');
  });
});
