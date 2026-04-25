/**
 * CategoryView — shows services filtered by a specific category.
 */

import { Component } from '../core/Component.js';
import { ServiceCard } from '../components/ServiceCard.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import type { ServiceWithState } from '../../shared/types.js';
import { ServiceCategory } from '../../shared/types.js';

export class CategoryView extends Component {
  private readonly category: ServiceCategory;
  private cards = new Map<string, ServiceCard>();

  constructor(category: ServiceCategory) {
    super('div', 'category-view');
    this.category = category;
  }

  protected render(): void {
    const services = store.getServicesByCategory(this.category);

    this.setHTML(`
      <div class="page-header">
        <h1 class="page-title">${this.category}</h1>
        <p class="page-subtitle">${services.length} service${services.length !== 1 ? 's' : ''} in this category</p>
      </div>
      <div class="services-grid" id="category-grid" role="list" aria-label="${this.category} services"></div>
      <div class="empty-state" id="category-empty" style="display: ${services.length === 0 ? 'flex' : 'none'};">
        <p>No services in this category</p>
      </div>
    `);
  }

  protected onMount(): void {
    this.renderCards();

    const servicesUnsub = eventBus.on('services:loaded', () => {
      this.refreshCards();
    });
    this.addCleanup(servicesUnsub);

    this.addCleanup(() => {
      this.cards.forEach((card) => card.unmount());
      this.cards.clear();
    });
  }

  private renderCards(): void {
    const grid = this.queryOptional<HTMLElement>('#category-grid');
    if (grid === null) return;

    const services = store.getServicesByCategory(this.category);

    services.forEach((service) => {
      const card = new ServiceCard(service);
      card.mount(grid);
      this.cards.set(service.id, card);
    });
  }

  private refreshCards(): void {
    const services = store.getServicesByCategory(this.category);

    services.forEach((service) => {
      const existing = this.cards.get(service.id);
      if (existing !== undefined) {
        existing.updateService(service);
      }
    });
  }

  /**
   * Factory method — creates a CategoryView for a given category string.
   */
  public static forCategory(categoryStr: string): CategoryView {
    const category = Object.values(ServiceCategory).find((c) => c === categoryStr);
    return new CategoryView(category ?? ServiceCategory.Performance);
  }
}
