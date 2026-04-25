/**
 * Shared TypeScript interfaces and enums used across main, preload, and renderer.
 * No Node.js or Electron imports allowed here.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ServiceCategory {
  Performance = 'Performance',
  Network = 'Network',
  Visuals = 'Visuals',
  Privacy = 'Privacy',
  Sync = 'Sync',
  Misc = 'Misc',
}

export enum RiskLevel {
  Safe = 'safe',
  Moderate = 'moderate',
  Advanced = 'advanced',
}

export enum ImpactLevel {
  None = 'none',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export enum ControlMethod {
  Launchctl = 'launchctl',
  Defaults = 'defaults',
  Hybrid = 'hybrid',
}

export enum ServiceState {
  Enabled = 'enabled',
  Disabled = 'disabled',
  Unknown = 'unknown',
}

export enum ChangeAction {
  Enable = 'enable',
  Disable = 'disable',
}

// ─── Service Data Model ───────────────────────────────────────────────────────

export interface DefaultsCommand {
  /** The defaults domain, e.g. "com.apple.CrashReporter" */
  domain: string;
  /** The defaults key, e.g. "DialogType" */
  key: string;
  /** The type flag for defaults write, e.g. "string" | "bool" | "int" */
  type: 'string' | 'bool' | 'int' | 'float';
  /** Value to write when disabling */
  disabledValue: string;
  /** Value to write when enabling */
  enabledValue: string;
}

export interface ServiceImpact {
  cpu: ImpactLevel;
  ram: ImpactLevel;
}

export interface MacService {
  /** Unique slug identifier, e.g. "spotlight-indexing" */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Service category for grouping */
  category: ServiceCategory;
  /** launchd bundle ID, e.g. "com.apple.Spotlight" */
  launchAgentId?: string;
  /** defaults write command details (for defaults-controlled services) */
  defaultsCommand?: DefaultsCommand;
  /** How this service is controlled */
  controlMethod: ControlMethod;
  /** Risk level of disabling this service */
  risk: RiskLevel;
  /** Performance impact when running */
  impact: ServiceImpact;
  /** Plain English description of what this service does */
  description: string;
  /** What the user gains by disabling this service */
  disableEffect: string;
  /** What the user loses if this service is disabled */
  enableEffect: string;
  /** macOS default state */
  defaultState: ServiceState;
  /** Whether a restart is required for the change to take effect */
  requiresRestart: boolean;
  /** Whether admin/sudo privileges are required */
  requiresAdmin: boolean;
}

// ─── Runtime State ────────────────────────────────────────────────────────────

export interface ServiceRuntimeState {
  serviceId: string;
  currentState: ServiceState;
  /** ISO timestamp of last state check */
  lastChecked: string;
}

export interface ServiceChange {
  serviceId: string;
  action: ChangeAction;
}

export interface ApplyProgress {
  total: number;
  completed: number;
  current: string;
  status: 'running' | 'success' | 'error' | 'rollingback';
  error?: string;
}

export interface ApplyResult {
  success: boolean;
  applied: number;
  failed: number;
  rolledBack: boolean;
  errors: string[];
}

// ─── System Stats ─────────────────────────────────────────────────────────────

export interface SystemStats {
  cpuUsagePercent: number;
  ramUsedGB: number;
  ramTotalGB: number;
  ramUsedPercent: number;
  activeServicesCount: number;
  disabledServicesCount: number;
  /** ISO timestamp */
  timestamp: string;
}

// ─── Result Type ──────────────────────────────────────────────────────────────

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// ─── IPC API Contract ─────────────────────────────────────────────────────────

export interface PeakMacAPI {
  /** Fetch all services with their current runtime states */
  getServices(): Promise<Result<ServiceWithState[]>>;
  /** Get current system CPU/RAM stats */
  getSystemStats(): Promise<Result<SystemStats>>;
  /** Apply a batch of service changes */
  applyChanges(changes: ServiceChange[]): Promise<Result<ApplyResult>>;
  /** Revert all changes from the last backup snapshot */
  revertAll(): Promise<Result<void>>;
  /** Export a full system report as JSON string */
  exportReport(): Promise<Result<string>>;
  /** Check if a backup snapshot exists */
  hasBackup(): Promise<Result<boolean>>;
  /** Register a callback for apply progress events */
  onApplyProgress(cb: (progress: ApplyProgress) => void): void;
  /** Remove apply progress listener */
  offApplyProgress(): void;
  /** Check if this is the first launch */
  isFirstLaunch(): Promise<Result<boolean>>;
  /** Mark first launch as complete */
  markFirstLaunchDone(): Promise<Result<void>>;
  /** Get app settings */
  getSettings(): Promise<Result<AppSettings>>;
  /** Save app settings */
  saveSettings(settings: AppSettings): Promise<Result<void>>;
}

// ─── Composite Types ──────────────────────────────────────────────────────────

export interface ServiceWithState extends MacService {
  runtimeState: ServiceRuntimeState;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  launchAtLogin: boolean;
  autoCheckOnStartup: boolean;
  theme: 'dark' | 'light' | 'system';
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface SystemReport {
  generatedAt: string;
  appVersion: string;
  macosVersion: string;
  systemStats: SystemStats;
  services: ServiceWithState[];
  settings: AppSettings;
}

// ─── Store State ──────────────────────────────────────────────────────────────

export interface AppState {
  services: ServiceWithState[];
  pendingChanges: Map<string, ChangeAction>;
  systemStats: SystemStats | null;
  isLoading: boolean;
  isApplying: boolean;
  applyProgress: ApplyProgress | null;
  searchQuery: string;
  activeCategory: ServiceCategory | 'all';
  settings: AppSettings;
  hasBackup: boolean;
  isFirstLaunch: boolean;
  error: string | null;
}
