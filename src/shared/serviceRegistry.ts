/**
 * PeakMac Service Registry
 * Curated database of macOS background services that can be safely managed.
 * All launchd bundle IDs and defaults keys verified against macOS internals.
 * @see https://developer.apple.com/documentation/servicemanagement
 */

import {
  MacService,
  ServiceCategory,
  RiskLevel,
  ImpactLevel,
  ControlMethod,
  ServiceState,
} from './types.js';

// ─── Performance Category ─────────────────────────────────────────────────────

const performanceServices: MacService[] = [
  {
    id: 'spotlight-indexing',
    name: 'Spotlight Indexing',
    category: ServiceCategory.Performance,
    launchAgentId: 'com.apple.metadata.mds',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.Medium },
    description:
      'Spotlight indexes your entire disk so you can search files, emails, and apps instantly. ' +
      'The mds and mdworker processes continuously monitor file changes and update the search index.',
    disableEffect:
      'Eliminates heavy disk I/O and CPU spikes caused by background indexing. ' +
      'Significant performance gain on HDDs and older SSDs.',
    enableEffect:
      'Spotlight search (Cmd+Space) will no longer find files, emails, or documents. ' +
      'Finder search and Quick Look previews may also be affected.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://developer.apple.com/library/archive/documentation/Carbon/Conceptual/MetadataIntro/MetadataIntro.html
  },
  {
    id: 'app-nap',
    name: 'App Nap',
    category: ServiceCategory.Performance,
    defaultsCommand: {
      domain: 'NSGlobalDomain',
      key: 'NSAppSleepDisabled',
      type: 'bool',
      disabledValue: '1',
      enabledValue: '0',
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description:
      'App Nap throttles background apps that are not visible on screen, reducing their CPU and ' +
      'timer activity to save battery and free resources for foreground tasks.',
    disableEffect:
      'Background apps run at full speed even when hidden. Useful if background apps (e.g. music ' +
      'players, download managers) are being throttled unexpectedly.',
    enableEffect:
      'Background apps may be throttled by macOS, which is the intended behavior for battery savings.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/AppNap.html
  },
  {
    id: 'sudden-motion-sensor',
    name: 'Sudden Motion Sensor',
    category: ServiceCategory.Performance,
    controlMethod: ControlMethod.Launchctl,
    launchAgentId: 'com.apple.sms',
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description:
      'The Sudden Motion Sensor daemon monitors accelerometer data on MacBooks to park hard drive ' +
      'heads if a sudden drop or impact is detected, preventing data loss.',
    disableEffect:
      'Removes a small background polling process. Safe to disable on Macs with SSDs only ' +
      '(no spinning hard drive to protect).',
    enableEffect:
      'HDD heads will not be parked on sudden movement. Only relevant if you have a spinning hard drive.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://support.apple.com/en-us/HT201666
  },
  {
    id: 'universal-access-zoom',
    name: 'Accessibility Zoom Daemon',
    category: ServiceCategory.Performance,
    launchAgentId: 'com.apple.universalaccessd',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'Manages accessibility zoom features including screen magnification and display accommodations ' +
      'for users with visual impairments.',
    disableEffect:
      'Frees a small amount of RAM and removes a background daemon. Safe if you do not use ' +
      'macOS accessibility zoom features.',
    enableEffect:
      'Screen zoom (Accessibility > Zoom) and related display accommodations will not function.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/guide/mac-help/zoom-in-on-whats-on-the-screen-mh40579/mac
  },
  {
    id: 'game-center',
    name: 'Game Center',
    category: ServiceCategory.Performance,
    launchAgentId: 'com.apple.gamed',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'Game Center daemon handles multiplayer matchmaking, leaderboards, achievements, and friend ' +
      'activity for games that integrate with Apple\'s Game Center platform.',
    disableEffect:
      'Removes a background daemon that most users never interact with directly. ' +
      'Frees RAM and eliminates periodic network activity.',
    enableEffect:
      'Game Center features (leaderboards, multiplayer, achievements) in supported games will not work.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://developer.apple.com/game-center/
  },
  {
    id: 'knowledge-agent',
    name: 'Siri Knowledge Agent',
    category: ServiceCategory.Performance,
    launchAgentId: 'com.apple.knowledge-agent',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description:
      'Builds and maintains the on-device knowledge graph used by Siri Suggestions, Spotlight ' +
      'suggestions, and the "Siri & Search" feature that learns your app usage patterns.',
    disableEffect:
      'Reduces background CPU and RAM usage. Siri Suggestions and app usage learning will be degraded.',
    enableEffect:
      'Siri Suggestions in Spotlight and app recommendations will be less accurate or absent.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/guide/mac-help/use-siri-suggestions-mchl4f5d4a9/mac
  },
  {
    id: 'photos-library-agent',
    name: 'Photos Library Agent',
    category: ServiceCategory.Performance,
    launchAgentId: 'com.apple.photolibraryd',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description:
      'Manages the Photos library database, handles face recognition, scene analysis, memory ' +
      'creation, and keeps the Photos library index up to date.',
    disableEffect:
      'Stops background photo analysis (face recognition, scene detection). Reduces CPU and RAM ' +
      'usage significantly when Photos library is large.',
    enableEffect:
      'Photos app may show stale data or fail to open until the daemon is re-enabled. ' +
      'Face recognition and Memories features will not update.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/guide/photos/welcome/mac
  },
];

