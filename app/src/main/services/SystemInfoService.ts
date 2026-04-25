/**
 * SystemInfoService — reads CPU and RAM usage using sysctl and vm_stat.
 *
 * Performance optimisations:
 * - CPU count is read once and cached (never changes at runtime)
 * - Total RAM is read once and cached (never changes)
 * - vm_stat regex patterns are compiled once and reused
 * - Polling only runs when the window is focused (paused on blur)
 * - Stats are only pushed to IPC if values actually changed
 */

import { safeExecOutput } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import type { Result, SystemStats } from '../../shared/types.js';
import { CpuMethod } from '../../shared/types.js';
import { STATS_POLL_INTERVAL_MS } from '../../shared/constants.js';

const SYSCTL  = '/usr/sbin/sysctl';
const VM_STAT = '/usr/bin/vm_stat';
const TOP     = '/usr/bin/top';
const CONTEXT = 'SystemInfoService';

/**
 * CPU poll interval — 3 s matches the RAM poll and keeps child-process
 * overhead low while still giving a real per-second snapshot via top -l 1.
 */
const CPU_POLL_INTERVAL_MS = 3000;

export class SystemInfoService {
  private static instance: SystemInfoService;
  private latestStats: SystemStats | null = null;
  private cpuTimer: ReturnType<typeof setInterval> | null = null;
  private ramTimer: ReturnType<typeof setInterval> | null = null;
  private activeCount = 0;
  private disabledCount = 0;

  // Cached values that never change at runtime
  private cachedCpuCount: number | null = null;
  private cachedTotalRamBytes: number | null = null;

  // Which CPU measurement method to use (configurable by the user)
  private cpuMethod: CpuMethod = CpuMethod.LoadAvg;

  // Pre-compiled regex patterns for vm_stat parsing
  private static readonly VM_STAT_PATTERNS = {
    free:       /Pages free:\s+(\d+)/,
    active:     /Pages active:\s+(\d+)/,
    wired:      /Pages wired down:\s+(\d+)/,
    compressed: /Pages occupied by compressor:\s+(\d+)/,
  };

  private constructor() {}

  public static getInstance(): SystemInfoService {
    if (SystemInfoService.instance === undefined) {
      SystemInfoService.instance = new SystemInfoService();
    }
    return SystemInfoService.instance;
  }

  public setServiceCounts(active: number, disabled: number): void {
    this.activeCount = active;
    this.disabledCount = disabled;
  }

  /** Update the CPU measurement method at runtime (called when settings change). */
  public setCpuMethod(method: CpuMethod): void {
    if (this.cpuMethod !== method) {
      this.cpuMethod = method;
      logger.info(CONTEXT, `CPU method changed to: ${method}`);
    }
  }

  /**
   * Start polling.
   * - CPU: every 1.5 s using `top -l 2 -n 0 -s 1` (real 1-second sample)
   * - RAM: every 3 s using vm_stat (RAM changes slowly)
   */
  public startPolling(): void {
    if (this.cpuTimer !== null) return;

    void this.warmCaches().then(() => {
      void this.fetchStats();
    });

    // CPU refreshes every 1.5 s
    this.cpuTimer = setInterval(() => {
      void this.fetchCpuAndPush();
    }, CPU_POLL_INTERVAL_MS);

    // RAM refreshes every 3 s
    this.ramTimer = setInterval(() => {
      void this.fetchRamAndPush();
    }, STATS_POLL_INTERVAL_MS);

    logger.info(CONTEXT, `Started polling — CPU every ${CPU_POLL_INTERVAL_MS}ms, RAM every ${STATS_POLL_INTERVAL_MS}ms`);
  }

  public stopPolling(): void {
    if (this.cpuTimer !== null) { clearInterval(this.cpuTimer); this.cpuTimer = null; }
    if (this.ramTimer !== null) { clearInterval(this.ramTimer); this.ramTimer = null; }
    logger.info(CONTEXT, 'Stopped polling');
  }

