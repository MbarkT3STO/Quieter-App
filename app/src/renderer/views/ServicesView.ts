/**
 * ServicesView — shows all services with inline search and virtual scrolling.
 */

import { Component } from '../core/Component.js';
import { ServiceCard } from '../components/ServiceCard.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import type { ServiceWithState } from '../../shared/types.js';
import { VIRTUAL_SCROLL_THRESHOLD, SEARCH_DEBOUNCE_MS } from '../../shared/constants.js';

export class ServicesView extends Component {
  private cards = new Map<string, ServiceCard>();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super('div', 'services-view');
  }

  protected render(): void {
    const services = store.getFilteredServices();
    const currentQuery = store.get('searchQuery');

    this.setHTML(`
      <div class="page-header">
        <div class="services-header-row">
          <div>
            <h1 class="page-title">All Services</h1>
            <p class="page-subtitle" id="services-count">
              ${services.length} service${services.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div class="services-search" role="search">
            <svg class="services-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg>
            <input
              type="search"
              id="services-search-input"
              class="services-search-input"
              placeholder="Search services…"
              aria-label="Search services"
              autocomplete="off"
              spellcheck="false"
              value="${currentQuery}"
            />
            ${currentQuery.length > 0 ? `
              <button class="services-search-clear" aria-label="Clear search" id="search-clear-btn">
                <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                  <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="services-grid" id="services-grid" role="list" aria-label="Services list"></div>

      <div class="empty-state" id="services-empty" style="display: none;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="40" height="40" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p>No services match your search</p>
        <button class="btn btn-ghost" id="btn-clear-search" style="margin-top: 8px;">Clear search</button>
      </div>
    `);
  }

  protected onMount(): void {
    this.renderCards();
    this.bindSearch();

    const searchUnsub = eventBus.on('search:changed', () => {
      this.refreshList();
    });
    this.addCleanup(searchUnsub);

    const servicesUnsub = eventBus.on('services:loaded', () => {
      this.refreshList();
    });
    this.addCleanup(servicesUnsub);

    this.addCleanup(() => {
      this.cards.forEach((card) => card.unmount());
      this.cards.clear();
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    });
  }

  private bindSearch(): void {
    const input = this.queryOptional<HTMLInputElement>('#services-search-input');
    if (input === null) return;

    // Focus the input when the view mounts
    requestAnimationFrame(() => input.focus());

    input.addEventListener('input', () => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        const query = input.value;
        store.set('searchQuery', query);
        eventBus.emit('search:changed', query);
        this.updateClearButton(query);
      }, SEARCH_DEBOUNCE_MS);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearSearch();
        input.blur();
      }
    });

    // Clear button inside the input
    const clearBtn = this.queryOptional<HTMLButtonElement>('#search-clear-btn');
    clearBtn?.addEventListener('click', () => this.clearSearch());

    // Clear button in empty state
    const emptyClearBtn = this.queryOptional<HTMLButtonElement>('#btn-clear-search');
    emptyClearBtn?.addEventListener('click', () => this.clearSearch());
  }

  private clearSearch(): void {
    const input = this.queryOptional<HTMLInputElement>('#services-search-input');
    if (input !== null) input.value = '';
    store.set('searchQuery', '');
    eventBus.emit('search:changed', '');
    this.updateClearButton('');
  }

  private updateClearButton(query: string): void {
    const existing = this.queryOptional('#search-clear-btn');
    const searchDiv = this.queryOptional('.services-search');
    if (searchDiv === null) return;

    if (query.length > 0 && existing === null) {
      const btn = document.createElement('button');
      btn.className = 'services-search-clear';
      btn.id = 'search-clear-btn';
      btn.setAttribute('aria-label', 'Clear search');
      btn.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
        <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
      </svg>`;
      btn.addEventListener('click', () => this.clearSearch());
      searchDiv.appendChild(btn);
    } else if (query.length === 0 && existing !== null) {
      existing.remove();
    }
  }

  private refreshList(): void {
    const services = store.getFilteredServices();

    const countEl = this.queryOptional('#services-count');
    if (countEl !== null) {
      countEl.textContent = `${services.length} service${services.length !== 1 ? 's' : ''}`;
    }

    const emptyEl = this.queryOptional<HTMLElement>('#services-empty');
    const gridEl = this.queryOptional<HTMLElement>('#services-grid');

    if (services.length === 0) {
      if (emptyEl !== null) emptyEl.style.display = 'flex';
      if (gridEl !== null) gridEl.style.display = 'none';
      return;
    }

    if (emptyEl !== null) emptyEl.style.display = 'none';
    if (gridEl !== null) gridEl.style.display = '';

    if (services.length > VIRTUAL_SCROLL_THRESHOLD) {
      this.renderVirtual(services);
    } else {
      this.renderCards();
    }
  }

  private renderCards(): void {
    const grid = this.queryOptional<HTMLElement>('#services-grid');
    if (grid === null) return;

    const services = store.getFilteredServices();

    const serviceIds = new Set(services.map((s) => s.id));
    this.cards.forEach((card, id) => {
      if (!serviceIds.has(id)) {
        card.unmount();
        this.cards.delete(id);
      }
    });

    services.forEach((service) => {
      const existing = this.cards.get(service.id);
      if (existing !== undefined) {
        existing.updateService(service);
      } else {
        const card = new ServiceCard(service);
        card.mount(grid);
        this.cards.set(service.id, card);
      }
    });
  }

  private renderVirtual(services: ServiceWithState[]): void {
    const grid = this.queryOptional<HTMLElement>('#services-grid');
    if (grid === null) return;

    this.cards.forEach((card) => card.unmount());
    this.cards.clear();

    const BATCH_SIZE = 10;
    let index = 0;

    const renderBatch = (): void => {
      const end = Math.min(index + BATCH_SIZE, services.length);
      for (let i = index; i < end; i++) {
        const service = services[i];
        if (service === undefined) continue;
        const card = new ServiceCard(service);
        card.mount(grid);
        this.cards.set(service.id, card);
      }
      index = end;
      if (index < services.length) requestAnimationFrame(renderBatch);
    };

    requestAnimationFrame(renderBatch);
  }
}