// ─── Network Category ─────────────────────────────────────────────────────────

const networkServices: MacService[] = [
  {
    id: 'airdrop-discovery',
    name: 'AirDrop Discovery',
    category: ServiceCategory.Network,
    defaultsCommand: {
      domain: 'com.apple.NetworkBrowser',
      key: 'DisableAirDrop',
      type: 'bool',
      disabledValue: '1',
      enabledValue: '0',
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description:
      'AirDrop uses Bluetooth and Wi-Fi to discover nearby Apple devices for peer-to-peer file ' +
      'transfers. The discovery process broadcasts your device presence continuously.',
    disableEffect:
      'Stops continuous Bluetooth/Wi-Fi broadcasting for device discovery. ' +
      'Reduces wireless radio activity and minor battery drain.',
    enableEffect:
      'AirDrop will not be discoverable by other Apple devices. You cannot receive AirDrop transfers.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/en-us/HT203106
  },
  {
    id: 'bonjour-mdns',
    name: 'Bonjour / mDNSResponder',
    category: ServiceCategory.Network,
    launchAgentId: 'com.apple.mDNSResponder',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Advanced,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'mDNSResponder implements Bonjour (zero-configuration networking), enabling automatic ' +
      'discovery of printers, AirPlay devices, shared drives, and other network services without ' +
      'manual configuration.',
    disableEffect:
      'Removes network discovery daemon. May improve privacy on untrusted networks by stopping ' +
      'multicast DNS broadcasts.',
    enableEffect:
      'AirPrint, AirPlay, network printer discovery, shared drives, and many local network ' +
      'services will stop working. DNS resolution may also be affected.',
    defaultState: ServiceState.Enabled,
    requiresRestart: true,
    requiresAdmin: true,
    // sourceUrl: https://developer.apple.com/bonjour/
  },
  {
    id: 'location-services',
    name: 'Location Services',
    category: ServiceCategory.Network,
    launchAgentId: 'com.apple.locationd',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'Location Services daemon provides GPS/Wi-Fi/cell-based location data to apps that request ' +
      'it. Runs continuously in the background to maintain location awareness.',
    disableEffect:
      'Stops background location polling. Improves privacy and reduces minor battery/CPU usage ' +
      'from continuous location updates.',
    enableEffect:
      'Maps, weather apps, Find My, and any app using location will not receive location data.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://support.apple.com/en-us/HT204690
  },
  {
    id: 'remote-login-ssh',
    name: 'Remote Login (SSH)',
    category: ServiceCategory.Network,
    launchAgentId: 'com.openssh.sshd',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description:
      'OpenSSH daemon listens for incoming SSH connections, allowing remote terminal access to ' +
      'your Mac. Disabled by default on most Macs; only active if you enabled Remote Login.',
    disableEffect:
      'Closes the SSH port (22). Removes a potential remote access vector. ' +
      'Recommended for most users who do not need remote terminal access.',
    enableEffect: 'No one can SSH into your Mac remotely.',
    defaultState: ServiceState.Disabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://support.apple.com/guide/mac-help/allow-a-remote-computer-to-access-your-mac-mchlp1066/mac
  },
  {
    id: 'bluetooth-daemon',
    name: 'Bluetooth Daemon',
    category: ServiceCategory.Network,
    launchAgentId: 'com.apple.bluetoothd',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Advanced,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'Core Bluetooth daemon that manages all Bluetooth hardware, pairing, connections, and ' +
      'communication with Bluetooth devices including keyboards, mice, headphones, and AirPods.',
    disableEffect:
      'Completely disables Bluetooth. Eliminates Bluetooth radio activity and associated ' +
      'background processing.',
    enableEffect:
      'All Bluetooth devices (keyboard, mouse, AirPods, etc.) will stop working immediately.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://developer.apple.com/documentation/corebluetooth
  },
  {
    id: 'netbios-daemon',
    name: 'NetBIOS Daemon',
    category: ServiceCategory.Network,
    launchAgentId: 'com.apple.netbiosd',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description:
      'NetBIOS daemon provides Windows network compatibility for SMB file sharing and Windows ' +
      'workgroup/domain discovery on local networks.',
    disableEffect:
      'Removes a legacy Windows-compatibility daemon. Safe for users who do not share files ' +
      'with Windows machines on a local network.',
    enableEffect:
      'Windows network discovery and some SMB file sharing features may not work correctly.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://support.apple.com/guide/mac-help/connect-mac-shared-computers-servers-mchlp1140/mac
  },
];

// ─── Visuals Category ─────────────────────────────────────────────────────────

const visualsServices: MacService[] = [
  {
    id: 'transparency-blur',
    name: 'Transparency & Blur Effects',
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: 'com.apple.universalaccess',
      key: 'reduceTransparency',
      type: 'bool',
      disabledValue: '1',
      enabledValue: '0',
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description:
      'macOS renders real-time blur and transparency effects for the menu bar, Dock, sidebars, ' +
      'and notification center. These effects require continuous GPU compositing.',
    disableEffect:
      'Replaces translucent surfaces with solid colors. Noticeably reduces GPU load and ' +
      'improves responsiveness on older Macs with integrated graphics.',
    enableEffect:
      'UI will use solid opaque backgrounds instead of the frosted-glass translucency effect.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/guide/mac-help/reduce-screen-motion-mchlc03f57a1/mac
  },
  {
    id: 'reduce-motion',
    name: 'Reduce Motion',
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: 'com.apple.universalaccess',
      key: 'reduceMotion',
      type: 'bool',
      disabledValue: '1',
      enabledValue: '0',
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description:
      'macOS uses parallax effects, zoom transitions, and animated window movements throughout ' +
      'the UI. These animations run on the GPU and can feel sluggish on older hardware.',
    disableEffect:
      'Replaces zoom/parallax animations with simpler cross-fades. Makes the UI feel snappier ' +
      'on older Macs and reduces GPU animation overhead.',
    enableEffect:
      'Full macOS animations (Mission Control zoom, app launch bounce, parallax) will be active.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/guide/mac-help/reduce-screen-motion-mchlc03f57a1/mac
  },
  {
    id: 'dock-animation',
    name: 'Dock Auto-Hide Animation',
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: 'com.apple.dock',
      key: 'autohide-time-modifier',
      type: 'float',
      disabledValue: '0',
      enabledValue: '0.5',
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.None },
    description:
      'When the Dock is set to auto-hide, it animates in and out with a delay and spring animation. ' +
      'This setting controls the animation duration.',
    disableEffect:
      'Makes the Dock appear and disappear instantly with no animation delay. ' +
      'Improves perceived responsiveness when using auto-hide.',
    enableEffect: 'Dock will animate in/out with the default spring animation and delay.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://developer.apple.com/documentation/appkit/nsdock
  },
  {
    id: 'notification-animations',
    name: 'Notification Center Animations',
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: 'com.apple.notificationcenterui',
      key: 'doNotDisturb',
      type: 'bool',
      disabledValue: '1',
      enabledValue: '0',
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description:
      'Notification banners slide in from the top-right corner with animated transitions. ' +
      'On older hardware, frequent notifications can cause visible frame drops.',
    disableEffect:
      'Enables Do Not Disturb mode, suppressing notification banners and their animations. ' +
      'Reduces GPU compositing work from frequent notification popups.',
    enableEffect: 'Notification banners will appear with slide-in animations.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/guide/mac-help/use-do-not-disturb-mchl999b7c1a/mac
  },
  {
    id: 'window-shadows',
    name: 'Window Drop Shadows',
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: 'com.apple.WindowManager',
      key: 'EnableStandardClickToShowDesktop',
      type: 'bool',
      disabledValue: '0',
      enabledValue: '1',
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description:
      'macOS renders drop shadows beneath every window using the GPU compositor. ' +
      'With many windows open, shadow rendering adds up.',
    disableEffect:
      'Removes drop shadows from windows, reducing GPU compositing work. ' +
      'Most noticeable improvement when many windows are open simultaneously.',
    enableEffect: 'Windows will display their standard drop shadows.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://developer.apple.com/documentation/appkit/nswindow/1419234-hasshadow
  },
];

