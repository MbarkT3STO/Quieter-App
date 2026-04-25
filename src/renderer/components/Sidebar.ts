/**
 * Sidebar navigation component — collapsible.
 * Collapsed state is persisted in localStorage.
 * When collapsed, shows icon-only rail (52px) with CSS tooltips.
 * Emits 'sidebar:toggled' on the eventBus so other components can react.
 */

import { Component } from '../core/Component.js';
import { router } from '../core/Router.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { ServiceCategory } from '../../shared/types.js';

const STORAGE_KEY = 'peakmac:sidebar-collapsed';

const COLLAPSED_WIDTH = '52px';
const EXPANDED_WIDTH = 'var(--sidebar-width)';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '#/dashboard',
    label: 'Dashboard',
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>`,
  },
  {
    path: '#/services',
    label: 'All Services',
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`,
  },
];

const CATEGORY_ITEMS: NavItem[] = [
  {
    path: `#/category/${ServiceCategory.Performance}`,
    label: 'Performance',
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>`,
  },
  {
    path: `#/category/${ServiceCategory.Network}`,
    label: 'Network',
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`,
  },
  {
    path: `#/category/${ServiceCategory.Visuals}`,
    label: 'Visuals',
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>`,
  },
  {
    path: `#/category/${ServiceCategory.Privacy}`,
    label: 'Privacy',
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
  },
  {
    path: `#/category/${ServiceCategory.Sync}`,
    label: 'Sync',
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>`,
  },
  {
    path: `#/category/${ServiceCategory.Misc}`,
    label: 'Misc',
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/></svg>`,
  },
  {
    path: '#/settings',
    label: 'Settings',
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>`,
  },
];

// Chevron-left icon for the toggle button
const CHEVRON_ICON = `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
  <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
</svg>`;

export class Sidebar extends Component {
  private currentPath = '';
  private collapsed: boolean;

  constructor() {
    super('aside', 'sidebar');
    this.element.setAttribute('role', 'navigation');
    this.element.setAttribute('aria-label', 'Main navigation');

    // Restore persisted state
    this.collapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    // Apply immediately (before render) to avoid layout flash
    this.applyCollapsedClass(false);
  }

  protected render(): void {
    this.setHTML(`
      <!-- Toggle button -->
      <div class="sidebar-toggle">
        <button
          class="sidebar-toggle-btn"
          id="sidebar-toggle-btn"
          aria-label="${this.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
          title="${this.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
        >
          ${CHEVRON_ICON}
        </button>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">Menu</div>
        ${NAV_ITEMS.map((item) => this.renderNavItem(item)).join('')}

        <div class="sidebar-section-label" style="margin-top: 8px;">Categories</div>
        ${CATEGORY_ITEMS.map((item) => this.renderNavItem(item)).join('')}
      </nav>

      <!-- Stats widget -->
      <div class="sidebar-stats" aria-label="System stats">
        <div class="sidebar-stat-row" title="CPU usage">
          <span class="sidebar-stat-dot neutral" id="sidebar-cpu-dot" aria-hidden="true"></span>
          <span class="sidebar-stat-label">CPU</span>
          <span class="sidebar-stat-value" id="sidebar-cpu">—</span>
        </div>
        <div class="sidebar-stat-row" title="RAM usage">
          <span class="sidebar-stat-dot neutral" id="sidebar-ram-dot" aria-hidden="true"></span>
          <span class="sidebar-stat-label">RAM</span>
          <span class="sidebar-stat-value" id="sidebar-ram">—</span>
        </div>
        <div class="sidebar-stat-row" title="Active services">
          <span class="sidebar-stat-dot neutral" id="sidebar-active-dot" aria-hidden="true"></span>
          <span class="sidebar-stat-label">Active</span>
          <span class="sidebar-stat-value" id="sidebar-active">—</span>
        </div>
      </div>
    `);
  }

  private renderNavItem(item: NavItem): string {
    const isActive = this.currentPath === item.path;
    return `
      <a
        href="${item.path}"
        class="sidebar-item${isActive ? ' active' : ''}"
        aria-current="${isActive ? 'page' : 'false'}"
        data-path="${item.path}"
        data-label="${item.label}"
        title="${item.label}"
      >
        <span class="sidebar-item-icon" aria-hidden="true">${item.icon}</span>
        <span class="sidebar-item-label">${item.label}</span>
      </a>
    `;
  }

