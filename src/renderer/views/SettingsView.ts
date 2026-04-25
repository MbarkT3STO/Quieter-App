/**
 * SettingsView — app settings, backup/restore, about section.
 */

import { Component } from '../core/Component.js';
import { Toggle } from '../components/Toggle.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { showToast } from '../components/Toast.js';
import { themeManager } from '../core/ThemeManager.js';
import type { AppSettings } from '../../shared/types.js';
import { ChangeAction } from '../../shared/types.js';
import { APP_NAME, APP_VERSION, GITHUB_URL } from '../../shared/constants.js';

type ThemeSetting = AppSettings['theme'];

export class SettingsView extends Component {
  private loginToggle: Toggle | null = null;
  private autoCheckToggle: Toggle | null = null;

  constructor() {
    super('div', 'settings-view');
  }

  protected render(): void {
    const settings = store.get('settings');
    const hasBackup = store.get('hasBackup');

    this.setHTML(`
      <div class="page-header">
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Configure Quieter behavior and manage backups</p>
      </div>

      <!-- About -->
      <div class="about-section">
        <div class="about-app-icon" aria-hidden="true">
          <img src="./assets/icons/AppIcon128.png" width="56" height="56" alt="Quieter icon" style="border-radius: 14px;" />
        </div>
        <div>
          <div class="about-app-name">${APP_NAME}</div>
          <div class="about-app-version">Version ${APP_VERSION}</div>
          <div class="about-links">
            <a class="about-link" id="link-github" href="#" aria-label="Open GitHub repository">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </div>

      <!-- General Settings -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-title">General</div>
          <div class="settings-section-desc">App behavior and startup options</div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Launch at Login</div>
            <div class="settings-row-desc">Start PeakMac automatically when you log in to macOS</div>
          </div>
          <div id="toggle-login"></div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Auto-check Service States on Startup</div>
            <div class="settings-row-desc">Read actual system service states when the app launches</div>
          </div>
          <div id="toggle-autocheck"></div>
        </div>
      </div>

      <!-- Appearance -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-title">Appearance</div>
          <div class="settings-section-desc">Choose how PeakMac looks</div>
        </div>

        <div class="settings-row" style="align-items: flex-start; padding-top: var(--space-4); padding-bottom: var(--space-4);">
          <div class="settings-row-info">
            <div class="settings-row-label">Theme</div>
            <div class="settings-row-desc">Switch between dark, light, or follow your macOS system setting</div>
          </div>
          <div class="theme-switcher" role="radiogroup" aria-label="Theme selection">
            ${(['dark', 'light', 'system'] as ThemeSetting[]).map((t) => `
              <button
                class="theme-option${settings.theme === t ? ' active' : ''}"
                data-value="${t}"
                role="radio"
                aria-checked="${settings.theme === t}"
                aria-label="${t.charAt(0).toUpperCase() + t.slice(1)} theme"
              >
                <div class="theme-option-preview" aria-hidden="true">
                  <div class="preview-bar"></div>
                  <div class="preview-bar"></div>
                  <div class="preview-bar"></div>
                </div>
                ${t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-title">Backup & Restore</div>
          <div class="settings-section-desc">Manage service state snapshots</div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Restore from Backup</div>
            <div class="settings-row-desc">
              ${hasBackup
                ? 'A backup snapshot exists. Restore all services to their state at last backup.'
                : 'No backup snapshot found. A snapshot is created automatically before applying changes.'}
            </div>
          </div>
          <button
            class="btn ${hasBackup ? 'btn-ghost' : 'btn-ghost'}"
            id="btn-restore"
            ${!hasBackup ? 'disabled' : ''}
            aria-label="Restore from backup"
          >
            Restore All
          </button>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Export System Report</div>
            <div class="settings-row-desc">Export a JSON report of all services and current system state</div>
          </div>
          <button class="btn btn-ghost" id="btn-export" aria-label="Export system report">
            Export JSON
          </button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-title">Danger Zone</div>
          <div class="settings-section-desc">Irreversible actions — use with caution</div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Re-enable All Services</div>
            <div class="settings-row-desc">Enable every service in the registry (restores macOS defaults)</div>
          </div>
          <button class="btn btn-danger" id="btn-enable-all" aria-label="Enable all services">
            Enable All
          </button>
        </div>
      </div>
    `);

    // Mount toggles
    const loginContainer = this.queryOptional<HTMLElement>('#toggle-login');
    if (loginContainer !== null) {
      this.loginToggle = new Toggle({
        checked: settings.launchAtLogin,
        label: 'Launch at login',
        onChange: (checked) => {
          void this.saveSetting('launchAtLogin', checked);
        },
      });
      this.loginToggle.mount(loginContainer);
    }

    const autoCheckContainer = this.queryOptional<HTMLElement>('#toggle-autocheck');
    if (autoCheckContainer !== null) {
      this.autoCheckToggle = new Toggle({
        checked: settings.autoCheckOnStartup,
        label: 'Auto-check on startup',
        onChange: (checked) => {
          void this.saveSetting('autoCheckOnStartup', checked);
        },
      });
      this.autoCheckToggle.mount(autoCheckContainer);
    }
  }

  protected onMount(): void {
    this.bindActions();
  }

  private bindActions(): void {
    // Theme switcher
    const themeSwitcher = this.queryOptional<HTMLElement>('.theme-switcher');
    themeSwitcher?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-value]');
      if (btn === null) return;
      const value = btn.dataset['value'] as ThemeSetting | undefined;
      if (value === undefined) return;
      void this.handleThemeChange(value);
    });

    // GitHub link
    const githubLink = this.queryOptional<HTMLAnchorElement>('#link-github');
    githubLink?.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(GITHUB_URL, '_blank');
    });

    // Restore button
    const restoreBtn = this.queryOptional<HTMLButtonElement>('#btn-restore');
    restoreBtn?.addEventListener('click', () => {
      void this.handleRestore();
    });

    // Export button
    const exportBtn = this.queryOptional<HTMLButtonElement>('#btn-export');
    exportBtn?.addEventListener('click', () => {
      void this.handleExport();
    });

    // Enable all button
    const enableAllBtn = this.queryOptional<HTMLButtonElement>('#btn-enable-all');
    enableAllBtn?.addEventListener('click', () => {
      void this.handleEnableAll();
    });
  }

  private async handleThemeChange(theme: ThemeSetting): Promise<void> {
    // Apply immediately — no need to wait for save
    themeManager.apply(theme);

    // Update active state on buttons without full re-render
    const buttons = this.queryAll<HTMLButtonElement>('.theme-option');
    buttons.forEach((btn) => {
      const isActive = btn.dataset['value'] === theme;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', String(isActive));
    });

    await this.saveSetting('theme', theme);
  }

  private async saveSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ): Promise<void> {
    const current = store.get('settings');
    const updated: AppSettings = { ...current, [key]: value };
    store.setSettings(updated);

    const result = await window.peakMacAPI.saveSettings(updated);
    if (result.success) {
      eventBus.emit('settings:saved');
      showToast('success', 'Settings saved');
    } else {
      showToast('error', `Failed to save settings: ${result.error}`);
    }
  }

  private async handleRestore(): Promise<void> {
    const result = await window.peakMacAPI.revertAll();
    if (result.success) {
      showToast('success', 'All services restored from backup');
      eventBus.emit('revert:done');
    } else {
      showToast('error', `Restore failed: ${result.error}`);
    }
  }

  private async handleExport(): Promise<void> {
    const result = await window.peakMacAPI.exportReport();
    if (!result.success) {
      showToast('error', `Export failed: ${result.error}`);
      return;
    }

    // Create a download link
    const blob = new Blob([result.data as string], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `peakmac-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('success', 'Report exported successfully');
  }

  private async handleEnableAll(): Promise<void> {
    const services = store.get('services');

    services.forEach((s) => {
      store.togglePendingChange(s.id, ChangeAction.Enable);
    });

    showToast('info', `Marked ${services.length} services for enabling. Click Apply Changes to proceed.`);
  }
}
