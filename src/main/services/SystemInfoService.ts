/**
 * SystemInfoService — reads CPU and RAM usage using sysctl and vm_stat.
 * Polls every STATS_POLL_INTERVAL_MS and caches the latest result.
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

  private constructor() {}

  /** Get the singleton instance */
  public static getInstance(): SystemInfoService {
    if (SystemInfoService.instance === undefined) {
      SystemInfoService.instance = new SystemInfoService();
    }
    return SystemInfoService.instance;
  }

  /**
   * Update the service counts (called by ServiceManager after state reads).
   */
  public setServiceCounts(active: number, disabled: number): void {
    this.activeCount = active;
    this.disabledCount = disabled;
  }

  /**
   * Start polling system stats every STATS_POLL_INTERVAL_MS.
   */
  public startPolling(): void {
    if (this.pollTimer !== null) return;

    // Fetch immediately
    void this.fetchStats();

    this.pollTimer = setInterval(() => {
      void this.fetchStats();
    }, STATS_POLL_INTERVAL_MS);

    logger.info(CONTEXT, `Started polling every ${STATS_POLL_INTERVAL_MS}ms`);
  }

  /**
   * Stop polling.
   */
  public stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      logger.info(CONTEXT, 'Stopped polling');
    }
  }

  /**
   * Get the latest cached stats, or fetch fresh if none cached.
   */
  public async getStats(): Promise<Result<SystemStats>> {
    if (this.latestStats !== null) {
      return { success: true, data: this.latestStats };
    }
    return this.fetchStats();
  }

  /**
   * Fetch fresh system stats from sysctl and vm_stat.
   */
  private async fetchStats(): Promise<Result<SystemStats>> {
    const [cpuResult, ramResult] = await Promise.all([
      this.getCpuUsage(),
      this.getRamUsage(),
    ]);

    if (!cpuResult.success) {
      logger.warn(CONTEXT, 'Failed to get CPU usage', { error: cpuResult.error });
    }
    if (!ramResult.success) {
      logger.warn(CONTEXT, 'Failed to get RAM usage', { error: ramResult.error });
    }

    const stats: SystemStats = {
      cpuUsagePercent: cpuResult.success ? cpuResult.data : 0,
      ramUsedGB: ramResult.success ? ramResult.data.usedGB : 0,
      ramTotalGB: ramResult.success ? ramResult.data.totalGB : 0,
      ramUsedPercent: ramResult.success ? ramResult.data.usedPercent : 0,
      activeServicesCount: this.activeCount,
      disabledServicesCount: this.disabledCount,
      timestamp: new Date().toISOString(),
    };

    this.latestStats = stats;
    return { success: true, data: stats };
  }

  /**
   * Get CPU usage percentage using sysctl.
   * Uses cpu load averages as a proxy for current usage.
   */
  private async getCpuUsage(): Promise<Result<number>> {
    // Get 1-minute load average and number of logical CPUs
    const [loadResult, cpuCountResult] = await Promise.all([
      safeExecOutput(SYSCTL, ['-n', 'vm.loadavg'], CONTEXT),
      safeExecOutput(SYSCTL, ['-n', 'hw.logicalcpu'], CONTEXT),
    ]);

    if (!loadResult.success || !cpuCountResult.success) {
      return { success: false, error: 'Failed to read CPU stats', code: 'CPU_READ_FAILED' };
    }

    // vm.loadavg output: "{ 1.23 2.34 3.45 }"
    const loadMatch = loadResult.data.match(/\{\s*([\d.]+)/);
    if (loadMatch === null || loadMatch[1] === undefined) {
      return { success: false, error: 'Failed to parse load average', code: 'CPU_PARSE_FAILED' };
    }

    const loadAvg = parseFloat(loadMatch[1]);
    const cpuCount = parseInt(cpuCountResult.data, 10);

    if (isNaN(loadAvg) || isNaN(cpuCount) || cpuCount === 0) {
      return { success: false, error: 'Invalid CPU data', code: 'CPU_INVALID' };
    }

    // Convert load average to percentage (capped at 100%)
    const usagePercent = Math.min(100, Math.round((loadAvg / cpuCount) * 100));
    return { success: true, data: usagePercent };
  }

  /**
   * Get RAM usage by parsing vm_stat output.
   */
  private async getRamUsage(): Promise<Result<{ usedGB: number; totalGB: number; usedPercent: number }>> {
    const [vmStatResult, totalRamResult] = await Promise.all([
      safeExecOutput(VM_STAT, [], CONTEXT),
      safeExecOutput(SYSCTL, ['-n', 'hw.memsize'], CONTEXT),
    ]);

    if (!vmStatResult.success || !totalRamResult.success) {
      return { success: false, error: 'Failed to read RAM stats', code: 'RAM_READ_FAILED' };
    }

    // Parse total RAM in bytes
    const totalBytes = parseInt(totalRamResult.data, 10);
    if (isNaN(totalBytes)) {
      return { success: false, error: 'Failed to parse total RAM', code: 'RAM_PARSE_FAILED' };
    }

    // Parse vm_stat output
    // vm_stat reports pages; page size is typically 4096 bytes on macOS
    const pageSize = 4096;
    const vmOutput = vmStatResult.data;

    const parseVmStat = (label: string): number => {
      const match = vmOutput.match(new RegExp(`${label}:\\s+(\\d+)`));
      if (match === null || match[1] === undefined) return 0;
      return parseInt(match[1], 10) * pageSize;
    };

    const freeBytes = parseVmStat('Pages free');
    const activeBytes = parseVmStat('Pages active');
    const inactiveBytes = parseVmStat('Pages inactive');
    const wiredBytes = parseVmStat('Pages wired down');
    const compressedBytes = parseVmStat('Pages occupied by compressor');

    const usedBytes = activeBytes + wiredBytes + compressedBytes;
    const totalGB = totalBytes / (1024 ** 3);
    const usedGB = usedBytes / (1024 ** 3);
    const usedPercent = Math.min(100, Math.round((usedBytes / totalBytes) * 100));

    logger.debug(CONTEXT, 'RAM stats', {
      totalGB: totalGB.toFixed(1),
      usedGB: usedGB.toFixed(1),
      freeGB: (freeBytes / (1024 ** 3)).toFixed(1),
      inactiveGB: (inactiveBytes / (1024 ** 3)).toFixed(1),
    });

    return {
      success: true,
      data: {
        usedGB: Math.round(usedGB * 10) / 10,
        totalGB: Math.round(totalGB * 10) / 10,
        usedPercent,
      },
    };
  }
}