  protected onMount(): void {
    // Toggle button
    const toggleBtn = this.query<HTMLButtonElement>('#sidebar-toggle-btn');
    toggleBtn.addEventListener('click', () => {
      this.toggle();
    });

    // Nav clicks
    this.element.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-path]') as HTMLElement | null;
      if (target === null) return;
      e.preventDefault();
      const path = target.dataset['path'];
      if (path !== undefined) {
        router.navigate(path);
      }
    });

    // Route changes
    const routeUnsub = eventBus.on('route:changed', (path) => {
      this.updateActiveState(path);
    });
    this.addCleanup(routeUnsub);

    // Stats updates
    const statsUnsub = eventBus.on('stats:updated', (stats) => {
      this.updateStats(stats);
    });
    this.addCleanup(statsUnsub);

    // Set initial state
    this.updateActiveState(router.getCurrentPath());
    const stats = store.get('systemStats');
    if (stats !== null) {
      this.updateStats(stats);
    }
  }

  /**
   * Toggle collapsed/expanded state.
   */
  private toggle(): void {
    this.collapsed = !this.collapsed;
    localStorage.setItem(STORAGE_KEY, String(this.collapsed));
    this.applyCollapsedClass(true);
    this.updateToggleBtn();
  }

  /**
   * Apply or remove the collapsed class and update the CSS variable.
   * @param animate - whether to allow CSS transitions (false on first paint)
   */
  private applyCollapsedClass(animate: boolean): void {
    if (!animate) {
      // Suppress transition on initial paint
      this.element.style.transition = 'none';
    }

    this.element.classList.toggle('collapsed', this.collapsed);

    // Update the CSS variable on <html> so topbar, main, apply-bar all shift
    const width = this.collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    document.documentElement.style.setProperty('--sidebar-current-width', width);

    if (!animate) {
      // Re-enable transitions after one frame
      requestAnimationFrame(() => {
        this.element.style.transition = '';
      });
    }
  }

  private updateToggleBtn(): void {
    const btn = this.queryOptional<HTMLButtonElement>('#sidebar-toggle-btn');
    if (btn === null) return;
    const label = this.collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }

  private updateActiveState(path: string): void {
    this.currentPath = path;
    const items = this.queryAll<HTMLElement>('.sidebar-item');
    items.forEach((item) => {
      const itemPath = item.dataset['path'] ?? '';
      const isActive = itemPath === path;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  private updateStats(stats: import('../../shared/types.js').SystemStats): void {
    const cpuEl = this.queryOptional<HTMLElement>('#sidebar-cpu');
    const ramEl = this.queryOptional<HTMLElement>('#sidebar-ram');
    const activeEl = this.queryOptional<HTMLElement>('#sidebar-active');
    const cpuDot = this.queryOptional<HTMLElement>('#sidebar-cpu-dot');
    const ramDot = this.queryOptional<HTMLElement>('#sidebar-ram-dot');
    const activeDot = this.queryOptional<HTMLElement>('#sidebar-active-dot');

    const cpuClass = stats.cpuUsagePercent > 80 ? 'bad' : stats.cpuUsagePercent > 50 ? 'warn' : 'good';
    const ramClass = stats.ramUsedPercent > 85 ? 'bad' : stats.ramUsedPercent > 65 ? 'warn' : 'good';

    if (cpuEl !== null) {
      cpuEl.textContent = `${stats.cpuUsagePercent}%`;
      cpuEl.className = `sidebar-stat-value ${cpuClass}`;
    }
    if (ramEl !== null) {
      ramEl.textContent = `${stats.ramUsedGB}/${stats.ramTotalGB}G`;
      ramEl.className = `sidebar-stat-value ${ramClass}`;
    }
    if (activeEl !== null) {
      activeEl.textContent = String(stats.activeServicesCount);
    }

    // Update dots (visible when collapsed)
    if (cpuDot !== null) cpuDot.className = `sidebar-stat-dot ${cpuClass}`;
    if (ramDot !== null) ramDot.className = `sidebar-stat-dot ${ramClass}`;
    if (activeDot !== null) activeDot.className = `sidebar-stat-dot neutral`;
  }
}
