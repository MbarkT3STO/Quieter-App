/**
 * Toast notification system.
 * Manages a stack of toast messages with auto-dismiss.
 */

import { Component } from '../core/Component.js';
import { eventBus, type ToastEvent } from '../core/EventBus.js';

const ICONS: Record<ToastEvent['type'], string> = {
  success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
  error: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
  warning: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
  info: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
};

const CLOSE_ICON = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>`;

export class ToastContainer extends Component {
  private static instance: ToastContainer;

  private constructor() {
    super('div', 'toast-container');
    this.element.setAttribute('role', 'region');
    this.element.setAttribute('aria-label', 'Notifications');
    this.element.setAttribute('aria-live', 'polite');
  }

  public static getInstance(): ToastContainer {
    if (ToastContainer.instance === undefined) {
      ToastContainer.instance = new ToastContainer();
    }
    return ToastContainer.instance;
  }

  protected render(): void {}

  protected onMount(): void {
    const unsub = eventBus.on('toast:show', (event) => {
      this.show(event);
    });
    this.addCleanup(unsub);
  }

  /**
   * Show a toast notification.
   */
  public show(event: ToastEvent): void {
    const { type, message, duration = 4000 } = event;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${ICONS[type]}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Dismiss notification">
        ${CLOSE_ICON}
      </button>
    `;

    const dismiss = (): void => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    };

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn?.addEventListener('click', dismiss);

    this.element.appendChild(toast);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }
}

/** Convenience function to show a toast */
export function showToast(type: ToastEvent['type'], message: string, duration?: number): void {
  const event: ToastEvent = duration !== undefined
    ? { type, message, duration }
    : { type, message };
  eventBus.emit('toast:show', event);
}
