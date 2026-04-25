const APP_NAME = "Quieter";
const APP_VERSION = "1.0.0";
const SEARCH_DEBOUNCE_MS = 150;
const VIRTUAL_SCROLL_THRESHOLD = 50;
const DEFAULT_SETTINGS = {
  launchAtLogin: false,
  autoCheckOnStartup: true,
  theme: "dark"
};
const GITHUB_URL = "https://github.com/MbarkT3STO/Quieter-App";
class EventBus {
  static instance;
  listeners = /* @__PURE__ */ new Map();
  constructor() {
  }
  /** Get the singleton EventBus instance */
  static getInstance() {
    if (EventBus.instance === void 0) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  /**
   * Subscribe to an event.
   * @returns Unsubscribe function
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    const handlers = this.listeners.get(event);
    handlers?.add(handler);
    return () => {
      handlers?.delete(handler);
    };
  }
  /**
   * Subscribe to an event once — auto-unsubscribes after first call.
   */
  once(event, handler) {
    const unsub = this.on(event, (...args) => {
      unsub();
      handler(...args);
    });
  }
  /**
   * Emit an event to all subscribers.
   */
  emit(event, ...args) {
    const handlers = this.listeners.get(event);
    if (handlers === void 0) return;
    for (const handler of handlers) {
      handler(...args);
    }
  }
  /**
   * Remove all listeners for an event.
   */
  off(event) {
    this.listeners.delete(event);
  }
  /**
   * Remove all listeners for all events.
   */
  clear() {
    this.listeners.clear();
  }
}
const eventBus = EventBus.getInstance();
class Store {
  static instance;
  state = {
    services: [],
    pendingChanges: /* @__PURE__ */ new Map(),
    systemStats: null,
    isLoading: false,
    isApplying: false,
    applyProgress: null,
    searchQuery: "",
    activeCategory: "all",
    settings: { ...DEFAULT_SETTINGS },
    hasBackup: false,
    isFirstLaunch: false,
    error: null
  };
  listeners = /* @__PURE__ */ new Map();
  constructor() {
  }
  /** Get the singleton Store instance */
  static getInstance() {
    if (Store.instance === void 0) {
      Store.instance = new Store();
    }
    return Store.instance;
  }
  /** Get the full current state snapshot */
  getState() {
    return this.state;
  }
  /** Get a single state slice */
  get(key) {
    return this.state[key];
  }
  /**
   * Update one or more state keys and notify listeners.
   */
  set(key, value) {
    const prev = this.state[key];
    if (prev === value) return;
    this.state = { ...this.state, [key]: value };
    this.notify(key, value, prev);
  }
  /**
   * Subscribe to changes on a specific state key.
   * @returns Unsubscribe function
   */
  subscribe(key, listener) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, /* @__PURE__ */ new Set());
    }
    const set = this.listeners.get(key);
    set?.add(listener);
    return () => {
      set?.delete(listener);
    };
  }
  notify(key, value, prev) {
    const set = this.listeners.get(key);
    if (set === void 0) return;
    for (const listener of set) {
      listener(value, prev);
    }
  }
  // ─── Domain-specific helpers ───────────────────────────────────────────────
  /** Toggle a pending change for a service */
  togglePendingChange(serviceId, action) {
    const pending = new Map(this.state.pendingChanges);
    if (pending.get(serviceId) === action) {
      pending.delete(serviceId);
    } else {
      pending.set(serviceId, action);
    }
    this.set("pendingChanges", pending);
    eventBus.emit("pending:changed", pending);
  }
  /** Clear all pending changes */
  clearPendingChanges() {
    this.set("pendingChanges", /* @__PURE__ */ new Map());
    eventBus.emit("pending:changed", /* @__PURE__ */ new Map());
  }
  /** Update services list */
  setServices(services) {
    this.set("services", services);
    eventBus.emit("services:loaded");
  }
  /** Update system stats */
  setStats(stats) {
    this.set("systemStats", stats);
    eventBus.emit("stats:updated", stats);
  }
  /** Update apply progress */
  setApplyProgress(progress) {
    this.set("applyProgress", progress);
    if (progress !== null) {
      eventBus.emit("apply:progress", progress);
    }
  }
  /** Update settings */
  setSettings(settings) {
    this.set("settings", settings);
  }
  /** Get filtered services based on current search and category */
  getFilteredServices() {
    const { services, searchQuery, activeCategory } = this.state;
    const query = searchQuery.toLowerCase().trim();
    return services.filter((service) => {
      if (activeCategory !== "all" && service.category !== activeCategory) {
        return false;
      }
      if (query.length > 0) {
        const searchable = [
          service.name,
          service.description,
          service.category,
          service.id
        ].join(" ").toLowerCase();
        return searchable.includes(query);
      }
      return true;
    });
  }
  /** Get services for a specific category */
  getServicesByCategory(category) {
    return this.state.services.filter((s) => s.category === category);
  }
}
const store = Store.getInstance();
const ROUTE_TITLES = {
  "#/dashboard": "Dashboard",
  "#/services": "All Services",
  "#/settings": "Settings",
  "#/category/Performance": "Performance",
  "#/category/Network": "Network",
  "#/category/Visuals": "Visuals",
  "#/category/Privacy": "Privacy",
  "#/category/Sync": "Sync",
  "#/category/Misc": "Misc"
};
class Router {
  static instance;
  routes = /* @__PURE__ */ new Map();
  currentView = null;
  container = null;
  constructor() {
    window.addEventListener("hashchange", () => {
      this.navigate(window.location.hash);
    });
  }
  /** Get the singleton Router instance */
  static getInstance() {
    if (Router.instance === void 0) {
      Router.instance = new Router();
    }
    return Router.instance;
  }
  /**
   * Set the container element where views are rendered.
   */
  setContainer(container) {
    this.container = container;
  }
  /**
   * Register a route.
   * @param path - Hash path, e.g. '#/dashboard'
   * @param factory - Function that creates the view component
   */
  register(path, factory) {
    this.routes.set(path, factory);
  }
  /**
   * Navigate to a route.
   * @param path - Hash path, e.g. '#/dashboard'
   */
  navigate(path) {
    if (this.container === null) {
      throw new Error("Router: container not set");
    }
    const normalized = path === "" || path === "#" ? "#/dashboard" : path;
    if (window.location.hash !== normalized) {
      window.location.hash = normalized;
      return;
    }
    const factory = this.routes.get(normalized);
    if (factory === void 0) {
      this.navigate("#/dashboard");
      return;
    }
    this.currentView?.unmount();
    const view = factory();
    view.mount(this.container);
    this.currentView = view;
    eventBus.emit("route:changed", normalized);
    eventBus.emit("page:title", ROUTE_TITLES[normalized] ?? "Quieter");
  }
  /**
   * Get the current route path.
   */
  getCurrentPath() {
    return window.location.hash || "#/dashboard";
  }
  /**
   * Start the router — navigate to the current hash or default.
   */
  start() {
    const initial = window.location.hash || "#/dashboard";
    this.navigate(initial);
  }
}
const router = Router.getInstance();
class Component {
  element;
  unsubscribers = [];
  mounted = false;
  constructor(tagName = "div", className) {
    this.element = document.createElement(tagName);
    if (className !== void 0) {
      this.element.className = className;
    }
  }
  /**
   * Return the root DOM element of this component.
   */
  getElement() {
    return this.element;
  }
  /**
   * Mount this component into a parent element.
   * Calls render() and onMount() lifecycle hooks.
   */
  mount(parent) {
    if (this.mounted) return;
    this.render();
    parent.appendChild(this.element);
    this.mounted = true;
    this.onMount();
  }
  /**
   * Mount this component before a reference element.
   */
  mountBefore(sibling) {
    if (this.mounted) return;
    this.render();
    sibling.parentElement?.insertBefore(this.element, sibling);
    this.mounted = true;
    this.onMount();
  }
  /**
   * Unmount and clean up this component.
   */
  unmount() {
    if (!this.mounted) return;
    this.onUnmount();
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers.length = 0;
    this.element.remove();
    this.mounted = false;
  }
  /**
   * Re-render the component in place.
   */
  update() {
    if (!this.mounted) return;
    this.render();
  }
  /**
   * Register a cleanup function to run on unmount.
   * Use this for event listeners, store subscriptions, etc.
   */
  addCleanup(fn) {
    this.unsubscribers.push(fn);
  }
  /**
   * Set inner HTML safely (no user-provided content should use this).
   */
  setHTML(html) {
    this.element.innerHTML = html;
  }
  /**
   * Query a child element — throws if not found.
   */
  query(selector) {
    const el = this.element.querySelector(selector);
    if (el === null) {
      throw new Error(`Component: element not found: "${selector}"`);
    }
    return el;
  }
  /**
   * Query a child element — returns null if not found.
   */
  queryOptional(selector) {
    return this.element.querySelector(selector);
  }
  /**
   * Query all matching child elements.
   */
  queryAll(selector) {
    return this.element.querySelectorAll(selector);
  }
  /**
   * Called after the component is mounted to the DOM.
   * Override to attach event listeners, start timers, etc.
   */
  onMount() {
  }
  /**
   * Called before the component is removed from the DOM.
   * Override to clean up resources.
   */
  onUnmount() {
  }
}
var ServiceCategory = /* @__PURE__ */ ((ServiceCategory2) => {
  ServiceCategory2["Performance"] = "Performance";
  ServiceCategory2["Network"] = "Network";
  ServiceCategory2["Visuals"] = "Visuals";
  ServiceCategory2["Privacy"] = "Privacy";
  ServiceCategory2["Sync"] = "Sync";
  ServiceCategory2["Misc"] = "Misc";
  return ServiceCategory2;
})(ServiceCategory || {});
var RiskLevel = /* @__PURE__ */ ((RiskLevel2) => {
  RiskLevel2["Safe"] = "safe";
  RiskLevel2["Moderate"] = "moderate";
  RiskLevel2["Advanced"] = "advanced";
  return RiskLevel2;
})(RiskLevel || {});
var ServiceState = /* @__PURE__ */ ((ServiceState2) => {
  ServiceState2["Enabled"] = "enabled";
  ServiceState2["Disabled"] = "disabled";
  ServiceState2["Unknown"] = "unknown";
  return ServiceState2;
})(ServiceState || {});
var ChangeAction = /* @__PURE__ */ ((ChangeAction2) => {
  ChangeAction2["Enable"] = "enable";
  ChangeAction2["Disable"] = "disable";
  return ChangeAction2;
})(ChangeAction || {});
const STORAGE_KEY = "peakmac:sidebar-collapsed";
const COLLAPSED_WIDTH = "52px";
const EXPANDED_WIDTH = "var(--sidebar-width)";
const NAV_ITEMS = [
  {
    path: "#/dashboard",
    label: "Dashboard",
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>`
  },
  {
    path: "#/services",
    label: "All Services",
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`
  }
];
const CATEGORY_ITEMS = [
  {
    path: `#/category/${ServiceCategory.Performance}`,
    label: "Performance",
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>`
  },
  {
    path: `#/category/${ServiceCategory.Network}`,
    label: "Network",
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`
  },
  {
    path: `#/category/${ServiceCategory.Visuals}`,
    label: "Visuals",
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>`
  },
  {
    path: `#/category/${ServiceCategory.Privacy}`,
    label: "Privacy",
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`
  },
  {
    path: `#/category/${ServiceCategory.Sync}`,
    label: "Sync",
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>`
  },
  {
    path: `#/category/${ServiceCategory.Misc}`,
    label: "Misc",
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/></svg>`
  },
  {
    path: "#/settings",
    label: "Settings",
    icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>`
  }
];
const CHEVRON_ICON = `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
  <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
</svg>`;
class Sidebar extends Component {
  currentPath = "";
  collapsed;
  constructor() {
    super("aside", "sidebar");
    this.element.setAttribute("role", "navigation");
    this.element.setAttribute("aria-label", "Main navigation");
    this.collapsed = localStorage.getItem(STORAGE_KEY) === "true";
  }
  render() {
    this.element.classList.toggle("collapsed", this.collapsed);
    this.setHTML(`
      <!-- Toggle button row: brand on left, collapse arrow on right -->
      <div class="sidebar-toggle">
        <div class="sidebar-brand ${this.collapsed ? "hidden" : ""}">
          <img
            src="./assets/icons/AppIcon32.png"
            width="20"
            height="20"
            alt=""
            aria-hidden="true"
            class="sidebar-brand-icon"
            draggable="false"
          />
          <span class="sidebar-brand-name">Quieter</span>
        </div>
        <button
          class="sidebar-toggle-btn"
          id="sidebar-toggle-btn"
          aria-label="${this.collapsed ? "Expand sidebar" : "Collapse sidebar"}"
          title="${this.collapsed ? "Expand sidebar" : "Collapse sidebar"}"
        >
          ${CHEVRON_ICON}
        </button>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">Menu</div>
        ${NAV_ITEMS.map((item) => this.renderNavItem(item)).join("")}

        <div class="sidebar-section-label" style="margin-top: 8px;">Categories</div>
        ${CATEGORY_ITEMS.map((item) => this.renderNavItem(item)).join("")}
      </nav>

      <!-- Stats widget -->
      <div class="sidebar-stats" aria-label="System stats">
        <div class="sidebar-stat-row" title="CPU usage">
          <span class="sidebar-stat-dot neutral" id="sidebar-cpu-dot" aria-hidden="true"></span>
          <span class="sidebar-stat-label">CPU</span>
          <span class="sidebar-stat-value" id="sidebar-cpu">—</span>
        </div>
        <div class="sidebar-stat-row" title="RAM usage">
          <span class="sidebar-stat-dot neutral" id="sidebar-ram-dot" aria-hidden="true"></span>
          <span class="sidebar-stat-label">RAM</span>
          <span class="sidebar-stat-value" id="sidebar-ram">—</span>
        </div>
        <div class="sidebar-stat-row" title="Active services">
          <span class="sidebar-stat-dot neutral" id="sidebar-active-dot" aria-hidden="true"></span>
          <span class="sidebar-stat-label">Active</span>
          <span class="sidebar-stat-value" id="sidebar-active">—</span>
        </div>
      </div>
    `);
  }
  renderNavItem(item) {
    const isActive = this.currentPath === item.path;
    return `
      <a
        href="${item.path}"
        class="sidebar-item${isActive ? " active" : ""}"
        aria-current="${isActive ? "page" : "false"}"
        data-path="${item.path}"
        data-label="${item.label}"
        title="${item.label}"
      >
        <span class="sidebar-item-icon" aria-hidden="true">${item.icon}</span>
        <span class="sidebar-item-label">${item.label}</span>
      </a>
    `;
  }
  onMount() {
    this.applyCollapsedClass(false);
    eventBus.emit("sidebar:toggled", this.collapsed);
    const toggleBtn = this.query("#sidebar-toggle-btn");
    toggleBtn.addEventListener("click", () => {
      this.toggle();
    });
    this.element.addEventListener("click", (e) => {
      const target = e.target.closest("[data-path]");
      if (target === null) return;
      e.preventDefault();
      const path = target.dataset["path"];
      if (path !== void 0) {
        router.navigate(path);
      }
    });
    const routeUnsub = eventBus.on("route:changed", (path) => {
      this.updateActiveState(path);
    });
    this.addCleanup(routeUnsub);
    const statsUnsub = eventBus.on("stats:updated", (stats2) => {
      this.updateStats(stats2);
    });
    this.addCleanup(statsUnsub);
    this.updateActiveState(router.getCurrentPath());
    const stats = store.get("systemStats");
    if (stats !== null) {
      this.updateStats(stats);
    }
  }
  /**
   * Toggle collapsed/expanded state.
   */
  toggle() {
    this.collapsed = !this.collapsed;
    localStorage.setItem(STORAGE_KEY, String(this.collapsed));
    this.applyCollapsedClass(true);
    this.updateToggleBtn();
    eventBus.emit("sidebar:toggled", this.collapsed);
  }
  /**
   * Apply or remove the collapsed class and update the CSS variable.
   * @param animate - whether to allow CSS transitions (false on first paint)
   */
  applyCollapsedClass(animate) {
    if (!animate) {
      this.element.style.transition = "none";
    }
    this.element.classList.toggle("collapsed", this.collapsed);
    const width = this.collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    document.documentElement.style.setProperty("--sidebar-current-width", width);
    document.documentElement.classList.toggle("sidebar-collapsed", this.collapsed);
    if (!animate) {
      requestAnimationFrame(() => {
        this.element.style.transition = "";
      });
    }
  }
  updateToggleBtn() {
    const btn = this.queryOptional("#sidebar-toggle-btn");
    if (btn !== null) {
      const label = this.collapsed ? "Expand sidebar" : "Collapse sidebar";
      btn.setAttribute("aria-label", label);
      btn.setAttribute("title", label);
    }
    const brand = this.queryOptional(".sidebar-brand");
    if (brand !== null) {
      brand.classList.toggle("hidden", this.collapsed);
    }
  }
  updateActiveState(path) {
    this.currentPath = path;
    const items = this.queryAll(".sidebar-item");
    items.forEach((item) => {
      const itemPath = item.dataset["path"] ?? "";
      const isActive = itemPath === path;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-current", isActive ? "page" : "false");
    });
  }
  updateStats(stats) {
    const cpuEl = this.queryOptional("#sidebar-cpu");
    const ramEl = this.queryOptional("#sidebar-ram");
    const activeEl = this.queryOptional("#sidebar-active");
    const cpuDot = this.queryOptional("#sidebar-cpu-dot");
    const ramDot = this.queryOptional("#sidebar-ram-dot");
    const activeDot = this.queryOptional("#sidebar-active-dot");
    const cpuClass = stats.cpuUsagePercent > 80 ? "bad" : stats.cpuUsagePercent > 50 ? "warn" : "good";
    const ramClass = stats.ramUsedPercent > 85 ? "bad" : stats.ramUsedPercent > 65 ? "warn" : "good";
    if (cpuEl !== null) {
      cpuEl.textContent = `${stats.cpuUsagePercent}%`;
      cpuEl.className = `sidebar-stat-value ${cpuClass}`;
    }
    if (ramEl !== null) {
      ramEl.textContent = `${stats.ramUsedGB}/${stats.ramTotalGB}G`;
      ramEl.className = `sidebar-stat-value ${ramClass}`;
    }
    if (activeEl !== null) {
      activeEl.textContent = String(stats.activeServicesCount);
    }
    if (cpuDot !== null) cpuDot.className = `sidebar-stat-dot ${cpuClass}`;
    if (ramDot !== null) ramDot.className = `sidebar-stat-dot ${ramClass}`;
    if (activeDot !== null) activeDot.className = `sidebar-stat-dot neutral`;
  }
}
const ICONS = {
  success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
  error: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
  warning: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
  info: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`
};
const CLOSE_ICON = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>`;
class ToastContainer extends Component {
  static instance;
  constructor() {
    super("div", "toast-container");
    this.element.setAttribute("role", "region");
    this.element.setAttribute("aria-label", "Notifications");
    this.element.setAttribute("aria-live", "polite");
  }
  static getInstance() {
    if (ToastContainer.instance === void 0) {
      ToastContainer.instance = new ToastContainer();
    }
    return ToastContainer.instance;
  }
  render() {
  }
  onMount() {
    const unsub = eventBus.on("toast:show", (event) => {
      this.show(event);
    });
    this.addCleanup(unsub);
  }
  /**
   * Show a toast notification.
   */
  show(event) {
    const { type, message, duration = 4e3 } = event;
    const colonIdx = message.indexOf(": ");
    const title = colonIdx > -1 ? message.slice(0, colonIdx) : this.defaultTitle(type);
    const body = colonIdx > -1 ? message.slice(colonIdx + 2) : message;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "alert");
    toast.innerHTML = `
      <div class="toast-icon-wrap" aria-hidden="true">
        <span class="toast-icon">${ICONS[type]}</span>
      </div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${body}</div>
      </div>
      <button class="toast-close" aria-label="Dismiss notification">
        ${CLOSE_ICON}
      </button>
      ${duration > 0 ? `<div class="toast-progress" style="animation-duration: ${duration}ms"></div>` : ""}
    `;
    const dismiss = () => {
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 250);
    };
    toast.querySelector(".toast-close")?.addEventListener("click", dismiss);
    this.element.appendChild(toast);
    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }
  defaultTitle(type) {
    const titles = {
      success: "Success",
      error: "Error",
      warning: "Warning",
      info: "Info"
    };
    return titles[type];
  }
}
function showToast(type, message, duration) {
  const event = { type, message };
  eventBus.emit("toast:show", event);
}
class TopBar extends Component {
  currentPageTitle = "Dashboard";
  constructor() {
    super("header", "topbar");
    this.element.setAttribute("role", "banner");
  }
  render() {
    const pendingCount = store.get("pendingChanges").size;
    this.setHTML(`
      <div class="topbar-page-title" id="topbar-page-title" aria-live="polite">
        ${this.currentPageTitle}
      </div>

      <div class="topbar-actions">
        ${pendingCount > 0 ? `
          <span class="topbar-pending-badge" aria-label="${pendingCount} pending change${pendingCount !== 1 ? "s" : ""}">
            ${pendingCount}
          </span>
        ` : ""}
        <button
          class="topbar-action-btn"
          id="topbar-refresh"
          aria-label="Refresh service states"
          title="Refresh service states"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `);
  }
  onMount() {
    const refreshBtn = this.query("#topbar-refresh");
    refreshBtn.addEventListener("click", () => {
      void this.handleRefresh();
    });
    const routeUnsub = eventBus.on("page:title", (title) => {
      this.currentPageTitle = title;
      const titleEl = this.queryOptional("#topbar-page-title");
      if (titleEl !== null) titleEl.textContent = title;
    });
    this.addCleanup(routeUnsub);
    const pendingUnsub = store.subscribe("pendingChanges", (pending) => {
      this.updatePendingBadge(pending.size);
    });
    this.addCleanup(pendingUnsub);
  }
  async handleRefresh() {
    const btn = this.queryOptional("#topbar-refresh");
    if (btn !== null) {
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
    }
    const result = await window.peakMacAPI.getServices();
    if (btn !== null) {
      btn.style.opacity = "";
      btn.style.pointerEvents = "";
    }
    if (result.success) {
      store.setServices(result.data);
      showToast("success", "Service states refreshed");
    } else {
      showToast("error", "Failed to refresh service states");
    }
  }
  updatePendingBadge(count) {
    const actionsEl = this.queryOptional(".topbar-actions");
    if (actionsEl === null) return;
    const existing = this.queryOptional(".topbar-pending-badge");
    if (count > 0) {
      if (existing !== null) {
        existing.textContent = String(count);
      } else {
        const badge = document.createElement("span");
        badge.className = "topbar-pending-badge";
        badge.textContent = String(count);
        badge.setAttribute("aria-label", `${count} pending change${count !== 1 ? "s" : ""}`);
        actionsEl.insertBefore(badge, actionsEl.firstChild);
      }
    } else {
      existing?.remove();
    }
  }
}
class ProgressBar extends Component {
  percent = 0;
  label = "";
  status = "running";
  constructor() {
    super("div", "progress-bar-container");
  }
  render() {
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
  setProgress(percent, label, status) {
    this.percent = Math.min(100, Math.max(0, percent));
    this.label = label;
    this.status = status;
    this.updateDOM();
  }
  updateDOM() {
    const fill = this.queryOptional(".progress-bar-fill");
    const labelText = this.queryOptional(".progress-label-text");
    const labelPercent = this.queryOptional(".progress-label-percent");
    const track = this.queryOptional(".progress-bar-track");
    if (fill !== null) {
      fill.style.width = `${this.percent}%`;
      fill.className = `progress-bar-fill ${this.status === "running" ? "" : this.status}`;
    }
    if (labelText !== null) {
      labelText.textContent = this.label;
    }
    if (labelPercent !== null) {
      labelPercent.textContent = `${this.percent}%`;
    }
    if (track !== null) {
      track.setAttribute("aria-valuenow", String(this.percent));
    }
  }
  /**
   * Show the progress bar.
   */
  show() {
    this.element.classList.add("visible");
  }
  /**
   * Hide the progress bar.
   */
  hide() {
    this.element.classList.remove("visible");
  }
}
class Modal extends Component {
  options;
  constructor(options) {
    super("div", "modal-backdrop");
    this.options = options;
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-modal", "true");
    this.element.setAttribute("aria-labelledby", "modal-title");
  }
  render() {
    const {
      title,
      body,
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      confirmClass = "btn btn-primary"
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
  onMount() {
    const closeBtn = this.query(".modal-close");
    const cancelBtn = this.query(".modal-cancel");
    const confirmBtn = this.query(".modal-confirm");
    const close = () => this.unmount();
    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", () => {
      this.options.onCancel?.();
      close();
    });
    confirmBtn.addEventListener("click", () => {
      this.options.onConfirm?.();
      close();
    });
    this.element.addEventListener("click", (e) => {
      if (e.target === this.element) {
        this.options.onCancel?.();
        close();
      }
    });
    const keyHandler = (e) => {
      if (e.key === "Escape") {
        this.options.onCancel?.();
        close();
      }
    };
    document.addEventListener("keydown", keyHandler);
    this.addCleanup(() => document.removeEventListener("keydown", keyHandler));
    confirmBtn.focus();
  }
  /**
   * Show the modal by mounting it to document.body.
   */
  show() {
    this.mount(document.body);
  }
}
function showRiskConfirmModal(serviceNames, onConfirm, onCancel) {
  const warningItems = serviceNames.map(
    (name) => `
      <div class="modal-warning-item">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1L1 14h14L8 1zm0 2.5l5.5 9.5H2.5L8 3.5zM7.25 7v3h1.5V7h-1.5zm0 4v1.5h1.5V11h-1.5z"/>
        </svg>
        ${name}
      </div>
    `
  ).join("");
  const modal = new Modal({
    title: "Advanced Services Warning",
    body: `
      <p>The following services are marked <strong>Advanced</strong> risk. Disabling them may cause system instability or loss of critical functionality.</p>
      <div class="modal-warning-list">${warningItems}</div>
      <p style="margin-top: 12px;">Are you sure you want to proceed?</p>
    `,
    confirmLabel: "Proceed Anyway",
    cancelLabel: "Cancel",
    confirmClass: "btn btn-danger",
    onConfirm,
    onCancel
  });
  modal.show();
}
function showOnboardingModal(onDone) {
  const modal = new Modal({
    title: "Welcome to Quieter",
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
    confirmLabel: "Get Started",
    cancelLabel: "Learn More",
    onConfirm: onDone,
    onCancel: () => {
      window.open("https://github.com/MbarkT3STO/Quieter-App#readme", "_blank");
      onDone();
    }
  });
  modal.show();
}
class ApplyBar extends Component {
  progressBar;
  isApplying = false;
  constructor() {
    super("div", "apply-bar hidden");
    this.element.setAttribute("role", "region");
    this.element.setAttribute("aria-label", "Pending changes");
    this.progressBar = new ProgressBar();
  }
  render() {
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
  onMount() {
    const progressPlaceholder = this.query("#progress-placeholder");
    this.progressBar.mount(progressPlaceholder);
    const applyBtn = this.query("#btn-apply");
    const revertBtn = this.query("#btn-revert-pending");
    applyBtn.addEventListener("click", () => {
      void this.handleApply();
    });
    revertBtn.addEventListener("click", () => {
      store.clearPendingChanges();
      showToast("info", "Pending changes cleared");
    });
    const pendingUnsub = store.subscribe("pendingChanges", (pending) => {
      this.updateCount(pending.size);
    });
    this.addCleanup(pendingUnsub);
    if (typeof window.peakMacAPI !== "undefined") {
      window.peakMacAPI.onApplyProgress((progress) => {
        this.handleProgress(progress);
      });
      this.addCleanup(() => {
        window.peakMacAPI.offApplyProgress();
      });
    }
  }
  updateCount(count) {
    const countEl = this.queryOptional("#apply-bar-count");
    if (countEl !== null) {
      countEl.innerHTML = `<strong>${count} change${count !== 1 ? "s" : ""}</strong> pending`;
    }
    if (count > 0) {
      this.element.classList.remove("hidden");
    } else {
      this.element.classList.add("hidden");
    }
  }
  async handleApply() {
    if (this.isApplying) return;
    const pending = store.get("pendingChanges");
    if (pending.size === 0) return;
    const services = store.get("services");
    const advancedServices = Array.from(pending.entries()).filter(([serviceId]) => {
      const service = services.find((s) => s.id === serviceId);
      return service?.risk === RiskLevel.Advanced;
    }).map(([serviceId]) => {
      return services.find((s) => s.id === serviceId)?.name ?? serviceId;
    });
    if (advancedServices.length > 0) {
      showRiskConfirmModal(
        advancedServices,
        () => void this.executeApply(pending),
        () => {
        }
      );
    } else {
      await this.executeApply(pending);
    }
  }
  async executeApply(pending) {
    this.isApplying = true;
    store.set("isApplying", true);
    const applyBtn = this.queryOptional("#btn-apply");
    const revertBtn = this.queryOptional("#btn-revert-pending");
    const countEl = this.queryOptional("#apply-bar-count");
    if (applyBtn !== null) {
      applyBtn.disabled = true;
      applyBtn.textContent = "Applying…";
    }
    if (revertBtn !== null) revertBtn.disabled = true;
    if (countEl !== null) countEl.style.display = "none";
    this.progressBar.show();
    this.progressBar.setProgress(0, "Starting…", "running");
    const changes = Array.from(pending.entries()).map(([serviceId, action]) => ({
      serviceId,
      action
    }));
    eventBus.emit("apply:start");
    const result = await window.peakMacAPI.applyChanges(changes);
    this.isApplying = false;
    store.set("isApplying", false);
    if (applyBtn !== null) {
      applyBtn.disabled = false;
      applyBtn.textContent = "Apply Changes";
    }
    if (revertBtn !== null) revertBtn.disabled = false;
    if (countEl !== null) countEl.style.display = "";
    if (result.success) {
      const applyResult = result.data;
      this.progressBar.setProgress(100, "Done", "success");
      setTimeout(() => {
        this.progressBar.hide();
      }, 2e3);
      store.clearPendingChanges();
      eventBus.emit("apply:done", applyResult);
      showToast("success", `Applied ${applyResult.applied} change${applyResult.applied !== 1 ? "s" : ""} successfully`);
      const servicesResult = await window.peakMacAPI.getServices();
      if (servicesResult.success) {
        store.setServices(servicesResult.data);
      }
    } else {
      this.progressBar.setProgress(100, "Failed", "error");
      setTimeout(() => this.progressBar.hide(), 3e3);
      eventBus.emit("apply:error", result.error ?? "Unknown error");
      showToast("error", `Apply failed: ${result.error ?? "Unknown error"}. Changes rolled back.`);
    }
  }
  handleProgress(progress) {
    const percent = progress.total > 0 ? Math.round(progress.completed / progress.total * 100) : 0;
    const status = progress.status === "success" ? "success" : progress.status === "error" || progress.status === "rollingback" ? "error" : "running";
    const label = progress.status === "rollingback" ? `Rolling back: ${progress.current}` : progress.current;
    this.progressBar.setProgress(percent, label, status);
    store.setApplyProgress(progress);
  }
}
const CPU_HISTORY_LENGTH = 30;
class DashboardView extends Component {
  cpuHistory = Array.from({ length: CPU_HISTORY_LENGTH }).fill(0);
  canvasCtx = null;
  drawScheduled = false;
  // prevent redundant rAF calls
  constructor() {
    super("div", "dashboard-view");
  }
  render() {
    const stats = store.get("systemStats");
    const services = store.get("services");
    const activeCount = services.filter(
      (s) => s.runtimeState.currentState === ServiceState.Enabled
    ).length;
    const disabledCount = services.filter(
      (s) => s.runtimeState.currentState === ServiceState.Disabled
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
          <div class="stat-card-value" id="stat-cpu">${stats !== null ? `${stats.cpuUsagePercent}%` : "—"}</div>
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
          <div class="stat-card-value" id="stat-ram">${stats !== null ? `${stats.ramUsedGB}G` : "—"}</div>
          <div class="stat-card-sub" id="stat-ram-sub">${stats !== null ? `of ${stats.ramTotalGB} GB (${stats.ramUsedPercent}%)` : "Loading…"}</div>
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
          <span class="sparkline-value" id="sparkline-value">${stats !== null ? `${stats.cpuUsagePercent}%` : "—"}</span>
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
  onMount() {
    this.initSparkline();
    this.bindActions();
    this.renderPendingChanges();
    const statsUnsub = eventBus.on("stats:updated", (stats) => {
      this.updateStats(stats);
    });
    this.addCleanup(statsUnsub);
    const pendingUnsub = eventBus.on("pending:changed", () => {
      this.renderPendingChanges();
    });
    this.addCleanup(pendingUnsub);
    this.addCleanup(() => {
      this.canvasCtx = null;
      this.drawScheduled = false;
    });
  }
  initSparkline() {
    const canvas = this.queryOptional("#cpu-sparkline");
    if (canvas === null) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    canvas.width = rect?.width ?? 600;
    canvas.height = 60;
    this.canvasCtx = canvas.getContext("2d");
    this.drawSparkline();
  }
  drawSparkline() {
    if (this.drawScheduled) return;
    this.drawScheduled = true;
    requestAnimationFrame(() => {
      this.drawScheduled = false;
      this.renderSparklineFrame();
    });
  }
  renderSparklineFrame() {
    const ctx = this.canvasCtx;
    const canvas = this.queryOptional("#cpu-sparkline");
    if (ctx === null || canvas === null) return;
    const w = canvas.width;
    const h = canvas.height;
    const padding = 4;
    ctx.clearRect(0, 0, w, h);
    if (this.cpuHistory.every((v) => v === 0)) return;
    const stepX = (w - padding * 2) / (CPU_HISTORY_LENGTH - 1);
    const maxVal = 100;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "rgba(108, 99, 255, 0.3)");
    gradient.addColorStop(1, "rgba(108, 99, 255, 0)");
    ctx.beginPath();
    ctx.moveTo(padding, h - padding);
    this.cpuHistory.forEach((val, i) => {
      const x = padding + i * stepX;
      const y = h - padding - val / maxVal * (h - padding * 2);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(w - padding, h - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    this.cpuHistory.forEach((val, i) => {
      const x = padding + i * stepX;
      const y = h - padding - val / maxVal * (h - padding * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#6C63FF";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  updateStats(stats) {
    this.cpuHistory.push(stats.cpuUsagePercent);
    if (this.cpuHistory.length > CPU_HISTORY_LENGTH) {
      this.cpuHistory.shift();
    }
    const cpuEl = this.queryOptional("#stat-cpu");
    const ramEl = this.queryOptional("#stat-ram");
    const ramSubEl = this.queryOptional("#stat-ram-sub");
    const activeEl = this.queryOptional("#stat-active");
    const disabledEl = this.queryOptional("#stat-disabled");
    const sparklineVal = this.queryOptional("#sparkline-value");
    if (cpuEl !== null) cpuEl.textContent = `${stats.cpuUsagePercent}%`;
    if (ramEl !== null) ramEl.textContent = `${stats.ramUsedGB}G`;
    if (ramSubEl !== null) ramSubEl.textContent = `of ${stats.ramTotalGB} GB (${stats.ramUsedPercent}%)`;
    if (activeEl !== null) activeEl.textContent = String(stats.activeServicesCount);
    if (disabledEl !== null) disabledEl.textContent = String(stats.disabledServicesCount);
    if (sparklineVal !== null) sparklineVal.textContent = `${stats.cpuUsagePercent}%`;
    this.drawSparkline();
  }
  bindActions() {
    const disableSafeBtn = this.queryOptional("#qa-disable-safe");
    disableSafeBtn?.addEventListener("click", () => {
      const services = store.get("services");
      const safeEnabled = services.filter(
        (s) => s.risk === RiskLevel.Safe && s.runtimeState.currentState === ServiceState.Enabled
      );
      if (safeEnabled.length === 0) {
        showToast("info", "No safe services to disable");
        return;
      }
      safeEnabled.forEach((s) => {
        store.togglePendingChange(s.id, ChangeAction.Disable);
      });
      showToast("info", `Marked ${safeEnabled.length} safe services for disabling`);
    });
    const perfBtn = this.queryOptional("#qa-view-performance");
    perfBtn?.addEventListener("click", () => {
      router.navigate(`#/category/${ServiceCategory.Performance}`);
    });
    const privacyBtn = this.queryOptional("#qa-view-privacy");
    privacyBtn?.addEventListener("click", () => {
      router.navigate(`#/category/${ServiceCategory.Privacy}`);
    });
  }
  renderPendingChanges() {
    const listEl = this.queryOptional("#recent-changes-list");
    if (listEl === null) return;
    const pending = store.get("pendingChanges");
    const services = store.get("services");
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
    listEl.innerHTML = items.join("");
    listEl.querySelectorAll("[data-undo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const serviceId = btn.dataset["undo"];
        if (serviceId !== void 0) {
          const action = pending.get(serviceId);
          if (action !== void 0) {
            store.togglePendingChange(serviceId, action);
          }
        }
      });
    });
  }
}
class Toggle extends Component {
  options;
  inputEl = null;
  constructor(options) {
    super("label", "toggle");
    this.options = options;
  }
  render() {
    const { checked, disabled = false, label } = this.options;
    if (disabled) {
      this.element.classList.add("disabled");
    } else {
      this.element.classList.remove("disabled");
    }
    this.setHTML(`
      <input
        type="checkbox"
        ${checked ? "checked" : ""}
        ${disabled ? "disabled" : ""}
        aria-label="${label}"
        role="switch"
        aria-checked="${checked}"
      />
      <span class="toggle-track" aria-hidden="true"></span>
      <span class="toggle-thumb" aria-hidden="true"></span>
    `);
    this.inputEl = this.query("input");
  }
  onMount() {
    this.attachListener();
  }
  attachListener() {
    if (this.inputEl === null) return;
    const handler = (e) => {
      const input = e.target;
      this.options.onChange(input.checked);
    };
    this.inputEl.addEventListener("change", handler);
    this.addCleanup(() => this.inputEl?.removeEventListener("change", handler));
  }
  /**
   * Update the toggle state without re-rendering.
   */
  setChecked(checked) {
    this.options = { ...this.options, checked };
    if (this.inputEl !== null) {
      this.inputEl.checked = checked;
      this.inputEl.setAttribute("aria-checked", String(checked));
    }
  }
  /**
   * Enable or disable the toggle.
   */
  setDisabled(disabled) {
    this.options = { ...this.options, disabled };
    if (this.inputEl !== null) {
      this.inputEl.disabled = disabled;
    }
    if (disabled) {
      this.element.classList.add("disabled");
    } else {
      this.element.classList.remove("disabled");
    }
  }
}
class Badge extends Component {
  risk;
  constructor(risk) {
    super("span", "badge");
    this.risk = risk;
  }
  render() {
    const classMap = {
      [RiskLevel.Safe]: "badge-safe",
      [RiskLevel.Moderate]: "badge-moderate",
      [RiskLevel.Advanced]: "badge-advanced"
    };
    const labelMap = {
      [RiskLevel.Safe]: "Safe",
      [RiskLevel.Moderate]: "Moderate",
      [RiskLevel.Advanced]: "Advanced"
    };
    this.element.className = `badge ${classMap[this.risk]}`;
    if (this.risk === RiskLevel.Advanced) {
      this.setHTML(`
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1L1 14h14L8 1zm0 2.5l5.5 9.5H2.5L8 3.5zM7.25 7v3h1.5V7h-1.5zm0 4v1.5h1.5V11h-1.5z"/>
        </svg>
        ${labelMap[this.risk]}
      `);
    } else {
      this.element.textContent = labelMap[this.risk];
    }
  }
}
const CATEGORY_ICONS = {
  Performance: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>`,
  Network: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`,
  Visuals: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>`,
  Privacy: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
  Sync: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>`,
  Misc: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/></svg>`
};
class ServiceCard extends Component {
  service;
  toggle = null;
  badge = null;
  descExpanded = false;
  effectsVisible = false;
  constructor(service) {
    super("article", "service-card");
    this.service = service;
    this.element.setAttribute("data-service-id", service.id);
  }
  render() {
    const { service } = this;
    const pending = store.get("pendingChanges").get(service.id);
    const currentState = service.runtimeState.currentState;
    const isEnabled = currentState === ServiceState.Enabled;
    const isPending = pending !== void 0;
    if (isPending) {
      this.element.classList.add("pending-change");
    } else {
      this.element.classList.remove("pending-change");
    }
    const stateLabel = currentState === ServiceState.Enabled ? "Active" : currentState === ServiceState.Disabled ? "Disabled" : "Unknown";
    const stateDotClass = currentState === ServiceState.Enabled ? "enabled" : currentState === ServiceState.Disabled ? "disabled" : "unknown";
    const categoryIcon = CATEGORY_ICONS[service.category] ?? "";
    this.setHTML(`
      <div class="service-card-header">
        <div class="service-card-title-row">
          <span class="service-card-icon-wrap" aria-hidden="true">
            <span class="service-card-icon">${categoryIcon}</span>
          </span>
          <span class="service-card-name">${service.name}</span>
        </div>
        <div class="badge-placeholder"></div>
      </div>

      <div class="service-card-body">
        <div class="service-card-meta">
          <span class="service-card-category">${service.category}</span>
          ${service.requiresAdmin ? '<span class="badge badge-moderate" title="Requires admin">Admin</span>' : ""}
          ${service.requiresRestart ? '<span class="badge badge-moderate" title="Requires restart">Restart</span>' : ""}
        </div>

        <div class="service-card-impact" aria-label="Performance impact">
          <div class="impact-item">
            <span>CPU</span>
            <div class="impact-bar-track" role="meter" aria-label="CPU impact: ${service.impact.cpu}">
              <div class="impact-bar-fill ${service.impact.cpu}"></div>
            </div>
          </div>
          <div class="impact-item">
            <span>RAM</span>
            <div class="impact-bar-track" role="meter" aria-label="RAM impact: ${service.impact.ram}">
              <div class="impact-bar-fill ${service.impact.ram}"></div>
            </div>
          </div>
        </div>

        <div>
          <p class="service-card-description${this.descExpanded ? " expanded" : ""}">${service.description}</p>
          <button class="service-card-expand-btn" aria-expanded="${this.descExpanded}">
            ${this.descExpanded ? "Show less" : "Show more"}
          </button>
        </div>

        <div class="service-card-effects${this.effectsVisible ? " visible" : ""}">
        <div class="effect-item">
          <span class="effect-icon gain" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1l1.5 3h3l-2.5 2 1 3L6 7.5 3 9l1-3L1.5 4h3z"/>
            </svg>
          </span>
          <span class="effect-text"><strong>Gain:</strong> ${service.disableEffect}</span>
        </div>
        <div class="effect-item">
          <span class="effect-icon lose" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm-.5 3h1v3h-1V4zm0 4h1v1h-1V8z"/>
            </svg>
          </span>
          <span class="effect-text"><strong>Lose:</strong> ${service.enableEffect}</span>
        </div>
        <button class="service-card-expand-btn effects-toggle" aria-expanded="${this.effectsVisible}">
          Hide details
        </button>
      </div>

      ${!this.effectsVisible ? `
        <button class="service-card-expand-btn effects-show" aria-expanded="false">
          Show effects
        </button>
      ` : ""}

      </div><!-- end service-card-body -->

      <div class="service-card-footer">
        <div class="service-card-state">
          <span class="state-dot ${stateDotClass}" aria-hidden="true"></span>
          <span>Currently: ${stateLabel}</span>
          ${isPending ? `<span class="pending-badge">${pending === ChangeAction.Disable ? "→ Disable" : "→ Enable"}</span>` : ""}
        </div>
        <div class="toggle-placeholder"></div>
      </div>
    `);
    const badgePlaceholder = this.query(".badge-placeholder");
    this.badge = new Badge(service.risk);
    this.badge.mount(badgePlaceholder);
    const togglePlaceholder = this.query(".toggle-placeholder");
    const toggleChecked = isPending ? pending === ChangeAction.Enable : isEnabled;
    this.toggle = new Toggle({
      checked: toggleChecked,
      label: `Toggle ${service.name}`,
      onChange: (checked) => {
        const action = checked ? ChangeAction.Enable : ChangeAction.Disable;
        store.togglePendingChange(service.id, action);
      }
    });
    this.toggle.mount(togglePlaceholder);
  }
  onMount() {
    this.attachCardListeners();
    const unsub = eventBus.on("pending:changed", (pending) => {
      const p = pending.get(this.service.id);
      const isPending = p !== void 0;
      this.element.classList.toggle("pending-change", isPending);
      const isEnabled = this.service.runtimeState.currentState === ServiceState.Enabled;
      this.toggle?.setChecked(isPending ? p === ChangeAction.Enable : isEnabled);
      const stateEl = this.queryOptional(".service-card-state");
      if (stateEl !== null) {
        stateEl.querySelector(".pending-badge")?.remove();
        if (isPending) {
          const badge = document.createElement("span");
          badge.className = "pending-badge";
          badge.textContent = p === ChangeAction.Disable ? "→ Disable" : "→ Enable";
          stateEl.appendChild(badge);
        }
      }
    });
    this.addCleanup(unsub);
  }
  /**
   * Update the service data and re-render without leaking listeners.
   * Only re-renders if the state actually changed.
   */
  updateService(service) {
    const prevState = this.service.runtimeState.currentState;
    this.service = service;
    if (service.runtimeState.currentState !== prevState) {
      this.toggle?.unmount();
      this.badge?.unmount();
      this.render();
      this.attachCardListeners();
    }
  }
  /**
   * Attach card-level event listeners. Called once on mount and on state change re-render.
   */
  attachCardListeners() {
    const expandBtn = this.queryOptional(".service-card-expand-btn:not(.effects-toggle):not(.effects-show)");
    expandBtn?.addEventListener("click", () => {
      this.descExpanded = !this.descExpanded;
      const desc = this.queryOptional(".service-card-description");
      desc?.classList.toggle("expanded", this.descExpanded);
      if (expandBtn !== null) {
        expandBtn.textContent = this.descExpanded ? "Show less" : "Show more";
        expandBtn.setAttribute("aria-expanded", String(this.descExpanded));
      }
    });
    const showEffectsBtn = this.queryOptional(".effects-show");
    showEffectsBtn?.addEventListener("click", () => {
      this.effectsVisible = true;
      this.queryOptional(".service-card-effects")?.classList.add("visible");
      showEffectsBtn.remove();
    });
    const hideEffectsBtn = this.queryOptional(".effects-toggle");
    hideEffectsBtn?.addEventListener("click", () => {
      this.effectsVisible = false;
      this.queryOptional(".service-card-effects")?.classList.remove("visible");
      const footer = this.queryOptional(".service-card-footer");
      if (footer !== null) {
        const showBtn = document.createElement("button");
        showBtn.className = "service-card-expand-btn effects-show";
        showBtn.setAttribute("aria-expanded", "false");
        showBtn.textContent = "Show effects";
        showBtn.addEventListener("click", () => {
          this.effectsVisible = true;
          this.queryOptional(".service-card-effects")?.classList.add("visible");
          showBtn.remove();
        });
        footer.parentElement?.insertBefore(showBtn, footer);
      }
    });
  }
}
class ServicesView extends Component {
  cards = /* @__PURE__ */ new Map();
  searchTimer = null;
  constructor() {
    super("div", "services-view");
  }
  render() {
    const services = store.getFilteredServices();
    const currentQuery = store.get("searchQuery");
    this.setHTML(`
      <div class="page-header">
        <div class="services-header-row">
          <div>
            <h1 class="page-title">All Services</h1>
            <p class="page-subtitle" id="services-count">
              ${services.length} service${services.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div class="services-search" role="search">
            <svg class="services-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg>
            <input
              type="search"
              id="services-search-input"
              class="services-search-input"
              placeholder="Search services…"
              aria-label="Search services"
              autocomplete="off"
              spellcheck="false"
              value="${currentQuery}"
            />
            ${currentQuery.length > 0 ? `
              <button class="services-search-clear" aria-label="Clear search" id="search-clear-btn">
                <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                  <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
                </svg>
              </button>
            ` : ""}
          </div>
        </div>
      </div>

      <div class="services-grid" id="services-grid" role="list" aria-label="Services list"></div>

      <div class="empty-state" id="services-empty" style="display: none;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="40" height="40" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p>No services match your search</p>
        <button class="btn btn-ghost" id="btn-clear-search" style="margin-top: 8px;">Clear search</button>
      </div>
    `);
  }
  onMount() {
    this.renderCards();
    this.bindSearch();
    const searchUnsub = eventBus.on("search:changed", () => {
      this.refreshList();
    });
    this.addCleanup(searchUnsub);
    const servicesUnsub = eventBus.on("services:loaded", () => {
      this.refreshList();
    });
    this.addCleanup(servicesUnsub);
    this.addCleanup(() => {
      this.cards.forEach((card) => card.unmount());
      this.cards.clear();
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    });
  }
  bindSearch() {
    const input = this.queryOptional("#services-search-input");
    if (input === null) return;
    requestAnimationFrame(() => input.focus());
    input.addEventListener("input", () => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        const query = input.value;
        store.set("searchQuery", query);
        eventBus.emit("search:changed", query);
        this.updateClearButton(query);
      }, SEARCH_DEBOUNCE_MS);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.clearSearch();
        input.blur();
      }
    });
    const clearBtn = this.queryOptional("#search-clear-btn");
    clearBtn?.addEventListener("click", () => this.clearSearch());
    const emptyClearBtn = this.queryOptional("#btn-clear-search");
    emptyClearBtn?.addEventListener("click", () => this.clearSearch());
  }
  clearSearch() {
    const input = this.queryOptional("#services-search-input");
    if (input !== null) input.value = "";
    store.set("searchQuery", "");
    eventBus.emit("search:changed", "");
    this.updateClearButton("");
  }
  updateClearButton(query) {
    const existing = this.queryOptional("#search-clear-btn");
    const searchDiv = this.queryOptional(".services-search");
    if (searchDiv === null) return;
    if (query.length > 0 && existing === null) {
      const btn = document.createElement("button");
      btn.className = "services-search-clear";
      btn.id = "search-clear-btn";
      btn.setAttribute("aria-label", "Clear search");
      btn.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
        <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
      </svg>`;
      btn.addEventListener("click", () => this.clearSearch());
      searchDiv.appendChild(btn);
    } else if (query.length === 0 && existing !== null) {
      existing.remove();
    }
  }
  refreshList() {
    const services = store.getFilteredServices();
    const countEl = this.queryOptional("#services-count");
    if (countEl !== null) {
      countEl.textContent = `${services.length} service${services.length !== 1 ? "s" : ""}`;
    }
    const emptyEl = this.queryOptional("#services-empty");
    const gridEl = this.queryOptional("#services-grid");
    if (services.length === 0) {
      if (emptyEl !== null) emptyEl.style.display = "flex";
      if (gridEl !== null) gridEl.style.display = "none";
      return;
    }
    if (emptyEl !== null) emptyEl.style.display = "none";
    if (gridEl !== null) gridEl.style.display = "";
    if (services.length > VIRTUAL_SCROLL_THRESHOLD) {
      this.renderVirtual(services);
    } else {
      this.renderCards();
    }
  }
  renderCards() {
    const grid = this.queryOptional("#services-grid");
    if (grid === null) return;
    const services = store.getFilteredServices();
    const serviceIds = new Set(services.map((s) => s.id));
    this.cards.forEach((card, id) => {
      if (!serviceIds.has(id)) {
        card.unmount();
        this.cards.delete(id);
      }
    });
    services.forEach((service) => {
      const existing = this.cards.get(service.id);
      if (existing !== void 0) {
        existing.updateService(service);
      } else {
        const card = new ServiceCard(service);
        card.mount(grid);
        this.cards.set(service.id, card);
      }
    });
  }
  renderVirtual(services) {
    const grid = this.queryOptional("#services-grid");
    if (grid === null) return;
    this.cards.forEach((card) => card.unmount());
    this.cards.clear();
    const BATCH_SIZE = 10;
    let index = 0;
    const renderBatch = () => {
      const end = Math.min(index + BATCH_SIZE, services.length);
      for (let i = index; i < end; i++) {
        const service = services[i];
        if (service === void 0) continue;
        const card = new ServiceCard(service);
        card.mount(grid);
        this.cards.set(service.id, card);
      }
      index = end;
      if (index < services.length) requestAnimationFrame(renderBatch);
    };
    requestAnimationFrame(renderBatch);
  }
}
class CategoryView extends Component {
  category;
  cards = /* @__PURE__ */ new Map();
  constructor(category) {
    super("div", "category-view");
    this.category = category;
  }
  render() {
    const services = store.getServicesByCategory(this.category);
    this.setHTML(`
      <div class="page-header">
        <h1 class="page-title">${this.category}</h1>
        <p class="page-subtitle">${services.length} service${services.length !== 1 ? "s" : ""} in this category</p>
      </div>
      <div class="services-grid" id="category-grid" role="list" aria-label="${this.category} services"></div>
      <div class="empty-state" id="category-empty" style="display: ${services.length === 0 ? "flex" : "none"};">
        <p>No services in this category</p>
      </div>
    `);
  }
  onMount() {
    this.renderCards();
    const servicesUnsub = eventBus.on("services:loaded", () => {
      this.refreshCards();
    });
    this.addCleanup(servicesUnsub);
    this.addCleanup(() => {
      this.cards.forEach((card) => card.unmount());
      this.cards.clear();
    });
  }
  renderCards() {
    const grid = this.queryOptional("#category-grid");
    if (grid === null) return;
    const services = store.getServicesByCategory(this.category);
    services.forEach((service) => {
      const card = new ServiceCard(service);
      card.mount(grid);
      this.cards.set(service.id, card);
    });
  }
  refreshCards() {
    const services = store.getServicesByCategory(this.category);
    services.forEach((service) => {
      const existing = this.cards.get(service.id);
      if (existing !== void 0) {
        existing.updateService(service);
      }
    });
  }
  /**
   * Factory method — creates a CategoryView for a given category string.
   */
  static forCategory(categoryStr) {
    const category = Object.values(ServiceCategory).find((c) => c === categoryStr);
    return new CategoryView(category ?? ServiceCategory.Performance);
  }
}
class ThemeManager {
  static instance;
  currentSetting = "dark";
  mediaQuery;
  constructor() {
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  }
  static getInstance() {
    if (ThemeManager.instance === void 0) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }
  /**
   * Apply a theme setting. Call this on startup and whenever the user changes it.
   * @param setting - 'dark' | 'light' | 'system'
   */
  apply(setting) {
    this.currentSetting = setting;
    this.mediaQuery.removeEventListener("change", this.handleSystemChange);
    if (setting === "system") {
      this.applyResolved(this.resolveSystem());
      this.mediaQuery.addEventListener("change", this.handleSystemChange);
    } else {
      this.applyResolved(setting);
    }
  }
  /** Get the currently active resolved theme ('dark' or 'light') */
  getResolved() {
    if (this.currentSetting === "system") return this.resolveSystem();
    return this.currentSetting;
  }
  /** Get the current setting (may be 'system') */
  getSetting() {
    return this.currentSetting;
  }
  resolveSystem() {
    return this.mediaQuery.matches ? "dark" : "light";
  }
  applyResolved(theme) {
    const html = document.documentElement;
    html.classList.add("theme-transitioning");
    html.setAttribute("data-theme", theme);
    setTimeout(() => {
      html.classList.remove("theme-transitioning");
    }, 300);
  }
  handleSystemChange = () => {
    if (this.currentSetting === "system") {
      this.applyResolved(this.resolveSystem());
    }
  };
}
const themeManager = ThemeManager.getInstance();
class SettingsView extends Component {
  loginToggle = null;
  autoCheckToggle = null;
  constructor() {
    super("div", "settings-view");
  }
  render() {
    const settings = store.get("settings");
    const hasBackup = store.get("hasBackup");
    this.setHTML(`
      <div class="page-header">
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Configure Quieter behavior and manage backups</p>
      </div>

      <!-- About -->
      <div class="about-card">
        <!-- Gradient header band -->
        <div class="about-card-header">
          <div class="about-card-glow" aria-hidden="true"></div>
          <img
            src="./assets/icons/AppIcon128.png"
            width="72"
            height="72"
            alt="Quieter app icon"
            class="about-card-icon"
          />
          <div class="about-card-identity">
            <h2 class="about-card-name">${APP_NAME}</h2>
            <span class="about-card-tagline">macOS System Optimizer</span>
          </div>
        </div>

        <!-- Meta row -->
        <div class="about-card-meta">
          <div class="about-meta-item">
            <span class="about-meta-label">Version</span>
            <span class="about-meta-value">${APP_VERSION}</span>
          </div>
          <div class="about-meta-divider" aria-hidden="true"></div>
          <div class="about-meta-item">
            <span class="about-meta-label">Platform</span>
            <span class="about-meta-value">macOS 12+</span>
          </div>
          <div class="about-meta-divider" aria-hidden="true"></div>
          <div class="about-meta-item">
            <span class="about-meta-label">Services</span>
            <span class="about-meta-value">60 curated</span>
          </div>
        </div>

        <!-- Description -->
        <p class="about-card-desc">
          Quieter helps you reclaim performance on aging Macs by selectively managing
          background services — safely, transparently, and reversibly.
        </p>

        <!-- Action links -->
        <div class="about-card-actions">
          <a class="about-action-btn" id="link-github" href="#" aria-label="View source on GitHub">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"/>
            </svg>
            View on GitHub
          </a>
          <a class="about-action-btn" id="link-readme" href="#" aria-label="Read documentation">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
            </svg>
            Documentation
          </a>
          <a class="about-action-btn about-action-btn--issue" id="link-issue" href="#" aria-label="Report an issue">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            Report Issue
          </a>
        </div>

        <!-- Footer -->
        <div class="about-card-footer">
          <span>Built with Electron + TypeScript</span>
          <span class="about-footer-dot" aria-hidden="true">·</span>
          <span>Open Source</span>
          <span class="about-footer-dot" aria-hidden="true">·</span>
          <span>MIT License</span>
        </div>
      </div>

      <!-- General Settings -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-title">General</div>
          <div class="settings-section-desc">App behavior and startup options</div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Launch at Login</div>
            <div class="settings-row-desc">Start PeakMac automatically when you log in to macOS</div>
          </div>
          <div id="toggle-login"></div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Auto-check Service States on Startup</div>
            <div class="settings-row-desc">Read actual system service states when the app launches</div>
          </div>
          <div id="toggle-autocheck"></div>
        </div>
      </div>

      <!-- Appearance -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-title">Appearance</div>
          <div class="settings-section-desc">Choose how PeakMac looks</div>
        </div>

        <div class="settings-row" style="align-items: flex-start; padding-top: var(--space-4); padding-bottom: var(--space-4);">
          <div class="settings-row-info">
            <div class="settings-row-label">Theme</div>
            <div class="settings-row-desc">Switch between dark, light, or follow your macOS system setting</div>
          </div>
          <div class="theme-switcher" role="radiogroup" aria-label="Theme selection">
            ${["dark", "light", "system"].map((t) => `
              <button
                class="theme-option${settings.theme === t ? " active" : ""}"
                data-value="${t}"
                role="radio"
                aria-checked="${settings.theme === t}"
                aria-label="${t.charAt(0).toUpperCase() + t.slice(1)} theme"
              >
                <div class="theme-option-preview" aria-hidden="true">
                  <div class="preview-bar"></div>
                  <div class="preview-bar"></div>
                  <div class="preview-bar"></div>
                </div>
                ${t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-title">Backup & Restore</div>
          <div class="settings-section-desc">Manage service state snapshots</div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Restore from Backup</div>
            <div class="settings-row-desc">
              ${hasBackup ? "A backup snapshot exists. Restore all services to their state at last backup." : "No backup snapshot found. A snapshot is created automatically before applying changes."}
            </div>
          </div>
          <button
            class="btn ${hasBackup ? "btn-ghost" : "btn-ghost"}"
            id="btn-restore"
            ${!hasBackup ? "disabled" : ""}
            aria-label="Restore from backup"
          >
            Restore All
          </button>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Export System Report</div>
            <div class="settings-row-desc">Export a JSON report of all services and current system state</div>
          </div>
          <button class="btn btn-ghost" id="btn-export" aria-label="Export system report">
            Export JSON
          </button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-title">Danger Zone</div>
          <div class="settings-section-desc">Irreversible actions — use with caution</div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Re-enable All Services</div>
            <div class="settings-row-desc">Enable every service in the registry (restores macOS defaults)</div>
          </div>
          <button class="btn btn-danger" id="btn-enable-all" aria-label="Enable all services">
            Enable All
          </button>
        </div>
      </div>
    `);
    const loginContainer = this.queryOptional("#toggle-login");
    if (loginContainer !== null) {
      this.loginToggle = new Toggle({
        checked: settings.launchAtLogin,
        label: "Launch at login",
        onChange: (checked) => {
          void this.saveSetting("launchAtLogin", checked);
        }
      });
      this.loginToggle.mount(loginContainer);
    }
    const autoCheckContainer = this.queryOptional("#toggle-autocheck");
    if (autoCheckContainer !== null) {
      this.autoCheckToggle = new Toggle({
        checked: settings.autoCheckOnStartup,
        label: "Auto-check on startup",
        onChange: (checked) => {
          void this.saveSetting("autoCheckOnStartup", checked);
        }
      });
      this.autoCheckToggle.mount(autoCheckContainer);
    }
  }
  onMount() {
    this.bindActions();
  }
  bindActions() {
    const themeSwitcher = this.queryOptional(".theme-switcher");
    themeSwitcher?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-value]");
      if (btn === null) return;
      const value = btn.dataset["value"];
      if (value === void 0) return;
      void this.handleThemeChange(value);
    });
    const githubLink = this.queryOptional("#link-github");
    githubLink?.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(GITHUB_URL, "_blank");
    });
    const readmeLink = this.queryOptional("#link-readme");
    readmeLink?.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(`${GITHUB_URL}#readme`, "_blank");
    });
    const issueLink = this.queryOptional("#link-issue");
    issueLink?.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(`${GITHUB_URL}/issues`, "_blank");
    });
    const restoreBtn = this.queryOptional("#btn-restore");
    restoreBtn?.addEventListener("click", () => {
      void this.handleRestore();
    });
    const exportBtn = this.queryOptional("#btn-export");
    exportBtn?.addEventListener("click", () => {
      void this.handleExport();
    });
    const enableAllBtn = this.queryOptional("#btn-enable-all");
    enableAllBtn?.addEventListener("click", () => {
      this.handleEnableAll();
    });
  }
  async handleThemeChange(theme) {
    themeManager.apply(theme);
    const buttons = this.queryAll(".theme-option");
    buttons.forEach((btn) => {
      const isActive = btn.dataset["value"] === theme;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-checked", String(isActive));
    });
    await this.saveSetting("theme", theme);
  }
  async saveSetting(key, value) {
    const current = store.get("settings");
    const updated = { ...current, [key]: value };
    store.setSettings(updated);
    const result = await window.peakMacAPI.saveSettings(updated);
    if (result.success) {
      eventBus.emit("settings:saved");
      showToast("success", "Settings saved");
    } else {
      showToast("error", `Failed to save settings: ${result.error}`);
    }
  }
  async handleRestore() {
    const result = await window.peakMacAPI.revertAll();
    if (result.success) {
      showToast("success", "All services restored from backup");
      eventBus.emit("revert:done");
    } else {
      showToast("error", `Restore failed: ${result.error}`);
    }
  }
  async handleExport() {
    const result = await window.peakMacAPI.exportReport();
    if (!result.success) {
      showToast("error", `Export failed: ${result.error}`);
      return;
    }
    const blob = new Blob([result.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peakmac-report-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("success", "Report exported successfully");
  }
  handleEnableAll() {
    const services = store.get("services");
    services.forEach((s) => {
      store.togglePendingChange(s.id, ChangeAction.Enable);
    });
    showToast("info", `Marked ${services.length} services for enabling. Click Apply Changes to proceed.`);
  }
}
async function bootstrap() {
  const appEl = document.getElementById("app");
  if (appEl === null) throw new Error("Root #app element not found");
  if (typeof window.peakMacAPI === "undefined") {
    throw new Error(
      "window.peakMacAPI is not defined. The preload script failed to load. Check that contextBridge is working and the preload path is correct."
    );
  }
  themeManager.apply("dark");
  const sidebarCollapsed = localStorage.getItem("peakmac:sidebar-collapsed") === "true";
  document.documentElement.style.setProperty(
    "--sidebar-current-width",
    sidebarCollapsed ? "52px" : "var(--sidebar-width)"
  );
  const loadingEl = document.getElementById("app-loading");
  loadingEl?.remove();
  const topBar = new TopBar();
  topBar.mount(appEl);
  const layoutEl = document.createElement("div");
  layoutEl.className = "app-layout";
  appEl.appendChild(layoutEl);
  const sidebar = new Sidebar();
  sidebar.mount(layoutEl);
  const mainEl = document.createElement("main");
  mainEl.className = "app-main";
  mainEl.id = "main-content";
  mainEl.setAttribute("role", "main");
  layoutEl.appendChild(mainEl);
  const innerEl = document.createElement("div");
  innerEl.className = "app-main-inner";
  mainEl.appendChild(innerEl);
  const applyBar = new ApplyBar();
  applyBar.mount(appEl);
  const toastContainer = ToastContainer.getInstance();
  toastContainer.mount(appEl);
  router.setContainer(innerEl);
  router.register("#/dashboard", () => new DashboardView());
  router.register("#/services", () => new ServicesView());
  router.register("#/settings", () => new SettingsView());
  Object.values(ServiceCategory).forEach((category) => {
    router.register(`#/category/${category}`, () => CategoryView.forCategory(category));
  });
  await loadInitialData();
  router.start();
  const firstLaunchResult = await window.peakMacAPI.isFirstLaunch();
  if (firstLaunchResult.success && firstLaunchResult.data === true) {
    showOnboardingModal(() => {
      void window.peakMacAPI.markFirstLaunchDone();
    });
  }
  startStatsPolling();
}
async function loadInitialData() {
  store.set("isLoading", true);
  try {
    const [servicesResult, statsResult, settingsResult, backupResult] = await Promise.all([
      window.peakMacAPI.getServices(),
      window.peakMacAPI.getSystemStats(),
      window.peakMacAPI.getSettings(),
      window.peakMacAPI.hasBackup()
    ]);
    if (servicesResult.success) {
      store.setServices(servicesResult.data);
    } else {
      eventBus.emit("services:error", servicesResult.error ?? "Failed to load services");
    }
    if (statsResult.success) {
      store.setStats(statsResult.data);
    }
    if (settingsResult.success) {
      store.setSettings(settingsResult.data);
      themeManager.apply(settingsResult.data.theme);
    }
    if (backupResult.success) {
      store.set("hasBackup", backupResult.data);
    }
  } finally {
    store.set("isLoading", false);
  }
}
function startStatsPolling() {
  let timer = null;
  let isPending = false;
  const poll = () => {
    if (isPending) return;
    isPending = true;
    void window.peakMacAPI.getSystemStats().then((result) => {
      isPending = false;
      if (result.success) {
        store.setStats(result.data);
      }
    });
  };
  const start = () => {
    if (timer !== null) return;
    poll();
    timer = setInterval(poll, 3e3);
  };
  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });
  start();
}
bootstrap().catch((err) => {
  console.error("Quieter bootstrap failed:", err);
  const appEl = document.getElementById("app");
  if (appEl !== null) {
    appEl.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        flex-direction: column;
        gap: 12px;
        color: #F87171;
        font-family: -apple-system, sans-serif;
        font-size: 14px;
        background: #0D0D0F;
        padding: 24px;
        text-align: center;
      ">
        <p style="font-size: 18px; font-weight: 600;">Quieter failed to start</p>
        <p style="color: #9B9AAB;">${err instanceof Error ? err.message : String(err)}</p>
      </div>
    `;
  }
});
