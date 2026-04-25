/**
 * Dashboard view — system stats, CPU sparkline, quick actions, recent changes.
 */

import { Component } from '../core/Component.js';
import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { router } from '../core/Router.js';
import { showToast } from '../components/Toast.js';
import type { SystemStats } from '../../shared/types.js';
import { ChangeAction, RiskLevel, ServiceCategory, ServiceState } from '../../shared/types.js';

const CPU_HISTORY_LENGTH = 30;

export class DashboardView extends Component {
  private cpuHistory: number[] = Array.from<number>({ length: CPU_HISTORY_LENGTH }).fill(0);
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private animFrame: number | null = null;

  constructor() {
    super('div', 'dashboard-view');
  }

  protected render(): void {
    const stats = store.get('systemStats');
    const services = store.get('services');
    const activeCount = services.filter(
      (s) => s.runtimeState.currentState === ServiceState.Enabled,
    ).length;
    const disabledCount = services.filter(
      (s) => s.runtimeState.currentState === ServiceState.Disabled,
    ).length;

    this.setHTML(`
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">System overview and quick actions</p>
      </div>

      <div class="stats-grid" role="region" aria-label="System statistics">
        <div class="stat-card">
          <div class="stat-card-icon cpu" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="stat-card-label">CPU Usage</div>
          <div class="stat-card-value" id="stat-cpu">${stats !== null ? `${stats.cpuUsagePercent}%` : '—'}</div>
          <div class="stat-card-sub">1-min load average</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon ram" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"/>
              <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"/>
              <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"/>
            </svg>
          </div>
          <div class="stat-card-label">RAM Used</div>
          <div class="stat-card-value" id="stat-ram">${stats !== null ? `${stats.ramUsedGB}G` : '—'}</div>
          <div class="stat-card-sub" id="stat-ram-sub">${stats !== null ? `of ${stats.ramTotalGB} GB (${stats.ramUsedPercent}%)` : 'Loading…'}</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon active" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="stat-card-label">Active Services</div>
          <div class="stat-card-value" id="stat-active">${activeCount}</div>
          <div class="stat-card-sub">currently running</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon disabled" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="stat-card-label">Disabled Services</div>
          <div class="stat-card-value" id="stat-disabled">${disabledCount}</div>
          <div class="stat-card-sub">optimized away</div>
        </div>
      </div>

      <div class="sparkline-card" role="region" aria-label="CPU usage history">
        <div class="sparkline-header">
          <span class="sparkline-title">CPU Usage (last 90s)</span>
          <span class="sparkline-value" id="sparkline-value">${stats !== null ? `${stats.cpuUsagePercent}%` : '—'}</span>
        </div>
        <canvas id="cpu-sparkline" aria-label="CPU usage sparkline chart" role="img"></canvas>
      </div>

      <div class="quick-actions" role="region" aria-label="Quick actions">
        <div class="quick-actions-title">Quick Actions</div>
        <div class="quick-actions-grid">
          <button class="btn btn-ghost" id="qa-disable-safe" aria-label="Disable all safe services">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path d="M8 1L1 14h14L8 1z"/>
            </svg>
            Disable All Safe
          </button>
          <button class="btn btn-ghost" id="qa-view-performance" aria-label="View performance services">
            View Performance
          </button>
          <button class="btn btn-ghost" id="qa-view-privacy" aria-label="View privacy services">
            View Privacy
          </button>
        </div>
      </div>

      <div class="recent-changes" role="region" aria-label="Recent changes">
        <div class="recent-changes-title">Pending Changes</div>
        <div id="recent-changes-list">
          <div class="empty-state" style="padding: 24px;">
            <p class="text-muted text-sm">No pending changes</p>
          </div>
        </div>
      </div>
    `);
  }

  protected onMount(): void {
    this.initSparkline();
    this.bindActions();
    this.renderPendingChanges();

    // Update stats
    const statsUnsub = eventBus.on('stats:updated', (stats) => {
      this.updateStats(stats);
    });
    this.addCleanup(statsUnsub);

    // Update pending changes list
    const pendingUnsub = eventBus.on('pending:changed', () => {
      this.renderPendingChanges();
    });
    this.addCleanup(pendingUnsub);

    this.addCleanup(() => {
      if (this.animFrame !== null) cancelAnimationFrame(this.animFrame);
    });
  }

  private initSparkline(): void {
    const canvas = this.queryOptional<HTMLCanvasElement>('#cpu-sparkline');
    if (canvas === null) return;

    // Set canvas size
    const rect = canvas.parentElement?.getBoundingClientRect();
    canvas.width = rect?.width ?? 600;
    canvas.height = 60;

    this.canvasCtx = canvas.getContext('2d');
    this.drawSparkline();
  }

