/**
 * ApplyBar — fixed bottom bar showing pending changes count and apply/revert actions.
 */

import { Component } from '../core/Component.js';
import { ProgressBar } from './ProgressBar.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { showToast } from './Toast.js';
import { showRiskConfirmModal } from './Modal.js';
import type { ServiceChange, ApplyProgress } from '../../shared/types.js';
import { ChangeAction, RiskLevel } from '../../shared/types.js';

export class ApplyBar extends Component {
  private progressBar: ProgressBar;
  private isApplying = false;

  constructor() {
    super('div', 'apply-bar hidden');
    this.element.setAttribute('role', 'region');
    this.element.setAttribute('aria-label', 'Pending changes');
    this.progressBar = new ProgressBar();
  }

  protected render(): void {
    this.setHTML(`
      <div class="apply-bar-count" id="apply-bar-count" aria-live="polite">
        <strong>0 changes</strong> pending
      </div>
      <div id="progress-placeholder"></div>
      <div class="apply-bar-actions">
        <button class="btn btn-ghost" id="btn-revert-pending" aria-label="Revert all pending changes">
          Revert
        </button>
        <button class="btn btn-primary" id="btn-apply" aria-label="Apply all pending changes">
          Apply Changes
        </button>
      </div>
    `);
  }

  protected onMount(): void {
    // Mount progress bar
    const progressPlaceholder = this.query('#progress-placeholder');
    this.progressBar.mount(progressPlaceholder);

    // Bind buttons
    const applyBtn = this.query<HTMLButtonElement>('#btn-apply');
    const revertBtn = this.query<HTMLButtonElement>('#btn-revert-pending');

    applyBtn.addEventListener('click', () => {
      void this.handleApply();
    });

    revertBtn.addEventListener('click', () => {
      store.commitChanges();
      showToast('info', 'Pending changes cleared');
    });

    // Listen for pending changes
    const pendingUnsub = store.subscribe('pendingChanges', () => {
      this.updateCount();
    });
    this.addCleanup(pendingUnsub);

    // Also listen for pending tweaks so the bar shows when tweaks are staged
    const pendingTweaksUnsub = store.subscribe('pendingTweaks', () => {
      this.updateCount();
    });
    this.addCleanup(pendingTweaksUnsub);

    // Listen for apply progress — only if API is available
    if (typeof window.peakMacAPI !== 'undefined') {
      window.peakMacAPI.onApplyProgress((progress: ApplyProgress) => {
        this.handleProgress(progress);
      });

      this.addCleanup(() => {
        window.peakMacAPI.offApplyProgress();
      });
    }
  }

  private updateCount(): void {
    const pendingServices = store.get('pendingChanges');
    const pendingTweaks = store.get('pendingTweaks');
    const serviceCount = pendingServices.size;
    const tweakCount = pendingTweaks.size;
    const totalCount = serviceCount + tweakCount;

    const countEl = this.queryOptional('#apply-bar-count');
    if (countEl !== null) {
      const parts: string[] = [];
      if (serviceCount > 0) parts.push(`${serviceCount} service${serviceCount !== 1 ? 's' : ''}`);
      if (tweakCount > 0) parts.push(`${tweakCount} tweak${tweakCount !== 1 ? 's' : ''}`);
      countEl.innerHTML = `<strong>${parts.join(', ')}</strong> pending`;
    }

    if (totalCount > 0) {
      this.element.classList.remove('hidden');
    } else {
      this.element.classList.add('hidden');
    }
  }

  private async handleApply(): Promise<void> {
    if (this.isApplying) return;

    const pending = store.get('pendingChanges');
    if (pending.size === 0 && store.get('pendingTweaks').size === 0) return;

    const services = store.get('services');

    // Check for advanced risk services
    const advancedServices = Array.from(pending.entries())
      .filter(([serviceId]) => {
        const service = services.find((s) => s.id === serviceId);
        return service?.risk === RiskLevel.Advanced;
      })
      .map(([serviceId]) => {
        return services.find((s) => s.id === serviceId)?.name ?? serviceId;
      });

    if (advancedServices.length > 0) {
      showRiskConfirmModal(
        advancedServices,
        () => void this.executeApply(pending),
        () => {},
      );
    } else {
      await this.executeApply(pending);
    }
  }