// ─── Privacy Category ─────────────────────────────────────────────────────────

const privacyServices: MacService[] = [
  {
    id: 'diagnostics-usage',
    name: 'Diagnostics & Usage Reporting',
    category: ServiceCategory.Privacy,
    defaultsCommand: {
      domain: 'com.apple.CrashReporter',
      key: 'DialogType',
      type: 'string',
      disabledValue: 'none',
      enabledValue: 'developer',
    },
    controlMethod: ControlMethod.Hybrid,
    launchAgentId: 'com.apple.DiagnosticReportCleanup',
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description:
      'Automatically collects crash reports, diagnostic data, and usage statistics and sends ' +
      'them to Apple. Includes the DiagnosticReportCleanup daemon that periodically processes logs.',
    disableEffect:
      'Stops automatic crash report submission and diagnostic data collection. ' +
      'Improves privacy and eliminates periodic background upload activity.',
    enableEffect:
      'Crash reports and diagnostic data will no longer be sent to Apple automatically.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/en-us/HT202100
  },
  {
    id: 'siri-data-collection',
    name: 'Siri Data Collection',
    category: ServiceCategory.Privacy,
    defaultsCommand: {
      domain: 'com.apple.assistant.support',
      key: 'Siri Data Sharing Opt-In Status',
      type: 'int',
      disabledValue: '2',
      enabledValue: '1',
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.None },
    description:
      'When enabled, Siri sends audio samples and interaction data to Apple for improving Siri ' +
      'recognition accuracy. This data may be reviewed by Apple employees.',
    disableEffect:
      'Opts out of Siri data sharing with Apple. Your voice interactions are not sent for ' +
      'human review. Siri continues to function normally.',
    enableEffect: 'Siri interaction data will be shared with Apple for quality improvement.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/en-us/HT210657
  },
  {
    id: 'screen-time-analytics',
    name: 'Screen Time Analytics',
    category: ServiceCategory.Privacy,
    launchAgentId: 'com.apple.ScreenTimeAgent',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'Screen Time Agent monitors and records app usage, website visits, and device activity ' +
      'to generate usage reports and enforce Screen Time limits.',
    disableEffect:
      'Stops background app usage monitoring and data collection. Removes a persistent ' +
      'background agent. Screen Time reports will no longer update.',
    enableEffect:
      'Screen Time usage reports, app limits, and downtime scheduling will not function.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/guide/mac-help/intro-to-screen-time-mchl4f5d4a9/mac
  },
  {
    id: 'crash-reporter',
    name: 'Crash Reporter',
    category: ServiceCategory.Privacy,
    launchAgentId: 'com.apple.ReportCrash',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'ReportCrash monitors running processes and generates crash reports when applications ' +
      'terminate unexpectedly. Reports are stored locally and optionally sent to Apple.',
    disableEffect:
      'Stops crash report generation and the associated background monitoring process. ' +
      'Reduces background CPU usage after app crashes.',
    enableEffect:
      'Crash reports will not be generated. Debugging app crashes becomes harder without crash logs.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://developer.apple.com/documentation/xcode/diagnosing-issues-using-crash-reports-and-device-logs
  },
  {
    id: 'analytics-helper',
    name: 'macOS Analytics Helper',
    category: ServiceCategory.Privacy,
    launchAgentId: 'com.apple.analyticsd',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'The analytics daemon collects system-level performance metrics, hardware diagnostics, ' +
      'and usage patterns to send to Apple for product improvement purposes.',
    disableEffect:
      'Stops system analytics collection and transmission to Apple. ' +
      'Improves privacy and removes a persistent background daemon.',
    enableEffect: 'System analytics data will no longer be collected or sent to Apple.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/en-us/HT202100
  },
  {
    id: 'tailspin',
    name: 'Tailspin Diagnostic Sampler',
    category: ServiceCategory.Privacy,
    launchAgentId: 'com.apple.tailspind',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'Tailspin is a continuous low-overhead system profiler that records a rolling buffer of ' +
      'system activity. Used by Apple diagnostics tools to analyze performance issues.',
    disableEffect:
      'Stops the continuous system activity recording buffer. Frees a small amount of RAM ' +
      'and eliminates background sampling overhead.',
    enableEffect:
      'Apple diagnostic tools and some third-party profilers may not have historical system data.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://developer.apple.com/documentation/os/logging
  },
];

