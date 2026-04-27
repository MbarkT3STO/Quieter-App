import { Component } from '../core/Component.js';
import { store } from '../core/Store.js';
import { TweakCard } from '../components/TweakCard.js';
import { TweakCategory } from '../../shared/types.js';

const CATEGORY_META: Record<TweakCategory, { icon: string; description: string }> = {
  [TweakCategory.Visuals]: {
    icon: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>`,
    description: 'Speed up animations and UI transitions',
  },
  [TweakCategory.Maintenance]: {
    icon: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>`,
    description: 'One-off tools to clean up and reclaim resources',
  },
  [TweakCategory.Network]: {
    icon: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`,
    description: 'Fix connectivity issues and flush caches',
  },
  [TweakCategory.Power]: {
    icon: `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>`,
    description: 'Control CPU and battery behavior',
  },
};

export class ToolkitView extends Component {
  constructor() {
    super('div', 'toolkit-view');
  }

  protected render(): void {
    const tweaks = store.get('tweaks');
    const categories = Object.values(TweakCategory);

    // Count applied tweaks for the summary
    const appliedCount = tweaks.filter(t => t.isApplied).length;
    const totalPersistent = tweaks.filter(t => Boolean(t.stateCmd)).length;

    this.setHTML(`
      <div class="page-header">
        <div class="toolkit-header-row">
          <div class="toolkit-header-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/>
            </svg>
          </div>
          <div class="toolkit-header-text">
            <h1 class="page-title">System Toolkit</h1>
            <p class="page-subtitle">Advanced optimizations and maintenance tools for power users</p>
          </div>
          ${totalPersistent > 0 ? `
            <div class="toolkit-header-badge">
              <span class="toolkit-applied-count">${appliedCount}</span>
              <span class="toolkit-applied-label">of ${totalPersistent} applied</span>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="toolkit-grid" role="list">
        ${categories.map(category => {
          const categoryTweaks = tweaks.filter(t => t.category === category);
          if (categoryTweaks.length === 0) return '';

          const meta = CATEGORY_META[category];
          const appliedInCategory = categoryTweaks.filter(t => t.isApplied).length;
          const persistentInCategory = categoryTweaks.filter(t => Boolean(t.stateCmd)).length;

          return `
            <section class="toolkit-section" aria-label="${category} tweaks" role="listitem">
              <div class="toolkit-section-header">
                <div class="toolkit-section-icon" aria-hidden="true">${meta.icon}</div>
                <div class="toolkit-section-info">
                  <h2 class="toolkit-section-title">${category}</h2>
                  <p class="toolkit-section-desc">${meta.description}</p>
                </div>
                ${persistentInCategory > 0 ? `
                  <div class="toolkit-section-status ${appliedInCategory > 0 ? 'has-applied' : ''}">
                    ${appliedInCategory}/${persistentInCategory}
                  </div>
                ` : ''}
              </div>
              <div class="toolkit-cards-grid" id="category-tweaks-${category.toLowerCase()}"></div>
            </section>
          `;
        }).join('')}
      </div>
    `);
  }

  protected onMount(): void {
    this.renderTweaks();

    const unsubTweaks = store.subscribe('tweaks', () => {
      this.render();
      this.renderTweaks();
    });
    this.addCleanup(unsubTweaks);

    const unsubPending = store.subscribe('pendingTweaks', () => {
      this.renderTweaks();
    });
    this.addCleanup(unsubPending);
  }

  private renderTweaks(): void {
    const tweaks = store.get('tweaks');
    const categories = Object.values(TweakCategory);

    categories.forEach(category => {
      const container = this.queryOptional(`#category-tweaks-${category.toLowerCase()}`);
      if (container === null) return;

      container.innerHTML = '';
      const categoryTweaks = tweaks.filter(t => t.category === category);

      categoryTweaks.forEach(tweak => {
        const card = new TweakCard(tweak);
        card.mount(container);
      });
    });
  }
}
