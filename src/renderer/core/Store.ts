/**
 * Reactive state store — singleton, observer pattern.
 * Single source of truth for all UI state.
 */

import type { AppState, ServiceWithState, SystemStats, AppSettings, ApplyProgress } from '../../shared/types.js';
import { ChangeAction, ServiceCategory } from '../../shared/types.js';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import { eventBus } from './EventBus.js';

type StateListener<K extends keyof AppState> = (value: AppState[K], prev: AppState[K]) => void;

class Store {
  private static instance: Store;

  private state: AppState = {
    services: [],
    pendingChanges: new Map(),
    systemStats: null,
    isLoading: false,
    isApplying: false,
    applyProgress: null,
    searchQuery: '',
    activeCategory: 'all',
    settings: { ...DEFAULT_SETTINGS },
    hasBackup: false,
    isFirstLaunch: false,
    error: null,
  };

  private readonly listeners = new Map<keyof AppState, Set<StateListener<keyof AppState>>>();

  private constructor() {}

  /** Get the singleton Store instance */
  public static getInstance(): Store {
    if (Store.instance === undefined) {
      Store.instance = new Store();
    }
    return Store.instance;
  }

  /** Get the full current state snapshot */
  public getState(): Readonly<AppState> {
    return this.state;
  }

  /** Get a single state slice */
  public get<K extends keyof AppState>(key: K): AppState[K] {
    return this.state[key];
  }

  /**
   * Update one or more state keys and notify listeners.
   */
  public set<K extends keyof AppState>(key: K, value: AppState[K]): void {
    const prev = this.state[key];
    if (prev === value) return;

    this.state = { ...this.state, [key]: value };
    this.notify(key, value, prev);
  }

  /**
   * Subscribe to changes on a specific state key.
   * @returns Unsubscribe function
   */
  public subscribe<K extends keyof AppState>(
    key: K,
    listener: StateListener<K>,
  ): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = this.listeners.get(key);
    set?.add(listener as StateListener<keyof AppState>);

    return () => {
      set?.delete(listener as StateListener<keyof AppState>);
    };
  }

  private notify<K extends keyof AppState>(key: K, value: AppState[K], prev: AppState[K]): void {
    const set = this.listeners.get(key);
    if (set === undefined) return;
    for (const listener of set) {
      (listener as StateListener<K>)(value, prev);
    }
  }

  // ─── Domain-specific helpers ───────────────────────────────────────────────

  /** Toggle a pending change for a service */
  public togglePendingChange(serviceId: string, action: ChangeAction): void {
    const pending = new Map(this.state.pendingChanges);

    // If same action already pending, remove it (toggle off)
    if (pending.get(serviceId) === action) {
      pending.delete(serviceId);
    } else {
      pending.set(serviceId, action);
    }

    this.set('pendingChanges', pending);
    eventBus.emit('pending:changed', pending);
  }

  /** Clear all pending changes */
  public clearPendingChanges(): void {
    this.set('pendingChanges', new Map());
    eventBus.emit('pending:changed', new Map());
  }

  /** Update services list */
  public setServices(services: ServiceWithState[]): void {
    this.set('services', services);
    eventBus.emit('services:loaded');
  }

  /** Update system stats */
  public setStats(stats: SystemStats): void {
    this.set('systemStats', stats);
    eventBus.emit('stats:updated', stats);
  }

  /** Update apply progress */
  public setApplyProgress(progress: ApplyProgress | null): void {
    this.set('applyProgress', progress);
    if (progress !== null) {
      eventBus.emit('apply:progress', progress);
    }
  }

  /** Update settings */
  public setSettings(settings: AppSettings): void {
    this.set('settings', settings);
  }

  /** Get filtered services based on current search and category */
  public getFilteredServices(): ServiceWithState[] {
    const { services, searchQuery, activeCategory } = this.state;
    const query = searchQuery.toLowerCase().trim();

    return services.filter((service) => {
      // Category filter
      if (activeCategory !== 'all' && service.category !== activeCategory) {
        return false;
      }

      // Search filter
      if (query.length > 0) {
        const searchable = [
          service.name,
          service.description,
          service.category,
          service.id,
        ]
          .join(' ')
          .toLowerCase();
        return searchable.includes(query);
      }

      return true;
    });
  }

  /** Get services for a specific category */
  public getServicesByCategory(category: ServiceCategory): ServiceWithState[] {
    return this.state.services.filter((s) => s.category === category);
  }
}

export const store = Store.getInstance();
