import { Component } from '../core/Component.js';
import { store } from '../core/Store.js';
import { Toggle } from './Toggle.js';
import { showToast } from './Toast.js';
import { TweakWithState } from '../../shared/types.js';

export class TweakCard extends Component {
  private tweak: TweakWithState;
  private toggle?: Toggle;

  constructor(tweak: TweakWithState) {
    super('div', 'service-card');
    this.tweak = tweak;
  }

  protected render(): void {
    const tweak = this.tweak;
    const isAction = !tweak.stateCmd;
    const pending = store.get('pendingTweaks').get(tweak.id);
    const effectiveState = pending !== undefined ? pending : tweak.isApplied;
    const isPending = pending !== undefined;

    // Visual state classes
    this.element.classList.toggle('tweak-card-action', isAction);
    this.element.classList.toggle('pending-change', isPending);

    const stateLabel = isAction ? 'Action' : effectiveState ? 'Applied' : 'Default';
    const stateDotClass = isAction ? 'unknown' : effectiveState ? 'enabled' : 'disabled';

    this.setHTML(`
      <div class="service-card-header">
        <div class="service-card-title-row">
          <span class="service-card-icon-wrap" aria-hidden="true">
            <span class="service-card-icon">
              ${isAction
                ? `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>`
                : `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>`
              }
            </span>
          </span>
          <span class="service-card-name">${tweak.name}</span>
        </div>
        <div id="tweak-control-${tweak.id}"></div>
      </div>

      <div class="service-card-body">
        <div class="service-card-meta">
          <span class="service-card-category">${tweak.category}</span>
          ${tweak.requiresAdmin ? '<span class="badge badge-moderate" title="Requires admin (sudo)">Admin</span>' : ''}
          ${tweak.relaunchProcess !== undefined ? `<span class="badge badge-sip-alt" title="Relaunches ${tweak.relaunchProcess}">Relaunch</span>` : ''}
          ${isPending ? '<span class="pending-badge">Pending</span>' : ''}
        </div>
        <p class="service-card-description">${tweak.description}</p>
        <div class="service-card-impact">
          <span class="impact-item">
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Mechanism: </span>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${tweak.mechanism}</span>
          </span>
        </div>
      </div>

      ${!isAction ? `
        <div class="service-card-footer">
          <div class="service-card-state">
            <span class="state-dot ${stateDotClass}" aria-hidden="true"></span>
            ${stateLabel}
          </div>
        </div>
      ` : ''}
    `);
  }

  protected onMount(): void {
    const tweak = this.tweak;
    const controlEl = this.queryOptional<HTMLElement>(`#tweak-control-${tweak.id}`);
    if (controlEl === null) return;

    if (!tweak.stateCmd) {
      // One-off action (e.g. RAM purge)
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-sm';
      btn.style.cssText = 'padding: 5px 12px; font-size: 12px; flex-shrink: 0;';
      btn.textContent = 'Run Now';
      btn.addEventListener('click', () => { void this.handleAction(btn); });
      controlEl.appendChild(btn);
    } else {
      // Persistent tweak — use a toggle
      const pending = store.get('pendingTweaks').get(tweak.id);
      const isApplied = pending !== undefined ? pending : tweak.isApplied;

      this.toggle = new Toggle({
        checked: isApplied,
        label: `Toggle ${tweak.name}`,
        onChange: (checked) => {
          if (checked === tweak.isApplied) {
            store.setPendingTweak(tweak.id, null);
          } else {
            store.setPendingTweak(tweak.id, checked);
          }
        },
      });
      this.toggle.mount(controlEl);
    }
  }

  private async handleAction(btn: HTMLButtonElement): Promise<void> {
    btn.disabled = true;
    btn.textContent = 'Running…';

    try {
      const result = await window.peakMacAPI.runAction(this.tweak.id);
      if (result.success) {
        btn.textContent = '✓ Done';
        btn.classList.replace('btn-primary', 'btn-success');
        showToast('success', `${this.tweak.name} completed successfully`);
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'Run Now';
          btn.classList.replace('btn-success', 'btn-primary');
        }, 3000);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Failed';
      btn.classList.replace('btn-primary', 'btn-danger');
      showToast('error', `${this.tweak.name} failed`);
      console.error('Tweak action failed:', err);
      setTimeout(() => {
        btn.textContent = 'Run Now';
        btn.classList.replace('btn-danger', 'btn-primary');
      }, 3000);
    }
  }
}
