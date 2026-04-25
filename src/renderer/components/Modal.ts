/**
 * Modal component — accessible dialog with backdrop.
 */

import { Component } from '../core/Component.js';

export interface ModalOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClass?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export class Modal extends Component {
  private readonly options: ModalOptions;

  constructor(options: ModalOptions) {
    super('div', 'modal-backdrop');
    this.options = options;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'modal-title');
  }

  protected render(): void {
    const {
      title,
      body,
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      confirmClass = 'btn btn-primary',
    } = this.options;

    this.setHTML(`
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="modal-title">${title}</h2>
          <button class="modal-close" aria-label="Close dialog">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">
          <button class="btn btn-ghost modal-cancel">${cancelLabel}</button>
          <button class="${confirmClass} modal-confirm">${confirmLabel}</button>
        </div>
      </div>
    `);
  }

  protected onMount(): void {
    const closeBtn = this.query('.modal-close');
    const cancelBtn = this.query('.modal-cancel');
    const confirmBtn = this.query('.modal-confirm');

    const close = (): void => this.unmount();

    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', () => {
      this.options.onCancel?.();
      close();
    });
    confirmBtn.addEventListener('click', () => {
      this.options.onConfirm?.();
      close();
    });

    // Close on backdrop click
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.options.onCancel?.();
        close();
      }
    });

    // Close on Escape
    const keyHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        this.options.onCancel?.();
        close();
      }
    };
    document.addEventListener('keydown', keyHandler);
    this.addCleanup(() => document.removeEventListener('keydown', keyHandler));

    // Focus the confirm button
    confirmBtn.focus();
  }

  /**
   * Show the modal by mounting it to document.body.
   */
  public show(): void {
    this.mount(document.body);
  }
}

/**
 * Show a confirmation modal for advanced/risky service changes.
 */
export function showRiskConfirmModal(
  serviceNames: string[],
  onConfirm: () => void,
  onCancel: () => void,
): void {
  const warningItems = serviceNames
    .map(
      (name) => `
      <div class="modal-warning-item">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1L1 14h14L8 1zm0 2.5l5.5 9.5H2.5L8 3.5zM7.25 7v3h1.5V7h-1.5zm0 4v1.5h1.5V11h-1.5z"/>
        </svg>
        ${name}
      </div>
    `,
    )
    .join('');

  const modal = new Modal({
    title: 'Advanced Services Warning',
    body: `
      <p>The following services are marked <strong>Advanced</strong> risk. Disabling them may cause system instability or loss of critical functionality.</p>
      <div class="modal-warning-list">${warningItems}</div>
      <p style="margin-top: 12px;">Are you sure you want to proceed?</p>
    `,
    confirmLabel: 'Proceed Anyway',
    cancelLabel: 'Cancel',
    confirmClass: 'btn btn-danger',
    onConfirm,
    onCancel,
  });

  modal.show();
}

/**
 * Show the onboarding modal for first-time users.
 */
export function showOnboardingModal(onDone: () => void): void {
  const modal = new Modal({
    title: 'Welcome to Quieter',
    body: `
      <p>Quieter helps you reclaim performance on your Mac by selectively managing background services.</p>
      <br/>
      <p><strong>How it works:</strong></p>
      <ul style="margin-top: 8px; padding-left: 16px; display: flex; flex-direction: column; gap: 6px; list-style: disc;">
        <li style="color: var(--color-text-secondary); font-size: 13px;">Browse services and read what each one does</li>
        <li style="color: var(--color-text-secondary); font-size: 13px;">Toggle services to mark them as pending</li>
        <li style="color: var(--color-text-secondary); font-size: 13px;">Click <strong>Apply Changes</strong> to apply — nothing changes until then</li>
        <li style="color: var(--color-text-secondary); font-size: 13px;">Use <strong>Revert All</strong> in Settings to restore everything</li>
      </ul>
      <br/>
      <p style="color: var(--color-warning); font-size: 12px;">
        ⚠ A backup snapshot will be created automatically before any changes are applied.
      </p>
    `,
    confirmLabel: 'Get Started',
    cancelLabel: 'Learn More',
    onConfirm: onDone,
    onCancel: () => {
      window.open('https://github.com/MbarkT3STO/Quieter-App#readme', '_blank');
      onDone();
    },
  });

  modal.show();
}
