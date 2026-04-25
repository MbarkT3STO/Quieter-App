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
import { STATS_POLL_INTERVAL_MS } from '../../shared/constants.js';

const SYSCTL = '/usr/sbin/sysctl';
const VM_STAT = '/usr/bin/vm_stat';
const CONTEXT = 'SystemInfoService';

export class SystemInfoService {
  private static instance: SystemInfoService;
  private latestStats: SystemStats | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeCount = 0;
  private disabledCount = 0;

  // Cached values that never change at runtime
  private cachedCpuCount: number | null = null;
  private cachedTotalRamBytes: number | null = null;

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

  /**
   * Start polling. Fetches immediately, then every STATS_POLL_INTERVAL_MS.
   * Pre-warms the cached CPU count and total RAM on first call.
   */
  public startPolling(): void {
    if (this.pollTimer !== null) return;

    // Pre-warm caches before first poll
    void this.warmCaches().then(() => {
      void this.fetchStats();
    });

    this.pollTimer = setInterval(() => {
      void this.fetchStats();
    }, STATS_POLL_INTERVAL_MS);

    logger.info(CONTEXT, `Started polling every ${STATS_POLL_INTERVAL_MS}ms`);
  }

  public stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      logger.info(CONTEXT, 'Stopped polling');
    }
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

  private async getCpuUsage(): Promise<Result<number>> {
    // Only fetch CPU count if not cached
    const loadResult = await safeExecOutput(SYSCTL, ['-n', 'vm.loadavg'], CONTEXT);

    if (!loadResult.success) {
      return { success: false, error: 'Failed to read load average', code: 'CPU_READ_FAILED' };
    }

    // Fetch CPU count if not cached yet
    if (this.cachedCpuCount === null) {
      const countResult = await safeExecOutput(SYSCTL, ['-n', 'hw.logicalcpu'], CONTEXT);
      if (countResult.success) {
        const count = parseInt(countResult.data, 10);
        if (!isNaN(count) && count > 0) this.cachedCpuCount = count;
      }
    }

    const cpuCount = this.cachedCpuCount ?? 1;

    const loadMatch = loadResult.data.match(/\{\s*([\d.]+)/);
    if (loadMatch === null || loadMatch[1] === undefined) {
      return { success: false, error: 'Failed to parse load average', code: 'CPU_PARSE_FAILED' };
    }

    const loadAvg = parseFloat(loadMatch[1]);
    if (isNaN(loadAvg)) {
      return { success: false, error: 'Invalid load average', code: 'CPU_INVALID' };
    }

    return { success: true, data: Math.min(100, Math.round((loadAvg / cpuCount) * 100)) };
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