// ─── Sync Category ────────────────────────────────────────────────────────────

const syncServices: MacService[] = [
  {
    id: 'icloud-drive-sync',
    name: 'iCloud Drive Sync',
    category: ServiceCategory.Sync,
    launchAgentId: 'com.apple.cloudd',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description:
      'iCloud Drive daemon continuously syncs files between your Mac and iCloud servers. ' +
      'Monitors file system changes and uploads/downloads files in the background.',
    disableEffect:
      'Stops iCloud Drive background sync. Eliminates network bandwidth usage and CPU/RAM ' +
      'overhead from continuous file monitoring and upload/download operations.',
    enableEffect:
      'iCloud Drive files will not sync. Changes made on other devices will not appear ' +
      'and local changes will not upload to iCloud.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/guide/mac-help/store-files-in-icloud-drive-sysp4ee93f4/mac
  },
  {
    id: 'icloud-photos',
    name: 'iCloud Photos Sync',
    category: ServiceCategory.Sync,
    launchAgentId: 'com.apple.photoanalysisd',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.Medium },
    description:
      'Photo analysis daemon handles iCloud Photos sync, on-device machine learning analysis ' +
      'for face recognition, scene detection, and memory creation in the Photos library.',
    disableEffect:
      'Stops background photo analysis and iCloud Photos sync. Major CPU and RAM savings ' +
      'especially after importing large photo batches.',
    enableEffect:
      'iCloud Photos will not sync. Face recognition, scene analysis, and Memories will ' +
      'not update in the Photos app.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/guide/photos/icloud-photos-pht6d60b4a9/mac
  },
  {
    id: 'icloud-keychain',
    name: 'iCloud Keychain Sync',
    category: ServiceCategory.Sync,
    launchAgentId: 'com.apple.security.cloudkeychainproxy3',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description:
      'Syncs passwords, credit cards, Wi-Fi passwords, and other keychain items across all ' +
      'your Apple devices via iCloud end-to-end encrypted sync.',
    disableEffect:
      'Stops keychain sync with iCloud. Passwords saved on this Mac will not appear on ' +
      'other devices and vice versa.',
    enableEffect:
      'iCloud Keychain sync will be disabled. Passwords will not sync across Apple devices.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/en-us/HT204085
  },
  {
    id: 'icloud-mail-push',
    name: 'iCloud Mail Push',
    category: ServiceCategory.Sync,
    launchAgentId: 'com.apple.bird',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'The bird daemon is the iCloud ubiquity daemon responsible for syncing iCloud-enabled ' +
      'app data, documents, and Desktop & Documents folder contents.',
    disableEffect:
      'Stops the iCloud ubiquity sync daemon. Reduces background network activity and ' +
      'frees RAM used by continuous sync monitoring.',
    enableEffect:
      'iCloud-enabled app data and Desktop & Documents folder sync will stop working.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://developer.apple.com/documentation/foundation/nsubiquitouskeystorechangereasonkey
  },
  {
    id: 'contacts-sync',
    name: 'Contacts & Calendar Sync',
    category: ServiceCategory.Sync,
    launchAgentId: 'com.apple.AddressBook.SourceSync',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description:
      'Syncs Contacts and Calendar data with iCloud and other configured accounts (Google, ' +
      'Exchange, etc.) in the background.',
    disableEffect:
      'Stops background contacts and calendar sync. Contacts and Calendar apps will show ' +
      'stale data until manually refreshed.',
    enableEffect:
      'Contacts and Calendar will not sync with iCloud or other accounts automatically.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/guide/contacts/sync-contacts-with-icloud-adrbk1302/mac
  },
];

