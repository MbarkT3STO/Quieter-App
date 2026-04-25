/**
 * TopBar component — app title, search, global actions.
 */

import { Component } from '../core/Component.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { SEARCH_DEBOUNCE_MS, APP_NAME } from '../../shared/constants.js';

export class TopBar extends Component {
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super('header', 'topbar');
    this.element.setAttribute('role', 'banner');
  }

  protected render(): void {
    this.setHTML(`
      <span class="topbar-title" aria-label="${APP_NAME}">${APP_NAME}</span>

      <div class="topbar-search" role="search">
        <svg class="topbar-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
        </svg>
        <input
          type="search"
          class="topbar-search-input"
          placeholder="Search services…"
          aria-label="Search services"
          autocomplete="off"
          spellcheck="false"
          value=""
        />
      </div>

      <div class="topbar-actions">
        <button class="topbar-action-btn" id="topbar-refresh" aria-label="Refresh service states" title="Refresh">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `);
  }

  protected onMount(): void {
    const searchInput = this.query<HTMLInputElement>('.topbar-search-input');
    const refreshBtn = this.query<HTMLButtonElement>('#topbar-refresh');

    // Restore current search query
    searchInput.value = store.get('searchQuery');

    // Search with debounce
    searchInput.addEventListener('input', () => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
      }
      this.searchTimer = setTimeout(() => {
        const query = searchInput.value;
        store.set('searchQuery', query);
        eventBus.emit('search:changed', query);
      }, SEARCH_DEBOUNCE_MS);
    });

    // Clear search on Escape
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        store.set('searchQuery', '');
        eventBus.emit('search:changed', '');
        searchInput.blur();
      }
    });

    // Refresh button
    refreshBtn.addEventListener('click', () => {
      eventBus.emit('services:loaded');
      // Trigger a reload via the main app
      void window.peakMacAPI.getServices().then((result) => {
        if (result.success) {
          store.setServices(result.data as import('../../shared/types.js').ServiceWithState[]);
          eventBus.emit('toast:show', { type: 'success', message: 'Service states refreshed' });
        }
      });
    });

    this.addCleanup(() => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    });
  }
}
