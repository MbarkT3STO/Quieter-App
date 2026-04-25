/**
 * ProgressBar component — animated progress indicator.
 */

import { Component } from '../core/Component.js';

export class ProgressBar extends Component {
  private percent = 0;
  private label = '';
  private status: 'running' | 'success' | 'error' = 'running';

  constructor() {
    super('div', 'progress-bar-container');
  }

  protected render(): void {
    this.setHTML(`
      <div class="progress-bar-label">
        <span class="progress-label-text"></span>
        <span class="progress-label-percent"></span>
      </div>
      <div class="progress-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar-fill"></div>
      </div>
    `);
  }

  /**
   * Update the progress bar state.
   */
  public setProgress(percent: number, label: string, status: 'running' | 'success' | 'error'): void {
    this.percent = Math.min(100, Math.max(0, percent));
    this.label = label;
    this.status = status;
    this.updateDOM();
  }

  private updateDOM(): void {
    const fill = this.queryOptional<HTMLElement>('.progress-bar-fill');
    const labelText = this.queryOptional<HTMLElement>('.progress-label-text');
    const labelPercent = this.queryOptional<HTMLElement>('.progress-label-percent');
    const track = this.queryOptional<HTMLElement>('.progress-bar-track');

    if (fill !== null) {
      fill.style.width = `${this.percent}%`;
      fill.className = `progress-bar-fill ${this.status === 'running' ? '' : this.status}`;
    }

    if (labelText !== null) {
      labelText.textContent = this.label;
    }

    if (labelPercent !== null) {
      labelPercent.textContent = `${this.percent}%`;
    }

    if (track !== null) {
      track.setAttribute('aria-valuenow', String(this.percent));
    }
  }

  /**
   * Show the progress bar.
   */
  public show(): void {
    this.element.classList.add('visible');
  }

  /**
   * Hide the progress bar.
   */
  public hide(): void {
    this.element.classList.remove('visible');
  }
}
