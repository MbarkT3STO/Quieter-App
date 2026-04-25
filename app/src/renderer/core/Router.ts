/**
 * Single-page hash router.
 * Maps hash routes to view factory functions.
 */

import type { Component } from './Component.js';
import { eventBus } from './EventBus.js';

type ViewFactory = () => Component;

/** Map of route paths to their display titles */
const ROUTE_TITLES: Record<string, string> = {
  '#/dashboard': 'Dashboard',
  '#/services': 'All Services',
  '#/settings': 'Settings',
  '#/category/Performance': 'Performance',
  '#/category/Network': 'Network',
  '#/category/Visuals': 'Visuals',
  '#/category/Privacy': 'Privacy',
  '#/category/Sync': 'Sync',
  '#/category/Misc': 'Misc',
};

export class Router {
  private static instance: Router;
  private readonly routes = new Map<string, ViewFactory>();
  private currentView: Component | null = null;
  private container: HTMLElement | null = null;

  private constructor() {
    window.addEventListener('hashchange', () => {
      this.navigate(window.location.hash);
    });
  }

  /** Get the singleton Router instance */
  public static getInstance(): Router {
    if (Router.instance === undefined) {
      Router.instance = new Router();
    }
    return Router.instance;
  }

  /**
   * Set the container element where views are rendered.
   */
  public setContainer(container: HTMLElement): void {
    this.container = container;
  }

  /**
   * Register a route.
   * @param path - Hash path, e.g. '#/dashboard'
   * @param factory - Function that creates the view component
   */
  public register(path: string, factory: ViewFactory): void {
    this.routes.set(path, factory);
  }

  /**
   * Navigate to a route.
   * @param path - Hash path, e.g. '#/dashboard'
   */
  public navigate(path: string): void {
    if (this.container === null) {
      throw new Error('Router: container not set');
    }

    // Normalize path
    const normalized = path === '' || path === '#' ? '#/dashboard' : path;

    // Update URL without triggering hashchange
    if (window.location.hash !== normalized) {
      window.location.hash = normalized;
      return; // hashchange will re-trigger navigate
    }

    const factory = this.routes.get(normalized);
    if (factory === undefined) {
      // Fallback to dashboard
      this.navigate('#/dashboard');
      return;
    }

    // Unmount current view
    this.currentView?.unmount();

    // Mount new view
    const view = factory();
    view.mount(this.container);
    this.currentView = view;

    eventBus.emit('route:changed', normalized);
    eventBus.emit('page:title', ROUTE_TITLES[normalized] ?? 'Quieter');
  }

  /**
   * Get the current route path.
   */
  public getCurrentPath(): string {
    return window.location.hash || '#/dashboard';
  }

  /**
   * Start the router — navigate to the current hash or default.
   */
  public start(): void {
    const initial = window.location.hash || '#/dashboard';
    this.navigate(initial);
  }
}

export const router = Router.getInstance();