  public async getStats(): Promise<Result<SystemStats>> {
    if (this.latestStats !== null) {
      return { success: true, data: this.latestStats };
    }
    return this.fetchStats();
  }

  /**
   * Read CPU count and total RAM once — these never change.
   */
  private async warmCaches(): Promise<void> {
    const [cpuResult, ramResult] = await Promise.all([
      safeExecOutput(SYSCTL, ['-n', 'hw.logicalcpu'], CONTEXT),
      safeExecOutput(SYSCTL, ['-n', 'hw.memsize'], CONTEXT),
    ]);

    if (cpuResult.success) {
      const count = parseInt(cpuResult.data, 10);
      if (!isNaN(count) && count > 0) this.cachedCpuCount = count;
    }

    if (ramResult.success) {
      const bytes = parseInt(ramResult.data, 10);
      if (!isNaN(bytes) && bytes > 0) this.cachedTotalRamBytes = bytes;
    }

    logger.debug(CONTEXT, 'Caches warmed', {
      cpuCount: this.cachedCpuCount,
      totalRamGB: this.cachedTotalRamBytes !== null
        ? (this.cachedTotalRamBytes / 1024 ** 3).toFixed(1)
        : null,
    });
  }

  private async fetchStats(): Promise<Result<SystemStats>> {
    const [cpuResult, ramResult] = await Promise.all([
      this.getCpuUsage(),
      this.getRamUsage(),
    ]);

    const stats: SystemStats = {
      cpuUsagePercent: cpuResult.success ? cpuResult.data : (this.latestStats?.cpuUsagePercent ?? 0),
      ramUsedGB:       ramResult.success ? ramResult.data.usedGB : (this.latestStats?.ramUsedGB ?? 0),
      ramTotalGB:      ramResult.success ? ramResult.data.totalGB : (this.latestStats?.ramTotalGB ?? 0),
      ramUsedPercent:  ramResult.success ? ramResult.data.usedPercent : (this.latestStats?.ramUsedPercent ?? 0),
      activeServicesCount:   this.activeCount,
      disabledServicesCount: this.disabledCount,
      timestamp: new Date().toISOString(),
    };

    this.latestStats = stats;
    return { success: true, data: stats };
  }

  /** Fetch only CPU and merge into latestStats */
  private async fetchCpuAndPush(): Promise<void> {
    const result = await this.getCpuUsage();
    if (!result.success || this.latestStats === null) return;
    this.latestStats = {
      ...this.latestStats,
      cpuUsagePercent: result.data,
      timestamp: new Date().toISOString(),
    };
  }