  private drawSparkline(): void {
    const ctx = this.canvasCtx;
    const canvas = this.queryOptional<HTMLCanvasElement>('#cpu-sparkline');
    if (ctx === null || canvas === null) return;

    const w = canvas.width;
    const h = canvas.height;
    const padding = 4;

    ctx.clearRect(0, 0, w, h);

    if (this.cpuHistory.every((v) => v === 0)) {
      return;
    }

    const stepX = (w - padding * 2) / (CPU_HISTORY_LENGTH - 1);
    const maxVal = 100;

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(108, 99, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(108, 99, 255, 0)');

    ctx.beginPath();
    ctx.moveTo(padding, h - padding);

    this.cpuHistory.forEach((val, i) => {
      const x = padding + i * stepX;
      const y = h - padding - ((val / maxVal) * (h - padding * 2));
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.lineTo(w - padding, h - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    this.cpuHistory.forEach((val, i) => {
      const x = padding + i * stepX;
      const y = h - padding - ((val / maxVal) * (h - padding * 2));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = '#6C63FF';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  private updateStats(stats: SystemStats): void {
    // Update CPU history
    this.cpuHistory.push(stats.cpuUsagePercent);
    if (this.cpuHistory.length > CPU_HISTORY_LENGTH) {
      this.cpuHistory.shift();
    }

    // Update DOM
    const cpuEl = this.queryOptional('#stat-cpu');
    const ramEl = this.queryOptional('#stat-ram');
    const ramSubEl = this.queryOptional('#stat-ram-sub');
    const activeEl = this.queryOptional('#stat-active');
    const disabledEl = this.queryOptional('#stat-disabled');
    const sparklineVal = this.queryOptional('#sparkline-value');

    if (cpuEl !== null) cpuEl.textContent = `${stats.cpuUsagePercent}%`;
    if (ramEl !== null) ramEl.textContent = `${stats.ramUsedGB}G`;
    if (ramSubEl !== null) ramSubEl.textContent = `of ${stats.ramTotalGB} GB (${stats.ramUsedPercent}%)`;
    if (activeEl !== null) activeEl.textContent = String(stats.activeServicesCount);
    if (disabledEl !== null) disabledEl.textContent = String(stats.disabledServicesCount);
    if (sparklineVal !== null) sparklineVal.textContent = `${stats.cpuUsagePercent}%`;

    this.drawSparkline();
  }

  private bindActions(): void {
    const disableSafeBtn = this.queryOptional<HTMLButtonElement>('#qa-disable-safe');
    disableSafeBtn?.addEventListener('click', () => {
      const services = store.get('services');
      const safeEnabled = services.filter(
        (s) =>
          s.risk === RiskLevel.Safe &&
          s.runtimeState.currentState === ServiceState.Enabled,
      );

      if (safeEnabled.length === 0) {
        showToast('info', 'No safe services to disable');
        return;
      }

      safeEnabled.forEach((s) => {
        store.togglePendingChange(s.id, ChangeAction.Disable);
      });

      showToast('info', `Marked ${safeEnabled.length} safe services for disabling`);
    });

    const perfBtn = this.queryOptional<HTMLButtonElement>('#qa-view-performance');
    perfBtn?.addEventListener('click', () => {
      router.navigate(`#/category/${ServiceCategory.Performance}`);
    });

    const privacyBtn = this.queryOptional<HTMLButtonElement>('#qa-view-privacy');
    privacyBtn?.addEventListener('click', () => {
      router.navigate(`#/category/${ServiceCategory.Privacy}`);
    });
  }

  private renderPendingChanges(): void {
    const listEl = this.queryOptional('#recent-changes-list');
    if (listEl === null) return;

    const pending = store.get('pendingChanges');
    const services = store.get('services');

    if (pending.size === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <p class="text-muted text-sm">No pending changes</p>
        </div>
      `;
      return;
    }

    const items = Array.from(pending.entries()).map(([serviceId, action]) => {
      const service = services.find((s) => s.id === serviceId);
      const name = service?.name ?? serviceId;
      return `
        <div class="recent-change-item">
          <span class="recent-change-action ${action}">${action}</span>
          <span class="recent-change-name">${name}</span>
          <button
            class="btn btn-ghost"
            style="padding: 2px 8px; font-size: 11px;"
            data-undo="${serviceId}"
            aria-label="Undo change for ${name}"
          >Undo</button>
        </div>
      `;
    });

    listEl.innerHTML = items.join('');

    // Bind undo buttons
    listEl.querySelectorAll<HTMLButtonElement>('[data-undo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const serviceId = btn.dataset['undo'];
        if (serviceId !== undefined) {
          const action = pending.get(serviceId);
          if (action !== undefined) {
            store.togglePendingChange(serviceId, action);
          }
        }
      });
    });
  }
}
