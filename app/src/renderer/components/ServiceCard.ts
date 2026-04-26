/**
 * ServiceCard component — displays a single service with toggle and details.
 */

import { Component } from '../core/Component.js';
import { Toggle } from './Toggle.js';
import { Badge } from './Badge.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import type { ServiceWithState } from '../../shared/types.js';
import { ServiceState, ChangeAction } from '../../shared/types.js';

const CATEGORY_ICONS: Record<string, string> = {
  Performance: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>`,
  Network: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`,
  Visuals: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>`,
  Privacy: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
  Sync: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>`,
  Misc: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/></svg>`,
};

export class ServiceCard extends Component {
  private service: ServiceWithState;
  private toggle: Toggle | null = null;
  private badge: Badge | null = null;
  private descExpanded = false;
  private effectsVisible = false;

  constructor(service: ServiceWithState) {
    super('article', 'service-card');
    this.service = service;
    this.element.setAttribute('data-service-id', service.id);
  }

  protected render(): void {
    const { service } = this;
    const pending = store.get('pendingChanges').get(service.id);
    const currentState = service.runtimeState.currentState;
    const isEnabled = currentState === ServiceState.Enabled;
    const isPending = pending !== undefined;

    if (isPending) {
      this.element.classList.add('pending-change');
    } else {
      this.element.classList.remove('pending-change');
    }

    const stateLabel =
      currentState === ServiceState.Enabled
        ? 'Active'
        : currentState === ServiceState.Disabled
          ? 'Disabled'
          : 'Unknown';

    const stateDotClass =
      currentState === ServiceState.Enabled
        ? 'enabled'
        : currentState === ServiceState.Disabled
          ? 'disabled'
          : 'unknown';

    const categoryIcon = CATEGORY_ICONS[service.category] ?? '';

    this.setHTML(`
      <div class="service-card-header">
        <div class="service-card-title-row">
          <span class="service-card-icon-wrap" aria-hidden="true">
            <span class="service-card-icon">${categoryIcon}</span>
          </span>
          <span class="service-card-name">${service.name}</span>
        </div>
        <div class="badge-placeholder"></div>
      </div>

      <div class="service-card-body">
        <div class="service-card-meta">
          <span class="service-card-category">${service.category}</span>
          ${service.requiresSip === true && store.get('sipActive') && service.sipAlternative === undefined ? `
            <span class="badge badge-sip" title="Requires SIP disabled — boot into Recovery Mode and run 'csrutil disable' to manage this service">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM7.25 5v4.5h1.5V5h-1.5zm0 5.5V12h1.5v-1.5h-1.5z"/>
              </svg>
              SIP Locked
            </span>` : ''}
          ${service.requiresSip === true && store.get('sipActive') && service.sipAlternative !== undefined ? `
            <span class="badge badge-sip-alt" title="${service.sipAlternative.mechanism}">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM7.25 5v4.5h1.5V5h-1.5zm0 5.5V12h1.5v-1.5h-1.5z"/>
              </svg>
              SIP Alternative
            </span>` : ''}
          ${service.requiresSip === true && !store.get('sipActive') ? `
            <span class="badge badge-safe" title="SIP is disabled — you can fully manage this service">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM7.25 5v4.5h1.5V5h-1.5zm0 5.5V12h1.5v-1.5h-1.5z"/>
              </svg>
              SIP Unlocked
            </span>` : ''}
          ${service.requiresAdmin ? '<span class="badge badge-moderate" title="Requires admin">Admin</span>' : ''}
          ${service.requiresRestart ? '<span class="badge badge-moderate" title="Requires restart">Restart</span>' : ''}
        </div>

        <div class="service-card-impact" aria-label="Performance impact">
          <div class="impact-item">
            <span>CPU</span>
            <div class="impact-bar-track" role="meter" aria-label="CPU impact: ${service.impact.cpu}">
              <div class="impact-bar-fill ${service.impact.cpu}"></div>
            </div>
          </div>
          <div class="impact-item">
            <span>RAM</span>
            <div class="impact-bar-track" role="meter" aria-label="RAM impact: ${service.impact.ram}">
              <div class="impact-bar-fill ${service.impact.ram}"></div>
            </div>
          </div>
        </div>

        <div>
          <p class="service-card-description${this.descExpanded ? ' expanded' : ''}">${service.description}</p>
          <button class="service-card-expand-btn" aria-expanded="${this.descExpanded}">
            ${this.descExpanded ? 'Show less' : 'Show more'}
          </button>
        </div>

        <div class="service-card-effects${this.effectsVisible ? ' visible' : ''}">
        <div class="effect-item">
          <span class="effect-icon gain" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1l1.5 3h3l-2.5 2 1 3L6 7.5 3 9l1-3L1.5 4h3z"/>
            </svg>
          </span>
          <span class="effect-text"><strong>Gain:</strong> ${service.disableEffect}</span>
        </div>
        <div class="effect-item">
          <span class="effect-icon lose" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm-.5 3h1v3h-1V4zm0 4h1v1h-1V8z"/>
            </svg>
          </span>
          <span class="effect-text"><strong>Lose:</strong> ${service.enableEffect}</span>
        </div>
        <button class="service-card-expand-btn effects-toggle" aria-expanded="${this.effectsVisible}">
          Hide details
        </button>
      </div>

      ${!this.effectsVisible ? `
        <button class="service-card-expand-btn effects-show" aria-expanded="false">
          Show effects
        </button>
      ` : ''}

      </div><!-- end service-card-body -->

      <div class="service-card-footer">
        <div class="service-card-state">
          <span class="state-dot ${stateDotClass}" aria-hidden="true"></span>
          <span>Currently: ${stateLabel}</span>
          ${isPending ? `<span class="pending-badge">${pending === ChangeAction.Disable ? '→ Disable' : '→ Enable'}</span>` : ''}
        </div>
        <div class="toggle-placeholder"></div>
      </div>
    `);

    // Mount badge
    const badgePlaceholder = this.query('.badge-placeholder');
    this.badge = new Badge(service.risk);
    this.badge.mount(badgePlaceholder);

    // Mount toggle
    const togglePlaceholder = this.query('.toggle-placeholder');
    const toggleChecked = isPending
      ? pending === ChangeAction.Enable
      : isEnabled;

    // Only lock toggle if SIP is active, service is SIP-protected, and has no alternative command
    const isSipLocked = store.get('sipActive') && service.requiresSip === true && service.sipAlternative === undefined;
    this.toggle = new Toggle({
      checked: toggleChecked,
      disabled: isSipLocked,
      label: `Toggle ${service.name}`,
      onChange: isSipLocked
        ? () => { /* no-op: SIP protected with no alternative */ }
        : (checked) => {
            const action = checked ? ChangeAction.Enable : ChangeAction.Disable;
            store.togglePendingChange(service.id, action);
          },
    });
    this.toggle.mount(togglePlaceholder);
  }

  protected onMount(): void {
    this.attachCardListeners();

    // Listen for pending changes — use eventBus (one listener per card, not store subscription)
    const unsub = eventBus.on('pending:changed', (pending) => {
      const p = pending.get(this.service.id);
      const isPending = p !== undefined;
      this.element.classList.toggle('pending-change', isPending);

      const isEnabled = this.service.runtimeState.currentState === ServiceState.Enabled;
      this.toggle?.setChecked(isPending ? p === ChangeAction.Enable : isEnabled);

      const stateEl = this.queryOptional('.service-card-state');
      if (stateEl !== null) {
        stateEl.querySelector('.pending-badge')?.remove();
        if (isPending) {
          const badge = document.createElement('span');
          badge.className = 'pending-badge';
          badge.textContent = p === ChangeAction.Disable ? '→ Disable' : '→ Enable';
          stateEl.appendChild(badge);
        }
      }
    });
    this.addCleanup(unsub);
  }

  /**
   * Update the service data and re-render without leaking listeners.
   * Only re-renders if the state actually changed.
   */
  public updateService(service: ServiceWithState): void {
    const prevState = this.service.runtimeState.currentState;
    this.service = service;

    // Only do a full re-render if the runtime state changed
    if (service.runtimeState.currentState !== prevState) {
      this.toggle?.unmount();
      this.badge?.unmount();
      this.render();
      // onMount is called by Component.mount() — call it manually here since
      // we're updating in-place (not remounting)
      this.attachCardListeners();
    }
  }

  /**
   * Attach card-level event listeners. Called once on mount and on state change re-render.
   */
  private attachCardListeners(): void {
    const expandBtn = this.queryOptional<HTMLButtonElement>('.service-card-expand-btn:not(.effects-toggle):not(.effects-show)');
    expandBtn?.addEventListener('click', () => {
      this.descExpanded = !this.descExpanded;
      const desc = this.queryOptional('.service-card-description');
      desc?.classList.toggle('expanded', this.descExpanded);
      if (expandBtn !== null) {
        expandBtn.textContent = this.descExpanded ? 'Show less' : 'Show more';
        expandBtn.setAttribute('aria-expanded', String(this.descExpanded));
      }
    });

    const showEffectsBtn = this.queryOptional<HTMLButtonElement>('.effects-show');
    showEffectsBtn?.addEventListener('click', () => {
      this.effectsVisible = true;
      this.queryOptional('.service-card-effects')?.classList.add('visible');
      showEffectsBtn.remove();
    });

    const hideEffectsBtn = this.queryOptional<HTMLButtonElement>('.effects-toggle');
    hideEffectsBtn?.addEventListener('click', () => {
      this.effectsVisible = false;
      this.queryOptional('.service-card-effects')?.classList.remove('visible');
      const footer = this.queryOptional('.service-card-footer');
      if (footer !== null) {
        const showBtn = document.createElement('button');
        showBtn.className = 'service-card-expand-btn effects-show';
        showBtn.setAttribute('aria-expanded', 'false');
        showBtn.textContent = 'Show effects';
        showBtn.addEventListener('click', () => {
          this.effectsVisible = true;
          this.queryOptional('.service-card-effects')?.classList.add('visible');
          showBtn.remove();
        });
        footer.parentElement?.insertBefore(showBtn, footer);
      }
    });
  }
}
