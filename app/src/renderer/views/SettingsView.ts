/**
 * SettingsView — app settings, backup/restore, about section.
 */

import { Component } from '../core/Component.js';
import { Toggle } from '../components/Toggle.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { showToast } from '../components/Toast.js';
import { themeManager } from '../core/ThemeManager.js';
import type { AppSettings, HistoryEntry } from '../../shared/types.js';
import { ChangeAction, CpuMethod } from '../../shared/types.js';
import { APP_NAME, APP_VERSION, GITHUB_URL } from '../../shared/constants.js';

type ThemeSetting = AppSettings['theme'];

export class SettingsView extends Component {
  private loginToggle: Toggle | null = null;
  private autoCheckToggle: Toggle | null = null;
  private enforcerToggle: Toggle | null = null;

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
      <div class="about-card">
        <!-- Gradient header band -->
        <div class="about-card-header">
          <div class="about-card-glow" aria-hidden="true"></div>
          <img
            src="./AppIcon128.png"
            width="72"
            height="72"
            alt="Quieter app icon"
            class="about-card-icon"
          />
          <div class="about-card-identity">
            <h2 class="about-card-name">${APP_NAME}</h2>
            <span class="about-card-tagline">macOS System Optimizer</span>
          </div>
        </div>

        <!-- Meta row -->
        <div class="about-card-meta">
          <div class="about-meta-item">
            <span class="about-meta-label">Version</span>
            <span class="about-meta-value">${APP_VERSION}</span>
          </div>
          <div class="about-meta-divider" aria-hidden="true"></div>
          <div class="about-meta-item">
            <span class="about-meta-label">Platform</span>
            <span class="about-meta-value">macOS 12+</span>
          </div>
          <div class="about-meta-divider" aria-hidden="true"></div>
          <div class="about-meta-item">
            <span class="about-meta-label">Services</span>
            <span class="about-meta-value">60 curated</span>
          </div>
        </div>

        <!-- Description -->
        <p class="about-card-desc">
          Quieter helps you reclaim performance on aging Macs by selectively managing
          background services — safely, transparently, and reversibly.
        </p>

        <!-- Action links -->
        <div class="about-card-actions">
          <a class="about-action-btn" id="link-github" href="#" aria-label="View source on GitHub">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"/>
            </svg>
            View on GitHub
          </a>
          <a class="about-action-btn" id="link-readme" href="#" aria-label="Read documentation">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
            </svg>
            Documentation
          </a>
          <a class="about-action-btn about-action-btn--issue" id="link-issue" href="#" aria-label="Report an issue">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            Report Issue
          </a>
        </div>

        <!-- Footer -->
        <div class="about-card-footer">
          <span>Built with Electron + TypeScript</span>
          <span class="about-footer-dot" aria-hidden="true">·</span>
          <span>Open Source</span>
          <span class="about-footer-dot" aria-hidden="true">·</span>
          <span>MIT License</span>
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

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">CPU Measurement Method</div>
            <div class="settings-row-desc">
              <strong>Load Average</strong> — lightweight 1-min rolling average (default, recommended).<br/>
              <strong>Top Snapshot</strong> — real per-second reading via <code>top -l 1</code>, more accurate but spawns a process every 3 s.
            </div>
          </div>
          <div class="cpu-method-switcher" role="radiogroup" aria-label="CPU measurement method">
            <button
              class="cpu-method-btn${settings.cpuMethod === CpuMethod.LoadAvg || settings.cpuMethod === undefined ? ' active' : ''}"
              data-method="${CpuMethod.LoadAvg}"
              role="radio"
              aria-checked="${settings.cpuMethod === CpuMethod.LoadAvg || settings.cpuMethod === undefined}"
            >Load Avg</button>
            <button
              class="cpu-method-btn${settings.cpuMethod === CpuMethod.TopSnapshot ? ' active' : ''}"
              data-method="${CpuMethod.TopSnapshot}"
              role="radio"
              aria-checked="${settings.cpuMethod === CpuMethod.TopSnapshot}"
            >Top Snapshot</button>
          </div>
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

      <!-- Persistent Enforcer -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-title">Persistent Enforcer</div>
          <div class="settings-section-desc">Automatically re-disables your managed services after every restart. When enabled, Quieter runs silently at login for ~1 second to enforce your choices.</div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Enforce disabled services on login</div>
            <div class="settings-row-desc">Recommended for services that auto-restart</div>
          </div>
          <div id="toggle-enforcer"></div>
        </div>
      </div>

      <!-- History -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-title">History</div>
          <div class="settings-section-desc">Log of all applied service changes</div>
        </div>

        <div class="settings-row" style="align-items: flex-start; flex-direction: column; gap: var(--space-3);">
          <div id="history-list" style="width: 100%; max-height: 320px; overflow-y: auto;"></div>
          <button class="btn btn-ghost" id="btn-clear-history" aria-label="Clear history">
            Clear History
          </button>
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

