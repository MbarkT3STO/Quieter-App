/**
 * Preset profiles — curated bundles of services to disable for common use cases.
 */

export interface ServicePreset {
  id: string;
  name: string;
  description: string;
  icon: string;         // inline SVG path data
  serviceIds: string[]; // service IDs to DISABLE when preset is applied
  maxRisk: 'safe' | 'moderate';
}

export const PRESETS: ServicePreset[] = [
  {
    id: 'safe-boost',
    name: 'Safe Boost',
    description: 'Disables non-essential services with zero risk. Best starting point for any Mac.',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    serviceIds: [
      'game-center',
      'airdrop-discovery',
      'app-nap',
      'netbios-daemon',
      'notification-animations',
      'dock-animation',
      'window-shadows',
      'transparency-blur',
      'reduce-motion',
    ],
    maxRisk: 'safe',
  },
  {
    id: 'privacy-focus',
    name: 'Privacy Focus',
    description: 'Stops telemetry, crash reporting, and data collection daemons.',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    serviceIds: [
      'crash-reporter',
      'diagnostics-usage',
      'analytics-helper',
      'tailspin',
      'screen-time-analytics',
      'siri-data-collection',
      'knowledge-agent',
    ],
    maxRisk: 'safe',
  },
  {
    id: 'performance-mode',
    name: 'Performance Mode',
    description: 'Aggressive optimization — disables indexing, photo analysis, and sync agents.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    serviceIds: [
      'spotlight-indexing',
      'knowledge-agent',
      'photos-library-agent',
      'universal-access-zoom',
      'sudden-motion-sensor',
    ],
    maxRisk: 'moderate',
  },
];