// ─── Misc Category ────────────────────────────────────────────────────────────

const miscServices: MacService[] = [
  {
    id: 'time-machine',
    name: 'Time Machine Backup',
    category: ServiceCategory.Misc,
    launchAgentId: 'com.apple.backupd',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Low },
    description:
      'Time Machine daemon performs automatic hourly backups to a connected backup drive or ' +
      'network volume. Backup operations can cause significant disk I/O.',
    disableEffect:
      'Stops automatic Time Machine backups. Eliminates periodic disk I/O spikes and ' +
      'CPU usage during backup windows.',
    enableEffect:
      'Automatic backups will not run. Your data will not be backed up until Time Machine ' +
      'is re-enabled or you run a manual backup.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://support.apple.com/en-us/HT201250
  },
  {
    id: 'software-update',
    name: 'Software Update Daemon',
    category: ServiceCategory.Misc,
    launchAgentId: 'com.apple.softwareupdated',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'Periodically checks Apple servers for available macOS and app updates, downloads them ' +
      'in the background, and notifies you when updates are ready to install.',
    disableEffect:
      'Stops automatic update checks and background downloads. Eliminates periodic network ' +
      'requests and background download activity.',
    enableEffect:
      'macOS will not automatically check for or download updates. You must check manually ' +
      'in System Settings > General > Software Update.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://support.apple.com/guide/mac-help/get-macos-updates-mchlpx1065/mac
  },
  {
    id: 'font-validation',
    name: 'Font Validation Daemon',
    category: ServiceCategory.Misc,
    launchAgentId: 'com.apple.FontWorker',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'Validates and caches font files installed on the system. Runs periodically to ensure ' +
      'font integrity and update the system font cache.',
    disableEffect:
      'Stops background font validation. Safe for most users. Font cache will not be ' +
      'automatically refreshed.',
    enableEffect:
      'Font validation will not run automatically. Corrupt fonts may not be detected.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://developer.apple.com/fonts/
  },
  {
    id: 'print-spooler',
    name: 'Print Spooler (CUPS)',
    category: ServiceCategory.Misc,
    launchAgentId: 'org.cups.cupsd',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description:
      'CUPS (Common Unix Printing System) daemon manages print queues and printer communication. ' +
      'Runs in the background even when no printing is occurring.',
    disableEffect:
      'Stops the print spooler daemon. Frees RAM. Safe if you never print from this Mac.',
    enableEffect: 'Printing from any application will not work.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://www.cups.org/documentation.html
  },
  {
    id: 'wake-on-lan',
    name: 'Wake on LAN / Network Access',
    category: ServiceCategory.Misc,
    defaultsCommand: {
      domain: 'com.apple.PowerManagement',
      key: 'Wake On LAN',
      type: 'int',
      disabledValue: '0',
      enabledValue: '1',
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.None },
    description:
      'Allows your Mac to wake from sleep when it receives a network access request or a ' +
      'Wake-on-LAN magic packet from another device on the network.',
    disableEffect:
      'Mac will not wake from sleep due to network activity. Reduces unnecessary wake events ' +
      'and associated power consumption.',
    enableEffect:
      'Mac will not respond to Wake-on-LAN packets or network access wake requests.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/guide/mac-help/wake-your-mac-from-sleep-mchl40376151/mac
  },
  {
    id: 'power-nap',
    name: 'Power Nap',
    category: ServiceCategory.Misc,
    defaultsCommand: {
      domain: 'com.apple.PowerManagement',
      key: 'darkwake',
      type: 'int',
      disabledValue: '0',
      enabledValue: '8',
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description:
      'Power Nap allows your Mac to periodically wake from sleep to check email, sync iCloud, ' +
      'receive notifications, and perform Time Machine backups while the display is off.',
    disableEffect:
      'Mac will not perform background tasks during sleep. Reduces power consumption and ' +
      'prevents unexpected wake events.',
    enableEffect:
      'Mac will not sync or check for updates while sleeping. iCloud and email will only ' +
      'update when the Mac is fully awake.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false,
    // sourceUrl: https://support.apple.com/en-us/HT204032
  },
  {
    id: 'remote-apple-events',
    name: 'Remote Apple Events',
    category: ServiceCategory.Misc,
    launchAgentId: 'com.apple.AEServer',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description:
      'Allows other computers on the network to send Apple Events to your Mac, enabling ' +
      'remote AppleScript execution and inter-application communication over the network.',
    disableEffect:
      'Prevents remote AppleScript execution and Apple Event reception from other machines. ' +
      'Improves security by closing a remote access vector.',
    enableEffect: 'Remote AppleScript and Apple Events from other machines will not be received.',
    defaultState: ServiceState.Disabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://support.apple.com/guide/mac-help/allow-remote-apple-events-mchlp1237/mac
  },
  {
    id: 'internet-sharing',
    name: 'Internet Sharing',
    category: ServiceCategory.Misc,
    launchAgentId: 'com.apple.InternetSharing',
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description:
      'Enables your Mac to share its internet connection with other devices via Wi-Fi, ' +
      'Ethernet, or Bluetooth. Creates a software access point when active.',
    disableEffect:
      'Stops internet sharing daemon. Safe if you never use your Mac as a hotspot or ' +
      'internet gateway for other devices.',
    enableEffect: 'Internet Sharing will not be available in System Settings.',
    defaultState: ServiceState.Disabled,
    requiresRestart: false,
    requiresAdmin: true,
    // sourceUrl: https://support.apple.com/guide/mac-help/share-internet-connection-mac-network-mchl9a6b3e3/mac
  },
];

// ─── Registry Export ──────────────────────────────────────────────────────────

/** Complete curated registry of all manageable macOS services */
export const SERVICE_REGISTRY: readonly MacService[] = Object.freeze([
  ...performanceServices,
  ...networkServices,
  ...visualsServices,
  ...privacyServices,
  ...syncServices,
  ...miscServices,
]);

/**
 * Look up a service by its unique ID.
 * @param id - The service slug ID
 * @returns The MacService or undefined if not found
 */
export function getServiceById(id: string): MacService | undefined {
  return SERVICE_REGISTRY.find((s) => s.id === id);
}

/**
 * Get all services in a given category.
 * @param category - The ServiceCategory to filter by
 */
export function getServicesByCategory(category: ServiceCategory): MacService[] {
  return SERVICE_REGISTRY.filter((s) => s.category === category);
}

/**
 * Get all services that require admin privileges.
 */
export function getAdminServices(): MacService[] {
  return SERVICE_REGISTRY.filter((s) => s.requiresAdmin);
}

/**
 * Get all services by risk level.
 */
export function getServicesByRisk(risk: RiskLevel): MacService[] {
  return SERVICE_REGISTRY.filter((s) => s.risk === risk);
}
