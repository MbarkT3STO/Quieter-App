/**
 * TopBar component.
 * Left: app icon + name (in the macOS traffic-lights zone).
 * Center: current page title (updates on navigation).
 * Right: pending changes badge + refresh button.
 */

import { Component } from '../core/Component.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { showToast } from './Toast.js';
import { APP_NAME } from '../../shared/constants.js';

export class TopBar extends Component {
  private currentPageTitle = 'Dashboard';

  constructor() {
    super('header', 'topbar');
    this.element.setAttribute('role', 'banner');
  }

  protected render(): void {
    const pendingCount = store.get('pendingChanges').size;

    this.setHTML(`
      <!-- Left: app identity (sits over the macOS traffic lights area) -->
      <div class="topbar-brand" aria-label="${APP_NAME}">
        <img
          src="./assets/icons/AppIcon32.png"
          width="20"
          height="20"
          alt=""
          aria-hidden="true"
          class="topbar-brand-icon"
          draggable="false"
        />
        <span class="topbar-brand-name">${APP_NAME}</span>
      </div>

      <!-- Center: current page title -->
      <div class="topbar-page-title" id="topbar-page-title" aria-live="polite">
        ${this.currentPageTitle}
      </div>

      <!-- Right: actions -->
      <div class="topbar-actions">
        ${pendingCount > 0 ? `
          <span class="topbar-pending-badge" aria-label="${pendingCount} pending change${pendingCount !== 1 ? 's' : ''}">
            ${pendingCount}
          </span>
        ` : ''}
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
    // Refresh button
    const refreshBtn = this.query<HTMLButtonElement>('#topbar-refresh');
    refreshBtn.addEventListener('click', () => {
      void this.handleRefresh();
    });

    // Update page title on navigation
    const routeUnsub = eventBus.on('page:title', (title) => {
      this.currentPageTitle = title;
      const titleEl = this.queryOptional('#topbar-page-title');
      if (titleEl !== null) titleEl.textContent = title;
    });
    this.addCleanup(routeUnsub);

    // Update pending badge when changes change
    const pendingUnsub = store.subscribe('pendingChanges', (pending) => {
      this.updatePendingBadge(pending.size);
    });
    this.addCleanup(pendingUnsub);
  }

  private async handleRefresh(): Promise<void> {
    const btn = this.queryOptional<HTMLButtonElement>('#topbar-refresh');
    if (btn !== null) {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    }

    const result = await window.peakMacAPI.getServices();

    if (btn !== null) {
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
    }

    if (result.success) {
      store.setServices(result.data as import('../../shared/types.js').ServiceWithState[]);
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
        existing.setAttribute('aria-label', `${count} pending change${count !== 1 ? 's' : ''}`);
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