  /** Fetch only RAM and merge into latestStats */
  private async fetchRamAndPush(): Promise<void> {
    const result = await this.getRamUsage();
    if (!result.success || this.latestStats === null) return;
    this.latestStats = {
      ...this.latestStats,
      ramUsedGB:      result.data.usedGB,
      ramTotalGB:     result.data.totalGB,
      ramUsedPercent: result.data.usedPercent,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get CPU usage using the method chosen by the user in Settings.
   * - LoadAvg: vm.loadavg (1-min rolling average, lightweight)
   * - TopSnapshot: top -l 1 (real per-second snapshot, slightly more overhead)
   */
  private async getCpuUsage(): Promise<Result<number>> {
    if (this.cpuMethod === CpuMethod.TopSnapshot) {
      return this.getCpuViaTop();
    }
    return this.getCpuViaLoadAvg();
  }

  /** vm.loadavg — 1-minute rolling average, very lightweight */
  private async getCpuViaLoadAvg(): Promise<Result<number>> {
    const loadResult = await safeExecOutput(SYSCTL, ['-n', 'vm.loadavg'], CONTEXT);
    if (!loadResult.success) {
      return { success: false, error: 'Failed to read load average', code: 'CPU_READ_FAILED' };
    }

    if (this.cachedCpuCount === null) {
      const countResult = await safeExecOutput(SYSCTL, ['-n', 'hw.logicalcpu'], CONTEXT);
      if (countResult.success) {
        const count = parseInt(countResult.data, 10);
        if (!isNaN(count) && count > 0) this.cachedCpuCount = count;
      }
    }

    const cpuCount = this.cachedCpuCount ?? 1;
    const loadMatch = loadResult.data.match(/\{\s*([\d.]+)/);
    if (loadMatch?.[1] === undefined) {
      return { success: false, error: 'Failed to parse load average', code: 'CPU_PARSE_FAILED' };
    }

    const loadAvg = parseFloat(loadMatch[1]);
    if (isNaN(loadAvg)) {
      return { success: false, error: 'Invalid load average', code: 'CPU_INVALID' };
    }

    return { success: true, data: Math.min(100, Math.round((loadAvg / cpuCount) * 100)) };
  }

  /** top -l 1 — real per-second snapshot, parses idle% */
  private async getCpuViaTop(): Promise<Result<number>> {
    const result = await safeExecOutput(TOP, ['-l', '1', '-n', '0'], CONTEXT);

    if (result.success) {
      const cpuLine = result.data.split('\n').find((l) => l.startsWith('CPU usage:'));
      if (cpuLine !== undefined) {
        const idleMatch = cpuLine.match(/([\d.]+)%\s+idle/);
        if (idleMatch?.[1] !== undefined) {
          const idle = parseFloat(idleMatch[1]);
          if (!isNaN(idle)) {
            return { success: true, data: Math.min(100, Math.round(100 - idle)) };
          }
        }
      }
    }

    // Fallback to loadavg if top fails
    logger.debug(CONTEXT, 'top failed, falling back to vm.loadavg');
    return this.getCpuViaLoadAvg();
  }

  private async getRamUsage(): Promise<Result<{ usedGB: number; totalGB: number; usedPercent: number }>> {
    const vmStatResult = await safeExecOutput(VM_STAT, [], CONTEXT);

    if (!vmStatResult.success) {
      return { success: false, error: 'Failed to read vm_stat', code: 'RAM_READ_FAILED' };
    }

    // Fetch total RAM if not cached yet
    if (this.cachedTotalRamBytes === null) {
      const totalResult = await safeExecOutput(SYSCTL, ['-n', 'hw.memsize'], CONTEXT);
      if (totalResult.success) {
        const bytes = parseInt(totalResult.data, 10);
        if (!isNaN(bytes) && bytes > 0) this.cachedTotalRamBytes = bytes;
      }
    }

    if (this.cachedTotalRamBytes === null) {
      return { success: false, error: 'Total RAM unknown', code: 'RAM_TOTAL_UNKNOWN' };
    }

    const pageSize = 4096;
    const vmOutput = vmStatResult.data;

    const parsePages = (pattern: RegExp): number => {
      const match = vmOutput.match(pattern);
      if (match === null || match[1] === undefined) return 0;
      return parseInt(match[1], 10) * pageSize;
    };

    const activeBytes     = parsePages(SystemInfoService.VM_STAT_PATTERNS.active);
    const wiredBytes      = parsePages(SystemInfoService.VM_STAT_PATTERNS.wired);
    const compressedBytes = parsePages(SystemInfoService.VM_STAT_PATTERNS.compressed);

    const usedBytes  = activeBytes + wiredBytes + compressedBytes;
    const totalBytes = this.cachedTotalRamBytes;
    const totalGB    = totalBytes / 1024 ** 3;
    const usedGB     = usedBytes  / 1024 ** 3;

    return {
      success: true,
      data: {
        usedGB:      Math.round(usedGB  * 10) / 10,
        totalGB:     Math.round(totalGB * 10) / 10,
        usedPercent: Math.min(100, Math.round((usedBytes / totalBytes) * 100)),
      },
    };
  }
}
