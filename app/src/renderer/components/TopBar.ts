/**
 * TopBar component.
 * Center: current page title.
 * Right: theme toggle + refresh button + pending changes badge.
 */

import { Component } from '../core/Component.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { showToast } from './Toast.js';
import { themeManager } from '../core/ThemeManager.js';
import type { AppSettings } from '../../shared/types.js';

// Icons
const MOON_ICON = `<svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
</svg>`;

const SUN_ICON = `<svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
  <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
</svg>`;

const SYSTEM_ICON = `<svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
  <path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clip-rule="evenodd"/>
</svg>`;

export class TopBar extends Component {
  private currentPageTitle = 'Dashboard';

  constructor() {
    super('header', 'topbar');
    this.element.setAttribute('role', 'banner');
  }

  protected render(): void {
    const pendingCount = store.get('pendingChanges').size;
    const currentTheme = store.get('settings').theme;
    const { icon, label, nextTheme } = this.themeButtonProps(currentTheme);

    this.setHTML(`
      <div class="topbar-page-title" id="topbar-page-title" aria-live="polite">
        ${this.currentPageTitle}
      </div>

      <div class="topbar-actions">
        ${pendingCount > 0 ? `
          <span class="topbar-pending-badge" aria-label="${pendingCount} pending change${pendingCount !== 1 ? 's' : ''}">
            ${pendingCount}
          </span>
        ` : ''}

        <button
          class="topbar-action-btn"
          id="topbar-theme"
          aria-label="${label}"
          title="${label}"
          data-next="${nextTheme}"
        >
          ${icon}
        </button>

        <button
          class="topbar-action-btn"
          id="topbar-refresh"
          aria-label="Refresh service states"
          title="Refresh service states"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `);
  }

  protected onMount(): void {
    // Theme toggle
    const themeBtn = this.query<HTMLButtonElement>('#topbar-theme');
    themeBtn.addEventListener('click', () => {
      void this.handleThemeCycle();
    });

    // Refresh
    const refreshBtn = this.query<HTMLButtonElement>('#topbar-refresh');
    refreshBtn.addEventListener('click', () => {
      void this.handleRefresh();
    });

    // Page title
    const routeUnsub = eventBus.on('page:title', (title) => {
      this.currentPageTitle = title;
      const titleEl = this.queryOptional('#topbar-page-title');
      if (titleEl !== null) titleEl.textContent = title;
    });
    this.addCleanup(routeUnsub);

    // Pending badge
    const pendingUnsub = store.subscribe('pendingChanges', (pending) => {
      this.updatePendingBadge(pending.size);
    });
    this.addCleanup(pendingUnsub);

    // Update theme button when settings change
    const settingsUnsub = store.subscribe('settings', (settings) => {
      this.updateThemeButton(settings.theme);
    });
    this.addCleanup(settingsUnsub);
  }

  /**
   * Cycle through dark → light → system → dark on each click.
   */
  private async handleThemeCycle(): Promise<void> {
    const btn = this.queryOptional<HTMLButtonElement>('#topbar-theme');
    const next = (btn?.dataset['next'] ?? 'light') as AppSettings['theme'];

    // Apply immediately
    themeManager.apply(next);

    // Persist
    const current = store.get('settings');
    const updated: AppSettings = { ...current, theme: next };
    store.setSettings(updated);
    await window.peakMacAPI.saveSettings(updated);

    this.updateThemeButton(next);
  }

  /** Update the theme button icon/label/next without a full re-render */
  private updateThemeButton(theme: AppSettings['theme']): void {
    const btn = this.queryOptional<HTMLButtonElement>('#topbar-theme');
    if (btn === null) return;
    const { icon, label, nextTheme } = this.themeButtonProps(theme);
    btn.innerHTML = icon;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.dataset['next'] = nextTheme;
  }

  /** Returns the icon, tooltip label, and next theme for the cycle */
  private themeButtonProps(theme: AppSettings['theme']): {
    icon: string;
    label: string;
    nextTheme: AppSettings['theme'];
  } {
    switch (theme) {
      case 'dark':
        return { icon: MOON_ICON,   label: 'Dark theme — click for Light',  nextTheme: 'light' };
      case 'light':
        return { icon: SUN_ICON,    label: 'Light theme — click for System', nextTheme: 'system' };
      case 'system':
        return { icon: SYSTEM_ICON, label: 'System theme — click for Dark',  nextTheme: 'dark' };
    }
  }

  private async handleRefresh(): Promise<void> {
    const btn = this.queryOptional<HTMLButtonElement>('#topbar-refresh');
    if (btn !== null) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }

    const result = await window.peakMacAPI.getServices();

    if (btn !== null) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }

    if (result.success) {
      store.setServices(result.data);
      showToast('success', 'Service states refreshed');
    } else {
      showToast('error', 'Failed to refresh service states');
    }
  }

  private updatePendingBadge(count: number): void {
    const actionsEl = this.queryOptional('.topbar-actions');
    if (actionsEl === null) return;
    const existing = this.queryOptional('.topbar-pending-badge');
    if (count > 0) {
      if (existing !== null) {
        existing.textContent = String(count);
      } else {
        const badge = document.createElement('span');
        badge.className = 'topbar-pending-badge';
        badge.textContent = String(count);
        badge.setAttribute('aria-label', `${count} pending change${count !== 1 ? 's' : ''}`);
        actionsEl.insertBefore(badge, actionsEl.firstChild);
      }
    } else {
      existing?.remove();
    }
  }
}
