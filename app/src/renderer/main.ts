/**
 * Renderer entry point.
 * Bootstraps the app: initializes store, router, components, and loads data.
 */

// window.peakMacAPI is exposed by the preload script via contextBridge.
// The type declaration is in src/preload/api.d.ts — no runtime import needed here.
import { store } from './core/Store.js';
import { router } from './core/Router.js';
import { eventBus } from './core/EventBus.js';
import { Sidebar } from './components/Sidebar.js';
import { TopBar } from './components/TopBar.js';
import { ApplyBar } from './components/ApplyBar.js';
import { ToastContainer } from './components/Toast.js';
import { DashboardView } from './views/DashboardView.js';
import { ServicesView } from './views/ServicesView.js';
import { CategoryView } from './views/CategoryView.js';
import { SettingsView } from './views/SettingsView.js';
import { showOnboardingModal } from './components/Modal.js';
import { themeManager } from './core/ThemeManager.js';
import { ServiceCategory } from '../shared/types.js';

/**
 * Bootstrap the application.
 */
async function bootstrap(): Promise<void> {
  const appEl = document.getElementById('app');
  if (appEl === null) throw new Error('Root #app element not found');

  // Verify the preload bridge is available
  if (typeof window.peakMacAPI === 'undefined') {
    throw new Error(
      'window.peakMacAPI is not defined. The preload script failed to load. ' +
      'Check that contextBridge is working and the preload path is correct.',
    );
  }

  // Apply dark theme immediately to avoid flash before settings load
  themeManager.apply('dark');

  // Set initial sidebar width CSS variable (sidebar reads localStorage and updates this on mount)
  const sidebarCollapsed = localStorage.getItem('peakmac:sidebar-collapsed') === 'true';
  document.documentElement.style.setProperty(
    '--sidebar-current-width',
    sidebarCollapsed ? '52px' : 'var(--sidebar-width)',
  );

  // ── Build layout shell ────────────────────────────────────────────────────
  const loadingEl = document.getElementById('app-loading');
  loadingEl?.remove();

  // Top bar (fixed, above everything)
  const topBar = new TopBar();
  topBar.mount(appEl);

  // App layout wrapper
  const layoutEl = document.createElement('div');
  layoutEl.className = 'app-layout';
  appEl.appendChild(layoutEl);

  // Sidebar
  const sidebar = new Sidebar();
  sidebar.mount(layoutEl);

  // Main content area
  const mainEl = document.createElement('main');
  mainEl.className = 'app-main';
  mainEl.id = 'main-content';
  mainEl.setAttribute('role', 'main');
  layoutEl.appendChild(mainEl);

  // Inner centering wrapper — views mount here
  const innerEl = document.createElement('div');
  innerEl.className = 'app-main-inner';
  mainEl.appendChild(innerEl);

  // Apply bar (fixed bottom)
  const applyBar = new ApplyBar();
  applyBar.mount(appEl);

  // Toast container
  const toastContainer = ToastContainer.getInstance();
  toastContainer.mount(appEl);

  // ── Register routes ───────────────────────────────────────────────────────
  router.setContainer(innerEl);

  router.register('#/dashboard', () => new DashboardView());
  router.register('#/services', () => new ServicesView());
  router.register('#/settings', () => new SettingsView());

  // Category routes
  Object.values(ServiceCategory).forEach((category) => {
    router.register(`#/category/${category}`, () => CategoryView.forCategory(category));
  });

  // ── Load initial data ─────────────────────────────────────────────────────
  await loadInitialData();

  // ── Start router ──────────────────────────────────────────────────────────
  router.start();

  // ── Check first launch ────────────────────────────────────────────────────
  const firstLaunchResult = await window.peakMacAPI.isFirstLaunch();
  if (firstLaunchResult.success && firstLaunchResult.data === true) {
    showOnboardingModal(() => {
      void window.peakMacAPI.markFirstLaunchDone();
    });
  }

  // ── Start stats polling ───────────────────────────────────────────────────
  startStatsPolling();
}

/**
 * Load all initial data from the main process.
 */
async function loadInitialData(): Promise<void> {
  store.set('isLoading', true);

  try {
    // Load in parallel
    const [servicesResult, statsResult, settingsResult, backupResult, sipResult] = await Promise.all([
      window.peakMacAPI.getServices(),
      window.peakMacAPI.getSystemStats(),
      window.peakMacAPI.getSettings(),
      window.peakMacAPI.hasBackup(),
      window.peakMacAPI.getSipStatus(),
    ]);

    if (servicesResult.success) {
      store.setServices(servicesResult.data);
    } else {
      eventBus.emit('services:error', servicesResult.error ?? 'Failed to load services');
    }

    if (statsResult.success) {
      store.setStats(statsResult.data);
    }

    if (settingsResult.success) {
      store.setSettings(settingsResult.data);
      themeManager.apply(settingsResult.data.theme);
    }

    if (backupResult.success) {
      store.set('hasBackup', backupResult.data);
    }

    if (sipResult.success) {
      store.set('sipActive', sipResult.data);
    }
  } finally {
    store.set('isLoading', false);
  }
}

/**
 * Poll system stats — pauses when the window is hidden to save CPU.
 * Uses visibilitychange to resume when the user switches back.
 */
function startStatsPolling(): void {
  let timer: ReturnType<typeof setInterval> | null = null;
  let isPending = false;

  const poll = (): void => {
    // Skip if a request is already in-flight
    if (isPending) return;
    isPending = true;
    void window.peakMacAPI.getSystemStats().then((result) => {
      isPending = false;
      if (result.success) {
        store.setStats(result.data);
      }
    });
  };

  const start = (): void => {
    if (timer !== null) return;
    poll(); // immediate on resume
    timer = setInterval(poll, 3000);
  };

  const stop = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  // Pause polling when tab/window is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  start();
}

// ── Start ─────────────────────────────────────────────────────────────────────
bootstrap().catch((err: unknown) => {
  console.error('Quieter bootstrap failed:', err);
  const appEl = document.getElementById('app');
  if (appEl !== null) {
    appEl.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        flex-direction: column;
        gap: 12px;
        color: #F87171;
        font-family: -apple-system, sans-serif;
        font-size: 14px;
        background: #0D0D0F;
        padding: 24px;
        text-align: center;
      ">
        <p style="font-size: 18px; font-weight: 600;">Quieter failed to start</p>
        <p style="color: #9B9AAB;">${err instanceof Error ? err.message : String(err)}</p>
      </div>
    `;
  }
});