    // Load enforcer state and mount toggle
    void window.peakMacAPI.getEnforcerMode().then((result) => {
      if (!result.success) return;
      const enforcerContainer = this.queryOptional<HTMLElement>('#toggle-enforcer');
      if (enforcerContainer === null) return;
      this.enforcerToggle = new Toggle({
        checked: result.data,
        label: 'Enforce disabled services on login',
        onChange: (checked) => {
          void window.peakMacAPI.setEnforcerMode(checked).then((r) => {
            if (r.success) {
              showToast(
                'success',
                checked
                  ? 'Persistent Enforcer enabled — services will be re-disabled after each restart'
                  : 'Persistent Enforcer disabled',
              );
            } else {
              showToast('error', 'Failed to update Persistent Enforcer');
            }
          });
        },
      });
      this.enforcerToggle.mount(enforcerContainer);
    });

    // Load history
    void this.loadHistory();
  }

  private bindActions(): void {
    // CPU method switcher
    const cpuSwitcher = this.queryOptional<HTMLElement>('.cpu-method-switcher');
    cpuSwitcher?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-method]');
      if (btn === null) return;
      const method = btn.dataset['method'] as CpuMethod | undefined;
      if (method === undefined) return;
      void this.saveSetting('cpuMethod', method);
      // Update active state immediately
      cpuSwitcher.querySelectorAll<HTMLButtonElement>('.cpu-method-btn').forEach((b) => {
        const isActive = b.dataset['method'] === method;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-checked', String(isActive));
      });
    });

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

    // Readme link
    const readmeLink = this.queryOptional<HTMLAnchorElement>('#link-readme');
    readmeLink?.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(`${GITHUB_URL}#readme`, '_blank');
    });

    // Report issue link
    const issueLink = this.queryOptional<HTMLAnchorElement>('#link-issue');
    issueLink?.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(`${GITHUB_URL}/issues`, '_blank');
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
      this.handleEnableAll();
    });

    // Clear history button
    const clearHistoryBtn = this.queryOptional<HTMLButtonElement>('#btn-clear-history');
    clearHistoryBtn?.addEventListener('click', () => {
      void this.handleClearHistory();
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

  private handleEnableAll(): void {
    const services = store.get('services');

    // Force-stage every service for enabling in a single batch.
    // Uses setPendingChange (not togglePendingChange) so repeated clicks
    // never accidentally un-stage a service.
    services.forEach((s) => {
      store.setPendingChange(s.id, ChangeAction.Enable);
    });

    const count = services.length;
    showToast('info', `Marked ${count} service${count !== 1 ? 's' : ''} for enabling. Click Apply Changes to proceed.`);
  }

  protected onUnmount(): void {
    this.enforcerToggle?.unmount();
    this.enforcerToggle = null;
    this.loginToggle?.unmount();
    this.loginToggle = null;
    this.autoCheckToggle?.unmount();
    this.autoCheckToggle = null;
  }

  private async loadHistory(): Promise<void> {
    const listEl = this.queryOptional<HTMLElement>('#history-list');
    if (listEl === null) return;

    const result = await window.peakMacAPI.getHistory();
    if (!result.success) {
      listEl.innerHTML = `<p class="text-muted text-sm" style="padding: 8px 0;">Failed to load history.</p>`;
      return;
    }

    this.renderHistoryList(result.data, listEl);
  }

  private renderHistoryList(entries: HistoryEntry[], listEl: HTMLElement): void {
    if (entries.length === 0) {
      listEl.innerHTML = `<p class="text-muted text-sm" style="padding: 8px 0;">No history yet.</p>`;
      return;
    }

    listEl.innerHTML = entries.map((entry) => {
      const date = new Date(entry.timestamp);
      const formatted = date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const actionIcon = entry.action === ChangeAction.Disable ? '↓' : '↑';
      const pillClass = entry.success ? 'history-pill--success' : 'history-pill--error';
      const pillLabel = entry.success ? 'OK' : 'Failed';
      const errorAttr = !entry.success && entry.error !== undefined
        ? ` title="${entry.error.replace(/"/g, '&quot;')}"`
        : '';

      return `
        <div class="history-row" style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.06)); font-size: 12px;">
          <span class="text-muted" style="min-width: 110px; flex-shrink: 0;">${formatted}</span>
          <span class="history-action-icon" aria-label="${entry.action}" style="font-weight: 600; min-width: 16px;">${actionIcon}</span>
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${entry.serviceName}</span>
          <span class="history-pill ${pillClass}"${errorAttr} style="flex-shrink: 0; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">${pillLabel}</span>
        </div>
      `;
    }).join('');
  }

  private async handleClearHistory(): Promise<void> {
    const result = await window.peakMacAPI.clearHistory();
    if (result.success) {
      const listEl = this.queryOptional<HTMLElement>('#history-list');
      if (listEl !== null) {
        this.renderHistoryList([], listEl);
      }
      showToast('success', 'History cleared');
    } else {
      showToast('error', 'Failed to clear history');
    }
  }
}
