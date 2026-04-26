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

/** How CPU usage is measured in the dashboard */
export enum CpuMethod {
  /** 1-minute rolling average via vm.loadavg — lightweight, less reactive */
  LoadAvg = 'loadavg',
  /** Real per-second snapshot via top -l 1 — accurate, slightly more overhead */
  TopSnapshot = 'top',
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

/**
 * Alternative command to achieve the same effect when SIP prevents
 * direct launchctl control, or when the service auto-re-enables.
 * If defined on a service, the app will use this instead of
 * launchctl disable/bootout for that service.
 */
export interface SipAlternative {
  /** The executable path for the disable command */
  disableCmd: string;
  /** Arguments for the disable command */
  disableArgs: string[];
  /** The executable path for the enable command */
  enableCmd: string;
  /** Arguments for the enable command */
  enableArgs: string[];
  /** The executable path for checking current state (optional) */
  stateCheckCmd?: string;
  /** Arguments for the state check command */
  stateCheckArgs?: string[];
  /**
   * How to interpret the state check output.
   * 'outputContains' — if stdout contains `stateCheckDisabledValue`, service is disabled.
   * 'exitCode' — exit code 0 = last command succeeded, check output.
   */
  stateCheckMode?: 'outputContains' | 'exitCode';
  /** String to look for in state check output to determine disabled state */
  stateCheckDisabledValue?: string;
  /** Brief explanation of the mechanism, shown to user */
  mechanism: string;
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
  /**
   * Whether this service is protected by System Integrity Protection (SIP).
   * SIP-protected services can only be disabled after booting into Recovery Mode
   * and running `csrutil disable`. Toggling them while SIP is active will fail.
   */
  requiresSip?: boolean;
  /**
   * Alternative command that achieves the same user-visible effect without
   * needing to launchctl disable the SIP-protected daemon.
   * When defined, the app routes disable/enable through this instead.
   * Also used for services that auto-re-enable after reboot.
   */
  sipAlternative?: SipAlternative;
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
  /** Services that were applied successfully but did not change state as expected */
  verificationMismatches?: Array<{
    serviceId: string;
    serviceName: string;
    expectedState: ServiceState;
    actualState: ServiceState;
  }>;
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
  /** Enable or disable Persistent Enforcer (launch at login with --hidden) */
  setEnforcerMode(enabled: boolean): Promise<Result<void>>;
  /** Check whether Persistent Enforcer is currently active */
  getEnforcerMode(): Promise<Result<boolean>>;
  /** Get change history log */
  getHistory(): Promise<Result<HistoryEntry[]>>;
  /** Clear change history log */
  clearHistory(): Promise<Result<void>>;
  /** Check if intent file exists (enforcer has data to work with) */
  hasIntent(): Promise<Result<boolean>>;
  /** Get current System Integrity Protection (SIP) status */
  getSipStatus(): Promise<Result<boolean>>;
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
  /** CPU measurement method shown in the dashboard */
  cpuMethod: CpuMethod;
}

// ─── Intent & History ─────────────────────────────────────────────────────────

export interface UserIntent {
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Map of serviceId → intended state after user's last successful apply */
  intendedStates: Record<string, ServiceState>;
}

export interface HistoryEntry {
  id: string;           // unique: timestamp + serviceId
  timestamp: string;    // ISO
  action: ChangeAction;
  serviceId: string;
  serviceName: string;
  success: boolean;
  error?: string;
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
  sipActive: boolean;
  error: string | null;
}