  private async executeApply(pending: Map<string, ChangeAction>): Promise<void> {
    this.isApplying = true;
    store.set('isApplying', true);

    const applyBtn = this.queryOptional<HTMLButtonElement>('#btn-apply');
    const revertBtn = this.queryOptional<HTMLButtonElement>('#btn-revert-pending');
    const countEl = this.queryOptional('#apply-bar-count');

    if (applyBtn !== null) {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Applying…';
    }
    if (revertBtn !== null) revertBtn.disabled = true;
    if (countEl !== null) countEl.style.display = 'none';

    this.progressBar.show();
    this.progressBar.setProgress(0, 'Starting…', 'running');

    eventBus.emit('apply:start');

    try {
      const pendingServices = store.get('pendingChanges');
      const pendingTweaks = store.get('pendingTweaks');
      const changes: ServiceChange[] = Array.from(pendingServices.entries()).map(([serviceId, action]) => ({
        serviceId,
        action,
      }));

      // Apply services
      let servicesResult: any = { success: true, applied: 0, failed: 0, rolledBack: false, verificationMismatches: [], errors: [] };
      if (changes.length > 0) {
        const result = await window.peakMacAPI.applyChanges(changes);
        if (!result.success) {
          throw new Error(result.error);
        }
        servicesResult = result.data;
      }

      // Apply tweaks
      if (pendingTweaks.size > 0) {
        // Group tweaks by action (apply vs revert)
        const toApply = Array.from(pendingTweaks.entries()).filter(([_, val]) => val).map(([id]) => id);
        const toRevert = Array.from(pendingTweaks.entries()).filter(([_, val]) => !val).map(([id]) => id);

        if (toApply.length > 0) {
          const res = await window.peakMacAPI.applyTweaks(toApply, true);
          if (!res.success) throw new Error(res.error);
        }
        if (toRevert.length > 0) {
          const res = await window.peakMacAPI.applyTweaks(toRevert, false);
          if (!res.success) throw new Error(res.error);
        }
      }

      // Finalize
      store.commitChanges();
      
      // Refresh data
      const [newServices, newTweaks] = await Promise.all([
        window.peakMacAPI.getServices(),
        window.peakMacAPI.getTweaks()
      ]);
      
      if (newServices.success) store.setServices(newServices.data);
      if (newTweaks.success) store.setTweaks(newTweaks.data);

      this.progressBar.setProgress(100, 'Done', 'success');

      setTimeout(() => {
        this.progressBar.hide();
      }, 2000);

      eventBus.emit('apply:done', servicesResult);

      if (
        servicesResult.verificationMismatches !== undefined &&
        servicesResult.verificationMismatches.length > 0
      ) {
        showToast(
          'warning',
          `Applied changes. Note: ${servicesResult.verificationMismatches.length} service(s) may not have changed.`,
          6000,
        );
      } else {
        showToast('success', `Applied changes successfully`);
      }
    } catch (err) {
      this.progressBar.setProgress(100, 'Failed', 'error');
      setTimeout(() => this.progressBar.hide(), 3000);

      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      eventBus.emit('apply:error', errorMsg);
      showToast('error', `Apply failed: ${errorMsg}. Changes rolled back.`);
    } finally {
      this.isApplying = false;
      store.set('isApplying', false);

      if (applyBtn !== null) {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply Changes';
      }
      if (revertBtn !== null) revertBtn.disabled = false;
      if (countEl !== null) countEl.style.display = '';
    }
  }

  private handleProgress(progress: ApplyProgress): void {
    const percent = progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

    const status =
      progress.status === 'success'
        ? 'success'
        : progress.status === 'error' || progress.status === 'rollingback'
          ? 'error'
          : 'running';

    const label =
      progress.status === 'rollingback'
        ? `Rolling back: ${progress.current}`
        : progress.current;

    this.progressBar.setProgress(percent, label, status);
    store.setApplyProgress(progress);
  }
}
