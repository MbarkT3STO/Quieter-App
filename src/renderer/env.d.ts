/**
 * Renderer-side type augmentation for window.peakMacAPI.
 * The actual implementation is injected by the preload script via contextBridge.
 */

import type { PeakMacAPI } from '../shared/types.js';

declare global {
  interface Window {
    peakMacAPI: PeakMacAPI;
  }
}

export {};
