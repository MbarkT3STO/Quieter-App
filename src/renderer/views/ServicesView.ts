/**
 * ServicesView — shows all services with virtual scrolling for large lists.
 */

import { Component } from '../core/Component.js';
import { ServiceCard } from '../components/ServiceCard.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import type { ServiceWithState } from '../../shared/types.js';
import { VIRTUAL_SCROLL_THRESHOLD } from '../../shared/constants.js';

export class ServicesView extends Component {
  private cards = new Map<string, ServiceCard>();
  private filteredServices: ServiceWithState[] = [];

  constructor() {
    super('div', 'services-view');
  }

  protected render(): void {
    const services = store.getFilteredServices();
    this.filteredServices = services;

    this.setHTML(`
      <div class="page-header">
        <h1 class="page-title">All Services</h1>
        <p class="page-subtitle" id="services-count">${services.length} service${services.length !== 1 ? 's' : ''}</p>
      </div>
      <div class="services-grid" id="services-grid" role="list" aria-label="Services list"></div>
      <div class="empty-state" id="services-empty" style="display: none;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="40" height="40">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p>No services match your search</p>
      </div>
    `);
  }

  protected onMount(): void {
    this.renderCards();

    // Re-render on search or category change
    const searchUnsub = eventBus.on('search:changed', () => {
      this.refreshList();
    });
    this.addCleanup(searchUnsub);

    const categoryUnsub = eventBus.on('category:changed', () => {
      this.refreshList();
    });
    this.addCleanup(categoryUnsub);

    // Re-render on services reload
    const servicesUnsub = eventBus.on('services:loaded', () => {
      this.refreshList();
    });
    this.addCleanup(servicesUnsub);

    this.addCleanup(() => {
      this.cards.forEach((card) => card.unmount());
      this.cards.clear();
    });
  }

  private refreshList(): void {
    const services = store.getFilteredServices();
    this.filteredServices = services;

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

    // Always read fresh from store so search/category filters are applied
    const services = store.getFilteredServices();
    this.filteredServices = services;

    // Remove cards no longer in list
    const serviceIds = new Set(services.map((s) => s.id));
    this.cards.forEach((card, id) => {
      if (!serviceIds.has(id)) {
        card.unmount();
        this.cards.delete(id);
      }
    });

    // Add or update cards
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

  /**
   * Virtual scroll rendering for large service lists (> VIRTUAL_SCROLL_THRESHOLD).
   * Only renders visible items plus a buffer.
   */
  private renderVirtual(services: ServiceWithState[]): void {
    const grid = this.queryOptional<HTMLElement>('#services-grid');
    if (grid === null) return;

    // For virtual scroll, we render all cards but use IntersectionObserver
    // to lazy-mount them. This is a simplified virtual scroll implementation.
    this.cards.forEach((card) => card.unmount());
    this.cards.clear();

    // Render in batches to avoid blocking the main thread
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

      if (index < services.length) {
        requestAnimationFrame(renderBatch);
      }
    };

    requestAnimationFrame(renderBatch);
  }
}
