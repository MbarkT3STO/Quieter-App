/**
 * Typed pub/sub event bus — singleton.
 * Decouples components from each other.
 */

import type { ServiceChange, ApplyProgress, SystemStats } from '../../shared/types.js';

// ─── Event Map ────────────────────────────────────────────────────────────────

export interface AppEvents {
  'services:loaded': void;
  'services:error': string;
  'pending:changed': Map<string, import('../../shared/types.js').ChangeAction>;
  'apply:start': void;
  'apply:progress': ApplyProgress;
  'apply:done': import('../../shared/types.js').ApplyResult;
  'apply:error': string;
  'stats:updated': SystemStats;
  'search:changed': string;
  'category:changed': import('../../shared/types.js').ServiceCategory | 'all';
  'route:changed': string;
  'page:title': string;
  'sidebar:toggled': boolean;
  'settings:saved': void;
  'revert:done': void;
  'toast:show': ToastEvent;
}

export interface ToastEvent {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

type EventHandler<T> = T extends void ? () => void : (data: T) => void;

// ─── EventBus Class ───────────────────────────────────────────────────────────

class EventBus {
  private static instance: EventBus;
  private readonly listeners = new Map<string, Set<EventHandler<unknown>>>();

  private constructor() {}

  /** Get the singleton EventBus instance */
  public static getInstance(): EventBus {
    if (EventBus.instance === undefined) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Subscribe to an event.
   * @returns Unsubscribe function
   */
  public on<K extends keyof AppEvents>(
    event: K,
    handler: EventHandler<AppEvents[K]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const handlers = this.listeners.get(event);
    handlers?.add(handler as EventHandler<unknown>);

    return () => {
      handlers?.delete(handler as EventHandler<unknown>);
    };
  }

  /**
   * Subscribe to an event once — auto-unsubscribes after first call.
   */
  public once<K extends keyof AppEvents>(
    event: K,
    handler: EventHandler<AppEvents[K]>,
  ): void {
    const unsub = this.on(event, ((...args: unknown[]) => {
      unsub();
      (handler as (...a: unknown[]) => void)(...args);
    }) as EventHandler<AppEvents[K]>);
  }

  /**
   * Emit an event to all subscribers.
   */
  public emit<K extends keyof AppEvents>(
    event: K,
    ...args: AppEvents[K] extends void ? [] : [AppEvents[K]]
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers === undefined) return;

    for (const handler of handlers) {
      (handler as (...a: unknown[]) => void)(...args);
    }
  }

  /**
   * Remove all listeners for an event.
   */
  public off(event: keyof AppEvents): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all listeners for all events.
   */
  public clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = EventBus.getInstance();
