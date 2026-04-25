/**
 * Toggle switch component — CSS-only animation, accessible.
 */

import { Component } from '../core/Component.js';

interface ToggleOptions {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

export class Toggle extends Component {
  private options: ToggleOptions;
  private inputEl: HTMLInputElement | null = null;

  constructor(options: ToggleOptions) {
    super('label', 'toggle');
    this.options = options;
  }

  protected render(): void {
    const { checked, disabled = false, label } = this.options;

    if (disabled) {
      this.element.classList.add('disabled');
    } else {
      this.element.classList.remove('disabled');
    }

    this.setHTML(`
      <input
        type="checkbox"
        ${checked ? 'checked' : ''}
        ${disabled ? 'disabled' : ''}
        aria-label="${label}"
        role="switch"
        aria-checked="${checked}"
      />
      <span class="toggle-track" aria-hidden="true"></span>
      <span class="toggle-thumb" aria-hidden="true"></span>
    `);

    this.inputEl = this.query<HTMLInputElement>('input');
  }

  protected onMount(): void {
    this.attachListener();
  }

  private attachListener(): void {
    if (this.inputEl === null) return;

    const handler = (e: Event): void => {
      const input = e.target as HTMLInputElement;
      this.options.onChange(input.checked);
    };

    this.inputEl.addEventListener('change', handler);
    this.addCleanup(() => this.inputEl?.removeEventListener('change', handler));
  }

  /**
   * Update the toggle state without re-rendering.
   */
  public setChecked(checked: boolean): void {
    this.options = { ...this.options, checked };
    if (this.inputEl !== null) {
      this.inputEl.checked = checked;
      this.inputEl.setAttribute('aria-checked', String(checked));
    }
  }

  /**
   * Enable or disable the toggle.
   */
  public setDisabled(disabled: boolean): void {
    this.options = { ...this.options, disabled };
    if (this.inputEl !== null) {
      this.inputEl.disabled = disabled;
    }
    if (disabled) {
      this.element.classList.add('disabled');
    } else {
      this.element.classList.remove('disabled');
    }
  }
}
