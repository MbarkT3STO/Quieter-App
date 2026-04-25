/**
 * Type declarations for window.peakMacAPI exposed via contextBridge.
 * Referenced via tsconfig paths — no runtime import.
 */

import type { PeakMacAPI } from '../shared/types.js';

declare global {
  interface Window {
    peakMacAPI: PeakMacAPI;
  }
}

export {};
