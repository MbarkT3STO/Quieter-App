import { ipcMain, app, nativeTheme, BrowserWindow, nativeImage, shell } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const IPC_CHANNELS = {
  /** Fetch all services with runtime states */
  GET_SERVICES: "peakmac:get-services",
  /** Get current system CPU/RAM stats */
  GET_SYSTEM_STATS: "peakmac:get-system-stats",
  /** Apply a batch of service changes */
  APPLY_CHANGES: "peakmac:apply-changes",
  /** Revert all changes from backup snapshot */
  REVERT_ALL: "peakmac:revert-all",
  /** Export system report as JSON */
  EXPORT_REPORT: "peakmac:export-report",
  /** Check if backup snapshot exists */
  HAS_BACKUP: "peakmac:has-backup",
  /** Check if this is the first launch */
  IS_FIRST_LAUNCH: "peakmac:is-first-launch",
  /** Mark first launch as complete */
  MARK_FIRST_LAUNCH_DONE: "peakmac:mark-first-launch-done",
  /** Get app settings */
  GET_SETTINGS: "peakmac:get-settings",
  /** Save app settings */
  SAVE_SETTINGS: "peakmac:save-settings",
  /** Progress event pushed from main to renderer during apply */
  APPLY_PROGRESS: "peakmac:apply-progress"
};
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
var ImpactLevel = /* @__PURE__ */ ((ImpactLevel2) => {
  ImpactLevel2["None"] = "none";
  ImpactLevel2["Low"] = "low";
  ImpactLevel2["Medium"] = "medium";
  ImpactLevel2["High"] = "high";
  return ImpactLevel2;
})(ImpactLevel || {});
var ControlMethod = /* @__PURE__ */ ((ControlMethod2) => {
  ControlMethod2["Launchctl"] = "launchctl";
  ControlMethod2["Defaults"] = "defaults";
  ControlMethod2["Hybrid"] = "hybrid";
  return ControlMethod2;
})(ControlMethod || {});
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
const performanceServices = [
  {
    id: "spotlight-indexing",
    name: "Spotlight Indexing",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.metadata.mds",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.Medium },
    description: "Spotlight indexes your entire disk so you can search files, emails, and apps instantly. The mds and mdworker processes continuously monitor file changes and update the search index.",
    disableEffect: "Eliminates heavy disk I/O and CPU spikes caused by background indexing. Significant performance gain on HDDs and older SSDs.",
    enableEffect: "Spotlight search (Cmd+Space) will no longer find files, emails, or documents. Finder search and Quick Look previews may also be affected.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://developer.apple.com/library/archive/documentation/Carbon/Conceptual/MetadataIntro/MetadataIntro.html
  },
  {
    id: "app-nap",
    name: "App Nap",
    category: ServiceCategory.Performance,
    defaultsCommand: {
      domain: "NSGlobalDomain",
      key: "NSAppSleepDisabled",
      type: "bool",
      disabledValue: "1",
      enabledValue: "0"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description: "App Nap throttles background apps that are not visible on screen, reducing their CPU and timer activity to save battery and free resources for foreground tasks.",
    disableEffect: "Background apps run at full speed even when hidden. Useful if background apps (e.g. music players, download managers) are being throttled unexpectedly.",
    enableEffect: "Background apps may be throttled by macOS, which is the intended behavior for battery savings.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/AppNap.html
  },
  {
    id: "sudden-motion-sensor",
    name: "Sudden Motion Sensor",
    category: ServiceCategory.Performance,
    controlMethod: ControlMethod.Launchctl,
    launchAgentId: "com.apple.sms",
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description: "The Sudden Motion Sensor daemon monitors accelerometer data on MacBooks to park hard drive heads if a sudden drop or impact is detected, preventing data loss.",
    disableEffect: "Removes a small background polling process. Safe to disable on Macs with SSDs only (no spinning hard drive to protect).",
    enableEffect: "HDD heads will not be parked on sudden movement. Only relevant if you have a spinning hard drive.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://support.apple.com/en-us/HT201666
  },
  {
    id: "universal-access-zoom",
    name: "Accessibility Zoom Daemon",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.universalaccessd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Manages accessibility zoom features including screen magnification and display accommodations for users with visual impairments.",
    disableEffect: "Frees a small amount of RAM and removes a background daemon. Safe if you do not use macOS accessibility zoom features.",
    enableEffect: "Screen zoom (Accessibility > Zoom) and related display accommodations will not function.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/zoom-in-on-whats-on-the-screen-mh40579/mac
  },
  {
    id: "game-center",
    name: "Game Center",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.gamed",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Game Center daemon handles multiplayer matchmaking, leaderboards, achievements, and friend activity for games that integrate with Apple's Game Center platform.",
    disableEffect: "Removes a background daemon that most users never interact with directly. Frees RAM and eliminates periodic network activity.",
    enableEffect: "Game Center features (leaderboards, multiplayer, achievements) in supported games will not work.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/game-center/
  },
  {
    id: "knowledge-agent",
    name: "Siri Knowledge Agent",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.knowledge-agent",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description: 'Builds and maintains the on-device knowledge graph used by Siri Suggestions, Spotlight suggestions, and the "Siri & Search" feature that learns your app usage patterns.',
    disableEffect: "Reduces background CPU and RAM usage. Siri Suggestions and app usage learning will be degraded.",
    enableEffect: "Siri Suggestions in Spotlight and app recommendations will be less accurate or absent.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/use-siri-suggestions-mchl4f5d4a9/mac
  },
  {
    id: "photos-library-agent",
    name: "Photos Library Agent",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.photolibraryd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description: "Manages the Photos library database, handles face recognition, scene analysis, memory creation, and keeps the Photos library index up to date.",
    disableEffect: "Stops background photo analysis (face recognition, scene detection). Reduces CPU and RAM usage significantly when Photos library is large.",
    enableEffect: "Photos app may show stale data or fail to open until the daemon is re-enabled. Face recognition and Memories features will not update.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/photos/welcome/mac
  }
];
const networkServices = [
  {
    id: "airdrop-discovery",
    name: "AirDrop Discovery",
    category: ServiceCategory.Network,
    defaultsCommand: {
      domain: "com.apple.NetworkBrowser",
      key: "DisableAirDrop",
      type: "bool",
      disabledValue: "1",
      enabledValue: "0"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description: "AirDrop uses Bluetooth and Wi-Fi to discover nearby Apple devices for peer-to-peer file transfers. The discovery process broadcasts your device presence continuously.",
    disableEffect: "Stops continuous Bluetooth/Wi-Fi broadcasting for device discovery. Reduces wireless radio activity and minor battery drain.",
    enableEffect: "AirDrop will not be discoverable by other Apple devices. You cannot receive AirDrop transfers.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/en-us/HT203106
  },
  {
    id: "bonjour-mdns",
    name: "Bonjour / mDNSResponder",
    category: ServiceCategory.Network,
    launchAgentId: "com.apple.mDNSResponder",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Advanced,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "mDNSResponder implements Bonjour (zero-configuration networking), enabling automatic discovery of printers, AirPlay devices, shared drives, and other network services without manual configuration.",
    disableEffect: "Removes network discovery daemon. May improve privacy on untrusted networks by stopping multicast DNS broadcasts.",
    enableEffect: "AirPrint, AirPlay, network printer discovery, shared drives, and many local network services will stop working. DNS resolution may also be affected.",
    defaultState: ServiceState.Enabled,
    requiresRestart: true,
    requiresAdmin: true
    // sourceUrl: https://developer.apple.com/bonjour/
  },
  {
    id: "location-services",
    name: "Location Services",
    category: ServiceCategory.Network,
    launchAgentId: "com.apple.locationd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Location Services daemon provides GPS/Wi-Fi/cell-based location data to apps that request it. Runs continuously in the background to maintain location awareness.",
    disableEffect: "Stops background location polling. Improves privacy and reduces minor battery/CPU usage from continuous location updates.",
    enableEffect: "Maps, weather apps, Find My, and any app using location will not receive location data.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://support.apple.com/en-us/HT204690
  },
  {
    id: "remote-login-ssh",
    name: "Remote Login (SSH)",
    category: ServiceCategory.Network,
    launchAgentId: "com.openssh.sshd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description: "OpenSSH daemon listens for incoming SSH connections, allowing remote terminal access to your Mac. Disabled by default on most Macs; only active if you enabled Remote Login.",
    disableEffect: "Closes the SSH port (22). Removes a potential remote access vector. Recommended for most users who do not need remote terminal access.",
    enableEffect: "No one can SSH into your Mac remotely.",
    defaultState: ServiceState.Disabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://support.apple.com/guide/mac-help/allow-a-remote-computer-to-access-your-mac-mchlp1066/mac
  },
  {
    id: "bluetooth-daemon",
    name: "Bluetooth Daemon",
    category: ServiceCategory.Network,
    launchAgentId: "com.apple.bluetoothd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Advanced,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Core Bluetooth daemon that manages all Bluetooth hardware, pairing, connections, and communication with Bluetooth devices including keyboards, mice, headphones, and AirPods.",
    disableEffect: "Completely disables Bluetooth. Eliminates Bluetooth radio activity and associated background processing.",
    enableEffect: "All Bluetooth devices (keyboard, mouse, AirPods, etc.) will stop working immediately.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://developer.apple.com/documentation/corebluetooth
  },
  {
    id: "netbios-daemon",
    name: "NetBIOS Daemon",
    category: ServiceCategory.Network,
    launchAgentId: "com.apple.netbiosd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description: "NetBIOS daemon provides Windows network compatibility for SMB file sharing and Windows workgroup/domain discovery on local networks.",
    disableEffect: "Removes a legacy Windows-compatibility daemon. Safe for users who do not share files with Windows machines on a local network.",
    enableEffect: "Windows network discovery and some SMB file sharing features may not work correctly.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://support.apple.com/guide/mac-help/connect-mac-shared-computers-servers-mchlp1140/mac
  }
];
const visualsServices = [
  {
    id: "transparency-blur",
    name: "Transparency & Blur Effects",
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: "com.apple.universalaccess",
      key: "reduceTransparency",
      type: "bool",
      disabledValue: "1",
      enabledValue: "0"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description: "macOS renders real-time blur and transparency effects for the menu bar, Dock, sidebars, and notification center. These effects require continuous GPU compositing.",
    disableEffect: "Replaces translucent surfaces with solid colors. Noticeably reduces GPU load and improves responsiveness on older Macs with integrated graphics.",
    enableEffect: "UI will use solid opaque backgrounds instead of the frosted-glass translucency effect.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/reduce-screen-motion-mchlc03f57a1/mac
  },
  {
    id: "reduce-motion",
    name: "Reduce Motion",
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: "com.apple.universalaccess",
      key: "reduceMotion",
      type: "bool",
      disabledValue: "1",
      enabledValue: "0"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description: "macOS uses parallax effects, zoom transitions, and animated window movements throughout the UI. These animations run on the GPU and can feel sluggish on older hardware.",
    disableEffect: "Replaces zoom/parallax animations with simpler cross-fades. Makes the UI feel snappier on older Macs and reduces GPU animation overhead.",
    enableEffect: "Full macOS animations (Mission Control zoom, app launch bounce, parallax) will be active.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/reduce-screen-motion-mchlc03f57a1/mac
  },
  {
    id: "dock-animation",
    name: "Dock Auto-Hide Animation",
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: "com.apple.dock",
      key: "autohide-time-modifier",
      type: "float",
      disabledValue: "0",
      enabledValue: "0.5"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.None },
    description: "When the Dock is set to auto-hide, it animates in and out with a delay and spring animation. This setting controls the animation duration.",
    disableEffect: "Makes the Dock appear and disappear instantly with no animation delay. Improves perceived responsiveness when using auto-hide.",
    enableEffect: "Dock will animate in/out with the default spring animation and delay.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/documentation/appkit/nsdock
  },
  {
    id: "notification-animations",
    name: "Notification Center Animations",
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: "com.apple.notificationcenterui",
      key: "doNotDisturb",
      type: "bool",
      disabledValue: "1",
      enabledValue: "0"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description: "Notification banners slide in from the top-right corner with animated transitions. On older hardware, frequent notifications can cause visible frame drops.",
    disableEffect: "Enables Do Not Disturb mode, suppressing notification banners and their animations. Reduces GPU compositing work from frequent notification popups.",
    enableEffect: "Notification banners will appear with slide-in animations.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/use-do-not-disturb-mchl999b7c1a/mac
  },
  {
    id: "window-shadows",
    name: "Window Drop Shadows",
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: "com.apple.WindowManager",
      key: "EnableStandardClickToShowDesktop",
      type: "bool",
      disabledValue: "0",
      enabledValue: "1"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description: "macOS renders drop shadows beneath every window using the GPU compositor. With many windows open, shadow rendering adds up.",
    disableEffect: "Removes drop shadows from windows, reducing GPU compositing work. Most noticeable improvement when many windows are open simultaneously.",
    enableEffect: "Windows will display their standard drop shadows.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/documentation/appkit/nswindow/1419234-hasshadow
  }
];
const privacyServices = [
  {
    id: "diagnostics-usage",
    name: "Diagnostics & Usage Reporting",
    category: ServiceCategory.Privacy,
    defaultsCommand: {
      domain: "com.apple.CrashReporter",
      key: "DialogType",
      type: "string",
      disabledValue: "none",
      enabledValue: "developer"
    },
    controlMethod: ControlMethod.Hybrid,
    launchAgentId: "com.apple.DiagnosticReportCleanup",
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description: "Automatically collects crash reports, diagnostic data, and usage statistics and sends them to Apple. Includes the DiagnosticReportCleanup daemon that periodically processes logs.",
    disableEffect: "Stops automatic crash report submission and diagnostic data collection. Improves privacy and eliminates periodic background upload activity.",
    enableEffect: "Crash reports and diagnostic data will no longer be sent to Apple automatically.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/en-us/HT202100
  },
  {
    id: "siri-data-collection",
    name: "Siri Data Collection",
    category: ServiceCategory.Privacy,
    defaultsCommand: {
      domain: "com.apple.assistant.support",
      key: "Siri Data Sharing Opt-In Status",
      type: "int",
      disabledValue: "2",
      enabledValue: "1"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.None },
    description: "When enabled, Siri sends audio samples and interaction data to Apple for improving Siri recognition accuracy. This data may be reviewed by Apple employees.",
    disableEffect: "Opts out of Siri data sharing with Apple. Your voice interactions are not sent for human review. Siri continues to function normally.",
    enableEffect: "Siri interaction data will be shared with Apple for quality improvement.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/en-us/HT210657
  },
  {
    id: "screen-time-analytics",
    name: "Screen Time Analytics",
    category: ServiceCategory.Privacy,
    launchAgentId: "com.apple.ScreenTimeAgent",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Screen Time Agent monitors and records app usage, website visits, and device activity to generate usage reports and enforce Screen Time limits.",
    disableEffect: "Stops background app usage monitoring and data collection. Removes a persistent background agent. Screen Time reports will no longer update.",
    enableEffect: "Screen Time usage reports, app limits, and downtime scheduling will not function.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/intro-to-screen-time-mchl4f5d4a9/mac
  },
  {
    id: "crash-reporter",
    name: "Crash Reporter",
    category: ServiceCategory.Privacy,
    launchAgentId: "com.apple.ReportCrash",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "ReportCrash monitors running processes and generates crash reports when applications terminate unexpectedly. Reports are stored locally and optionally sent to Apple.",
    disableEffect: "Stops crash report generation and the associated background monitoring process. Reduces background CPU usage after app crashes.",
    enableEffect: "Crash reports will not be generated. Debugging app crashes becomes harder without crash logs.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/documentation/xcode/diagnosing-issues-using-crash-reports-and-device-logs
  },
  {
    id: "analytics-helper",
    name: "macOS Analytics Helper",
    category: ServiceCategory.Privacy,
    launchAgentId: "com.apple.analyticsd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "The analytics daemon collects system-level performance metrics, hardware diagnostics, and usage patterns to send to Apple for product improvement purposes.",
    disableEffect: "Stops system analytics collection and transmission to Apple. Improves privacy and removes a persistent background daemon.",
    enableEffect: "System analytics data will no longer be collected or sent to Apple.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/en-us/HT202100
  },
  {
    id: "tailspin",
    name: "Tailspin Diagnostic Sampler",
    category: ServiceCategory.Privacy,
    launchAgentId: "com.apple.tailspind",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Tailspin is a continuous low-overhead system profiler that records a rolling buffer of system activity. Used by Apple diagnostics tools to analyze performance issues.",
    disableEffect: "Stops the continuous system activity recording buffer. Frees a small amount of RAM and eliminates background sampling overhead.",
    enableEffect: "Apple diagnostic tools and some third-party profilers may not have historical system data.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://developer.apple.com/documentation/os/logging
  }
];
const syncServices = [
  {
    id: "icloud-drive-sync",
    name: "iCloud Drive Sync",
    category: ServiceCategory.Sync,
    launchAgentId: "com.apple.cloudd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description: "iCloud Drive daemon continuously syncs files between your Mac and iCloud servers. Monitors file system changes and uploads/downloads files in the background.",
    disableEffect: "Stops iCloud Drive background sync. Eliminates network bandwidth usage and CPU/RAM overhead from continuous file monitoring and upload/download operations.",
    enableEffect: "iCloud Drive files will not sync. Changes made on other devices will not appear and local changes will not upload to iCloud.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/store-files-in-icloud-drive-sysp4ee93f4/mac
  },
  {
    id: "icloud-photos",
    name: "iCloud Photos Sync",
    category: ServiceCategory.Sync,
    launchAgentId: "com.apple.photoanalysisd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.Medium },
    description: "Photo analysis daemon handles iCloud Photos sync, on-device machine learning analysis for face recognition, scene detection, and memory creation in the Photos library.",
    disableEffect: "Stops background photo analysis and iCloud Photos sync. Major CPU and RAM savings especially after importing large photo batches.",
    enableEffect: "iCloud Photos will not sync. Face recognition, scene analysis, and Memories will not update in the Photos app.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/photos/icloud-photos-pht6d60b4a9/mac
  },
  {
    id: "icloud-keychain",
    name: "iCloud Keychain Sync",
    category: ServiceCategory.Sync,
    launchAgentId: "com.apple.security.cloudkeychainproxy3",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description: "Syncs passwords, credit cards, Wi-Fi passwords, and other keychain items across all your Apple devices via iCloud end-to-end encrypted sync.",
    disableEffect: "Stops keychain sync with iCloud. Passwords saved on this Mac will not appear on other devices and vice versa.",
    enableEffect: "iCloud Keychain sync will be disabled. Passwords will not sync across Apple devices.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/en-us/HT204085
  },
  {
    id: "icloud-mail-push",
    name: "iCloud Mail Push",
    category: ServiceCategory.Sync,
    launchAgentId: "com.apple.bird",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "The bird daemon is the iCloud ubiquity daemon responsible for syncing iCloud-enabled app data, documents, and Desktop & Documents folder contents.",
    disableEffect: "Stops the iCloud ubiquity sync daemon. Reduces background network activity and frees RAM used by continuous sync monitoring.",
    enableEffect: "iCloud-enabled app data and Desktop & Documents folder sync will stop working.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/documentation/foundation/nsubiquitouskeystorechangereasonkey
  },
  {
    id: "contacts-sync",
    name: "Contacts & Calendar Sync",
    category: ServiceCategory.Sync,
    launchAgentId: "com.apple.AddressBook.SourceSync",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description: "Syncs Contacts and Calendar data with iCloud and other configured accounts (Google, Exchange, etc.) in the background.",
    disableEffect: "Stops background contacts and calendar sync. Contacts and Calendar apps will show stale data until manually refreshed.",
    enableEffect: "Contacts and Calendar will not sync with iCloud or other accounts automatically.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/contacts/sync-contacts-with-icloud-adrbk1302/mac
  }
];
const miscServices = [
  {
    id: "time-machine",
    name: "Time Machine Backup",
    category: ServiceCategory.Misc,
    launchAgentId: "com.apple.backupd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Low },
    description: "Time Machine daemon performs automatic hourly backups to a connected backup drive or network volume. Backup operations can cause significant disk I/O.",
    disableEffect: "Stops automatic Time Machine backups. Eliminates periodic disk I/O spikes and CPU usage during backup windows.",
    enableEffect: "Automatic backups will not run. Your data will not be backed up until Time Machine is re-enabled or you run a manual backup.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://support.apple.com/en-us/HT201250
  },
  {
    id: "software-update",
    name: "Software Update Daemon",
    category: ServiceCategory.Misc,
    launchAgentId: "com.apple.softwareupdated",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Periodically checks Apple servers for available macOS and app updates, downloads them in the background, and notifies you when updates are ready to install.",
    disableEffect: "Stops automatic update checks and background downloads. Eliminates periodic network requests and background download activity.",
    enableEffect: "macOS will not automatically check for or download updates. You must check manually in System Settings > General > Software Update.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://support.apple.com/guide/mac-help/get-macos-updates-mchlpx1065/mac
  },
  {
    id: "font-validation",
    name: "Font Validation Daemon",
    category: ServiceCategory.Misc,
    launchAgentId: "com.apple.FontWorker",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Validates and caches font files installed on the system. Runs periodically to ensure font integrity and update the system font cache.",
    disableEffect: "Stops background font validation. Safe for most users. Font cache will not be automatically refreshed.",
    enableEffect: "Font validation will not run automatically. Corrupt fonts may not be detected.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/fonts/
  },
  {
    id: "print-spooler",
    name: "Print Spooler (CUPS)",
    category: ServiceCategory.Misc,
    launchAgentId: "org.cups.cupsd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description: "CUPS (Common Unix Printing System) daemon manages print queues and printer communication. Runs in the background even when no printing is occurring.",
    disableEffect: "Stops the print spooler daemon. Frees RAM. Safe if you never print from this Mac.",
    enableEffect: "Printing from any application will not work.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://www.cups.org/documentation.html
  },
  {
    id: "wake-on-lan",
    name: "Wake on LAN / Network Access",
    category: ServiceCategory.Misc,
    defaultsCommand: {
      domain: "com.apple.PowerManagement",
      key: "Wake On LAN",
      type: "int",
      disabledValue: "0",
      enabledValue: "1"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.None },
    description: "Allows your Mac to wake from sleep when it receives a network access request or a Wake-on-LAN magic packet from another device on the network.",
    disableEffect: "Mac will not wake from sleep due to network activity. Reduces unnecessary wake events and associated power consumption.",
    enableEffect: "Mac will not respond to Wake-on-LAN packets or network access wake requests.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/wake-your-mac-from-sleep-mchl40376151/mac
  },
  {
    id: "power-nap",
    name: "Power Nap",
    category: ServiceCategory.Misc,
    defaultsCommand: {
      domain: "com.apple.PowerManagement",
      key: "darkwake",
      type: "int",
      disabledValue: "0",
      enabledValue: "8"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description: "Power Nap allows your Mac to periodically wake from sleep to check email, sync iCloud, receive notifications, and perform Time Machine backups while the display is off.",
    disableEffect: "Mac will not perform background tasks during sleep. Reduces power consumption and prevents unexpected wake events.",
    enableEffect: "Mac will not sync or check for updates while sleeping. iCloud and email will only update when the Mac is fully awake.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/en-us/HT204032
  },
  {
    id: "remote-apple-events",
    name: "Remote Apple Events",
    category: ServiceCategory.Misc,
    launchAgentId: "com.apple.AEServer",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description: "Allows other computers on the network to send Apple Events to your Mac, enabling remote AppleScript execution and inter-application communication over the network.",
    disableEffect: "Prevents remote AppleScript execution and Apple Event reception from other machines. Improves security by closing a remote access vector.",
    enableEffect: "Remote AppleScript and Apple Events from other machines will not be received.",
    defaultState: ServiceState.Disabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://support.apple.com/guide/mac-help/allow-remote-apple-events-mchlp1237/mac
  },
  {
    id: "internet-sharing",
    name: "Internet Sharing",
    category: ServiceCategory.Misc,
    launchAgentId: "com.apple.InternetSharing",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Enables your Mac to share its internet connection with other devices via Wi-Fi, Ethernet, or Bluetooth. Creates a software access point when active.",
    disableEffect: "Stops internet sharing daemon. Safe if you never use your Mac as a hotspot or internet gateway for other devices.",
    enableEffect: "Internet Sharing will not be available in System Settings.",
    defaultState: ServiceState.Disabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://support.apple.com/guide/mac-help/share-internet-connection-mac-network-mchl9a6b3e3/mac
  }
];
const additionalPerformanceServices = [
  {
    id: "siri-daemon",
    name: "Siri Daemon",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.Siri",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description: 'The Siri daemon runs persistently in the background, listening for the "Hey Siri" wake word, maintaining a language model in memory, and processing voice requests.',
    disableEffect: "Frees 150–300 MB of RAM and eliminates continuous microphone monitoring. Significant gain on Macs with 8 GB RAM.",
    enableEffect: 'Siri will not respond to "Hey Siri" or the Siri keyboard shortcut. Siri features across the system will be unavailable.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/use-siri-on-mac-mchl6b029310/mac
  },
  {
    id: "apple-intelligence",
    name: "Apple Intelligence Service",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.intelligenced",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.High },
    description: "Apple Intelligence core daemon introduced in macOS Sequoia 15. Manages on-device AI features including Writing Tools, image generation, Smart Reply, and notification summarization. Loads large ML models into memory.",
    disableEffect: "Frees 300–900 MB of RAM and eliminates background ML inference CPU usage. Major gain on Macs with 8–16 GB unified memory.",
    enableEffect: "Writing Tools, notification summaries, Smart Reply, and other Apple Intelligence features will not function.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/apple-intelligence
  },
  {
    id: "ml-runtime",
    name: "Machine Learning Runtime",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.mlruntime",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.High },
    description: "The ML runtime daemon manages on-device machine learning model execution for features like Live Text, Visual Look Up, scene recognition, and other Core ML powered features across the system.",
    disableEffect: "Stops background ML model loading and inference. Frees significant RAM on Macs running macOS Sequoia with Apple Intelligence features.",
    enableEffect: "Live Text, Visual Look Up, scene recognition, and Core ML powered system features will not function.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/documentation/coreml
  },
  {
    id: "trial-daemon",
    name: "Siri Experiments (triald)",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.triald",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Low },
    description: "The triald daemon runs A/B experiments for Siri and Apple services, downloading and executing experimental feature configurations from Apple servers. Known to cause unexpected CPU spikes.",
    disableEffect: "Eliminates unexpected CPU spikes from background experiment execution. Stops Apple from running feature experiments on your device.",
    enableEffect: "Apple will not be able to run feature experiments or A/B tests on your Mac.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://discussions.apple.com/thread/253791395
  },
  {
    id: "coreduet-knowledge",
    name: "CoreDuet Knowledge Agent",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.coreduetd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description: 'CoreDuet builds a behavioral knowledge graph by monitoring your app usage, location patterns, and activity to power proactive suggestions, Siri context, and the "Siri & Search" learning engine.',
    disableEffect: "Stops continuous behavioral monitoring and knowledge graph updates. Reduces background CPU usage and improves privacy.",
    enableEffect: "Proactive Siri suggestions, app usage predictions, and contextual recommendations will be less accurate.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://discussions.apple.com/thread/253791395
  },
  {
    id: "tips-daemon",
    name: "Tips App Service",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.tipsd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description: "Background daemon for the Tips app that periodically fetches new tips and feature highlights from Apple servers and schedules tip notifications.",
    disableEffect: "Stops background tip fetching and notification scheduling. Removes a low-value background process most users never interact with.",
    enableEffect: "The Tips app will not receive new tips or show feature highlight notifications.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/tips/welcome/mac
  }
];
const additionalPrivacyServices = [
  {
    id: "biome-sync",
    name: "Biome Sync Daemon",
    category: ServiceCategory.Privacy,
    launchAgentId: "com.apple.biomesyncd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Biome is Apple's on-device behavioral data store introduced in macOS Ventura. The sync daemon replicates biome data (app usage, interactions, context) across your Apple devices via iCloud.",
    disableEffect: "Stops cross-device behavioral data sync. Reduces background network activity and limits the scope of Apple's on-device behavioral profiling.",
    enableEffect: "Behavioral context data will not sync across your Apple devices, which may reduce Siri suggestion accuracy on other devices.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://github.com/Wamphyre/macOS_Silverback-Debloater
  },
  {
    id: "privacy-intelligence",
    name: "Privacy Intelligence Daemon",
    category: ServiceCategory.Privacy,
    launchAgentId: "com.apple.PrivacyIntelligence",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Analyzes app behavior patterns in the background to build a privacy intelligence model used by macOS to detect anomalous app behavior and power the Privacy Report in Safari and system privacy summaries.",
    disableEffect: "Stops background app behavior analysis. Reduces CPU usage from continuous behavioral monitoring.",
    enableEffect: "Privacy Report in Safari and system-level app behavior anomaly detection will not update.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/privacy-report-mchl4f5d4a9/mac
  },
  {
    id: "context-stored",
    name: "Context Store Daemon",
    category: ServiceCategory.Privacy,
    launchAgentId: "com.apple.contextstored",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Stores and manages contextual data about your activities — including which apps you use, when, and in what sequence — to power Siri context awareness and proactive suggestions.",
    disableEffect: "Stops contextual activity recording. Improves privacy by preventing detailed activity logging used for behavioral profiling.",
    enableEffect: "Siri context awareness and activity-based suggestions will be less accurate.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://github.com/Wamphyre/macOS_Silverback-Debloater
  },
  {
    id: "parse-daemon",
    name: "Analytics Parse Daemon",
    category: ServiceCategory.Privacy,
    launchAgentId: "com.apple.parsecd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description: "Parses and processes diagnostic and analytics data collected by analyticsd before it is submitted to Apple. Runs periodically to batch-process accumulated telemetry.",
    disableEffect: "Stops telemetry parsing and preparation for upload. Works best when combined with disabling the Analytics Helper daemon.",
    enableEffect: "Collected analytics data will not be processed or sent to Apple.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://copyprogramming.com/howto/disable-share-mac-analytics-with-defaults-command
  }
];
const additionalNetworkServices = [
  {
    id: "handoff-sharing",
    name: "Handoff & Universal Clipboard",
    category: ServiceCategory.Network,
    launchAgentId: "com.apple.sharingd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "The sharingd daemon enables Handoff (continue tasks across Apple devices), Universal Clipboard (copy on one device, paste on another), AirDrop, and Instant Hotspot. Maintains persistent Bluetooth LE connections.",
    disableEffect: "Stops Handoff, Universal Clipboard, and Instant Hotspot. Eliminates persistent Bluetooth LE background connections and associated battery drain.",
    enableEffect: "Handoff, Universal Clipboard, AirDrop, and Instant Hotspot will not function.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/en-us/HT209455
  },
  {
    id: "airplay-receiver",
    name: "AirPlay Receiver",
    category: ServiceCategory.Network,
    defaultsCommand: {
      domain: "com.apple.controlcenter",
      key: "AirplayRecieverEnabled",
      type: "bool",
      disabledValue: "0",
      enabledValue: "1"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Allows your Mac to act as an AirPlay receiver, so other Apple devices can stream audio and video to it. Introduced in macOS Monterey. Keeps a network listener active in the background.",
    disableEffect: "Stops the AirPlay receiver listener. Removes a background network service and closes the associated port.",
    enableEffect: "Other Apple devices will not be able to AirPlay audio or video to your Mac.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/en-us/HT213244
  },
  {
    id: "weatherkit-service",
    name: "WeatherKit Background Service",
    category: ServiceCategory.Network,
    launchAgentId: "com.apple.WeatherKit.service",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description: "Fetches and caches weather data in the background for the Weather app, widgets, and any app using WeatherKit. Makes periodic network requests to Apple's weather servers.",
    disableEffect: "Stops background weather data fetching. Weather app and widgets will only update when manually opened.",
    enableEffect: "Weather app, widgets, and WeatherKit-powered apps will not receive background weather updates.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/weatherkit/
  },
  {
    id: "remote-management",
    name: "Remote Management (ARD)",
    category: ServiceCategory.Network,
    launchAgentId: "com.apple.RemoteDesktop.agent",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Low },
    description: "Apple Remote Desktop agent enables remote screen sharing and management of your Mac by administrators. Only relevant in managed enterprise environments.",
    disableEffect: "Closes the remote management port. Prevents administrators from remotely controlling or observing your screen.",
    enableEffect: "Remote Desktop and screen sharing management features will not be available.",
    defaultState: ServiceState.Disabled,
    requiresRestart: false,
    requiresAdmin: true
    // sourceUrl: https://support.apple.com/guide/remote-desktop/welcome/mac
  }
];
const additionalVisualsServices = [
  {
    id: "live-text",
    name: "Live Text (OCR)",
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: "com.apple.VisionKit",
      key: "EnableLiveText",
      type: "bool",
      disabledValue: "0",
      enabledValue: "1"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Low },
    description: "Live Text uses on-device OCR (optical character recognition) to detect and make text selectable in images, camera viewfinders, and screenshots system-wide. Runs ML inference whenever images are displayed.",
    disableEffect: "Stops background OCR processing on images. Reduces CPU usage from continuous ML inference when viewing image-heavy content.",
    enableEffect: "Text in images, photos, and camera viewfinders will not be selectable or copyable.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/use-live-text-mchl4f5d4a9/mac
  },
  {
    id: "visual-look-up",
    name: "Visual Look Up",
    category: ServiceCategory.Visuals,
    launchAgentId: "com.apple.LiveLookup.agent",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
    description: "Visual Look Up identifies objects in photos — plants, animals, landmarks, artwork, and food — using on-device ML models. Runs inference in the background when images are viewed in Photos or Quick Look.",
    disableEffect: "Stops background image analysis for object identification. Reduces ML inference CPU usage when browsing photos.",
    enableEffect: 'The "Look Up" feature in Photos and Quick Look will not identify objects in images.',
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/photos/use-visual-look-up-pht6d60b4a9/mac
  },
  {
    id: "dock-expose-animation",
    name: "Dock Launch Animation",
    category: ServiceCategory.Visuals,
    defaultsCommand: {
      domain: "com.apple.dock",
      key: "launchanim",
      type: "bool",
      disabledValue: "0",
      enabledValue: "1"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.None },
    description: "When you launch an app from the Dock, its icon bounces with a spring animation. This animation runs on the GPU compositor and adds visual noise during app launch.",
    disableEffect: "App icons no longer bounce when launching. App launch feels more immediate and less distracting.",
    enableEffect: "App icons will bounce in the Dock when launched.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/documentation/appkit/nsdock
  }
];
const additionalMiscServices = [
  {
    id: "spotlight-web-search",
    name: "Spotlight Web & Siri Suggestions",
    category: ServiceCategory.Misc,
    defaultsCommand: {
      domain: "com.apple.lookup.shared",
      key: "LookupSuggestionsDisabled",
      type: "bool",
      disabledValue: "1",
      enabledValue: "0"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.None },
    description: "When you type in Spotlight, it sends your search query to Apple and Bing to fetch web results and Siri Suggestions. This happens in real-time as you type.",
    disableEffect: "Stops Spotlight from sending keystrokes to Apple/Bing servers. Spotlight results are limited to local files and apps only.",
    enableEffect: "Spotlight will not show web results, news, or Siri Suggestions from the internet.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/spotlight-suggestions-mchl4f5d4a9/mac
  },
  {
    id: "automatic-termination",
    name: "Automatic App Termination",
    category: ServiceCategory.Misc,
    defaultsCommand: {
      domain: "NSGlobalDomain",
      key: "NSDisableAutomaticTermination",
      type: "bool",
      disabledValue: "1",
      enabledValue: "0"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.Medium },
    description: "macOS can automatically terminate apps that support it when memory is needed, even if they appear open in the Dock. The app relaunches instantly when you switch back to it.",
    disableEffect: "Apps are never silently terminated by macOS. Prevents unexpected app state loss and gives you full control over what is running.",
    enableEffect: "macOS will not automatically terminate idle apps to free memory.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/AppNap.html
  },
  {
    id: "reopen-windows",
    name: "Reopen Windows on Login",
    category: ServiceCategory.Misc,
    defaultsCommand: {
      domain: "com.apple.loginwindow",
      key: "TALLogoutSavesState",
      type: "bool",
      disabledValue: "0",
      enabledValue: "1"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description: "macOS saves the state of all open windows and apps when you log out or restart, then reopens them all on next login. This can significantly slow down startup on Macs with many open apps.",
    disableEffect: "macOS starts with a clean slate on every login. Faster startup time and lower initial RAM usage after boot.",
    enableEffect: "All previously open apps and windows will not be restored on login.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/open-items-automatically-when-you-log-in-mh15189/mac
  },
  {
    id: "gatekeeper-check",
    name: "Gatekeeper Online Verification",
    category: ServiceCategory.Misc,
    defaultsCommand: {
      domain: "com.apple.LaunchServices",
      key: "LSQuarantine",
      type: "bool",
      disabledValue: "0",
      enabledValue: "1"
    },
    controlMethod: ControlMethod.Defaults,
    risk: RiskLevel.Advanced,
    impact: { cpu: ImpactLevel.None, ram: ImpactLevel.None },
    description: "When you open a downloaded app for the first time, macOS contacts Apple's OCSP server to verify the app's certificate has not been revoked. This check can cause a noticeable delay on slow connections.",
    disableEffect: "Removes the quarantine flag from downloaded files, skipping the first-launch online certificate check. Eliminates launch delays on slow networks.",
    enableEffect: "Downloaded apps will not be checked against Apple's revocation list on first launch, reducing one layer of malware protection.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/security/gatekeeper-and-runtime-protection-sec5599b66df/web
  }
];
const highImpactServices = [
  {
    id: "media-analysis",
    name: "Media Analysis Daemon",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.mediaanalysisd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.High },
    description: "mediaanalysisd performs deep ML analysis on your entire Photos library — face recognition, scene classification, object detection, and Visual Look Up indexing. Widely reported to spike to 200–400% CPU for hours after importing photos or after macOS updates.",
    disableEffect: "Eliminates one of the most commonly reported CPU hogs on macOS. Major relief on Macs with large photo libraries. Frees significant RAM used by loaded ML models.",
    enableEffect: "Photos search by scene/object, face grouping, Visual Look Up, and Memories will not update.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://appleinsider.com/inside/macos-ventura/tips/how-to-stop-mediaanalysisd-from-hogging-your-cpu-in-macos
  },
  {
    id: "chronod",
    name: "Chronod (Widget Data)",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.chronod",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.Medium },
    description: "Introduced in macOS Sonoma, chronod is the ChronoCore framework daemon that keeps widget data fresh on the desktop and in Notification Center. Widely reported to spike to 100% CPU and make network requests unexpectedly, even on Macs with no widgets configured.",
    disableEffect: "Stops the widget data refresh daemon. Eliminates a well-documented CPU spike source on macOS Sonoma and Sequoia.",
    enableEffect: "Desktop widgets and Notification Center widgets will not refresh their data in the background.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://osxdaily.com/2024/07/25/chronod-on-mac-high-cpu-use-network-access-requests-explained/
  },
  {
    id: "duet-expert",
    name: "Duet Expert Daemon",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.duetexpertd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.Medium },
    description: "duetexpertd is the machine learning engine behind Siri's proactive intelligence — it predicts which apps you'll open next, when to send notifications, and powers Handoff suggestions. Reported to consume 100%+ CPU in bursts, especially after enabling Handoff or iCloud features.",
    disableEffect: "Stops the proactive ML prediction engine. Eliminates a significant source of unexpected CPU spikes reported across macOS Ventura, Sonoma, and Sequoia.",
    enableEffect: "Siri proactive suggestions, app launch predictions, and smart notification timing will be less accurate.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://macsecurity.net/view/679-duetexpertd-high-cpu
  },
  {
    id: "searchpartyd",
    name: "Search Party Daemon",
    category: ServiceCategory.Network,
    launchAgentId: "com.apple.searchpartyd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.Low },
    description: 'searchpartyd powers the "Find My" offline finding network — it uses Bluetooth to detect nearby lost Apple devices and anonymously relays their location to Apple. Reported to cause runaway CPU and energy drain, particularly on battery.',
    disableEffect: "Stops participation in the Find My offline network. Eliminates a known source of runaway CPU and battery drain reported by developers on Apple forums.",
    enableEffect: "Your Mac will no longer help locate other people's lost Apple devices via the Find My network.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://developer.apple.com/forums/thread/734902
  },
  {
    id: "corespotlightd",
    name: "Core Spotlight Daemon",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.corespotlightd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.Medium },
    description: "corespotlightd maintains the Core Spotlight index used by apps to make their content searchable. Distinct from mds (file indexing), this daemon indexes in-app content. Reported to spike to 200–400% CPU for extended periods, especially after macOS updates.",
    disableEffect: "Stops in-app content indexing. Eliminates a major CPU spike source. In-app Spotlight search (Mail, Notes, Messages content) will be degraded.",
    enableEffect: "In-app content will not be indexed for Spotlight. Search results for app content (emails, notes, messages) may be incomplete.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://macsecurity.net/view/643-corespotlightd-high-cpu-process-on-mac
  },
  {
    id: "nsurlsessiond",
    name: "URL Session Daemon",
    category: ServiceCategory.Network,
    launchAgentId: "com.apple.nsurlsessiond",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Advanced,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description: "nsurlsessiond handles all background network transfers for apps using NSURLSession — including iCloud sync, app updates, and background downloads. When many apps queue background transfers simultaneously it can spike CPU and consume significant bandwidth.",
    disableEffect: "Stops background network transfer management. Reduces unexpected bandwidth usage and CPU spikes from simultaneous background downloads.",
    enableEffect: "Background downloads, iCloud sync transfers, and app background refresh network operations may not complete reliably.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://iboysoft.com/wiki/nsurlsessiond.html
  },
  {
    id: "suggestd",
    name: "Suggestions Daemon",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.suggestd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description: "suggestd powers Siri Suggestions across the system — in Spotlight, Safari, Mail, Messages, and the App Switcher. It continuously indexes your content and behavior to generate contextual suggestions.",
    disableEffect: "Stops the suggestions indexing engine. Reduces background CPU and RAM usage. Siri Suggestions will not appear in Spotlight or apps.",
    enableEffect: "Siri Suggestions in Spotlight, Safari, Mail, and other apps will not appear.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://support.apple.com/guide/mac-help/use-siri-suggestions-mchl4f5d4a9/mac
  },
  {
    id: "sysmond",
    name: "System Monitor Daemon",
    category: ServiceCategory.Performance,
    launchAgentId: "com.apple.sysmond",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.Low },
    description: "sysmond collects detailed system performance metrics — CPU, memory, disk, network, and thermal data — and feeds them to diagnostics tools, Activity Monitor, and Apple's telemetry pipeline. Reported to spike to 100% CPU during intensive system activity.",
    disableEffect: "Stops continuous system metric collection. Eliminates a known CPU spike source. Activity Monitor may show less detailed historical data.",
    enableEffect: "System performance metrics will not be collected. Some Activity Monitor historical graphs may be less accurate.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://macsecurity.net/view/521-sysmond-high-cpu-problem-mac
  },
  {
    id: "accountsd",
    name: "Accounts Daemon",
    category: ServiceCategory.Sync,
    launchAgentId: "com.apple.accountsd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Moderate,
    impact: { cpu: ImpactLevel.High, ram: ImpactLevel.High },
    description: "accountsd manages all internet account credentials and sync operations for Mail, Contacts, Calendar, and third-party accounts (Google, Exchange, etc.). Reported to consume 500%+ CPU and up to 2 GB RAM, particularly after macOS updates or when account tokens expire.",
    disableEffect: "Stops background account sync management. Eliminates one of the most severe CPU/RAM spike sources reported across multiple macOS versions.",
    enableEffect: "Mail, Contacts, Calendar, and all internet account sync will stop working. You will need to re-authenticate accounts when re-enabled.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://discussions.apple.com/thread/251846520
  },
  {
    id: "contactsd",
    name: "Contacts Sync Daemon",
    category: ServiceCategory.Sync,
    launchAgentId: "com.apple.contactsd",
    controlMethod: ControlMethod.Launchctl,
    risk: RiskLevel.Safe,
    impact: { cpu: ImpactLevel.Medium, ram: ImpactLevel.Medium },
    description: "contactsd syncs your Contacts database with iCloud and other configured accounts (Google, Exchange, CardDAV). Reported to cause high CPU and memory usage, especially when syncing large contact lists or after account changes.",
    disableEffect: "Stops background contacts sync. Frees CPU and RAM consumed by continuous contact database synchronization.",
    enableEffect: "Contacts will not sync with iCloud or other accounts. The Contacts app will show stale data.",
    defaultState: ServiceState.Enabled,
    requiresRestart: false,
    requiresAdmin: false
    // sourceUrl: https://discussions.apple.com/thread/254322136
  }
];
const SERVICE_REGISTRY = Object.freeze([
  ...performanceServices,
  ...additionalPerformanceServices,
  ...highImpactServices,
  ...networkServices,
  ...additionalNetworkServices,
  ...visualsServices,
  ...additionalVisualsServices,
  ...privacyServices,
  ...additionalPrivacyServices,
  ...syncServices,
  ...miscServices,
  ...additionalMiscServices
]);
const APP_NAME = "Quieter";
const APP_VERSION = "1.0.0";
const DATA_DIR_NAME = ".quieter";
const BACKUP_FILENAME = "backup.json";
const LOG_DIR_NAME = "logs";
const LOG_FILENAME = "app.log";
const SETTINGS_FILENAME = "settings.json";
const FIRST_LAUNCH_FILENAME = ".first-launch-done";
const SHELL_TIMEOUT_MS = 1e4;
const STATS_POLL_INTERVAL_MS = 3e3;
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_SETTINGS = {
  launchAtLogin: false,
  autoCheckOnStartup: true,
  theme: "dark"
};
class Logger {
  static instance;
  logFilePath;
  logStream = null;
  constructor() {
    const logDir = path.join(os.homedir(), DATA_DIR_NAME, LOG_DIR_NAME);
    fs.mkdirSync(logDir, { recursive: true });
    this.logFilePath = path.join(logDir, LOG_FILENAME);
    this.openStream();
  }
  /** Get the singleton Logger instance */
  static getInstance() {
    if (Logger.instance === void 0) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  openStream() {
    try {
      this.logStream = fs.createWriteStream(this.logFilePath, { flags: "a" });
      this.logStream.on("error", (err) => {
        console.error("[Logger] Stream error:", err);
      });
    } catch (err) {
      console.error("[Logger] Failed to open log stream:", err);
    }
  }
  rotateIfNeeded() {
    try {
      const stat = fs.statSync(this.logFilePath);
      if (stat.size > MAX_LOG_SIZE_BYTES) {
        this.logStream?.end();
        const rotated = this.logFilePath.replace(".log", `.${Date.now()}.log`);
        fs.renameSync(this.logFilePath, rotated);
        this.openStream();
      }
    } catch {
    }
  }
  write(entry) {
    this.rotateIfNeeded();
    const line = JSON.stringify(entry) + "\n";
    this.logStream?.write(line);
    const prefix = `[${entry.timestamp}] [${entry.level}] [${entry.context}]`;
    const msg = entry.data !== void 0 ? `${prefix} ${entry.message} ${JSON.stringify(entry.data)}` : `${prefix} ${entry.message}`;
    if (entry.level === "ERROR" || entry.level === "WARN") {
      console.error(msg);
    } else {
      console.log(msg);
    }
  }
  log(level, context, message, data) {
    const entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level,
      context,
      message,
      ...data !== void 0 ? { data } : {}
    };
    this.write(entry);
  }
  /** Log a debug message */
  debug(context, message, data) {
    this.log("DEBUG", context, message, data);
  }
  /** Log an info message */
  info(context, message, data) {
    this.log("INFO", context, message, data);
  }
  /** Log a warning */
  warn(context, message, data) {
    this.log("WARN", context, message, data);
  }
  /** Log an error */
  error(context, message, data) {
    this.log("ERROR", context, message, data);
  }
  /** Close the log stream gracefully */
  close() {
    this.logStream?.end();
  }
}
const logger = Logger.getInstance();
const execFileAsync = promisify(execFile);
function sanitizeArg(arg) {
  const SAFE_PATTERN = /^[a-zA-Z0-9._\-/@ =:,~]+$/;
  if (!SAFE_PATTERN.test(arg)) {
    return {
      success: false,
      error: `Unsafe shell argument rejected: "${arg}"`,
      code: "SHELL_INJECTION"
    };
  }
  return { success: true, data: arg };
}
async function safeExec(command, args, context) {
  for (const arg of args) {
    const sanitized = sanitizeArg(arg);
    if (!sanitized.success) {
      logger.error(context, sanitized.error, { command, args });
      return sanitized;
    }
  }
  const fullCmd = `${command} ${args.join(" ")}`;
  logger.debug(context, `Executing: ${fullCmd}`);
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: SHELL_TIMEOUT_MS,
      maxBuffer: 1024 * 1024
      // 1 MB
    });
    const result = {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0
    };
    logger.debug(context, `Command succeeded`, { stdout: result.stdout.slice(0, 200) });
    return { success: true, data: result };
  } catch (err) {
    const error = err;
    const exitCode = typeof error.code === "number" ? error.code : 1;
    const stdout = (error.stdout ?? "").trim();
    const stderr = (error.stderr ?? "").trim();
    if (error.killed === true) {
      logger.error(context, `Command timed out after ${SHELL_TIMEOUT_MS}ms`, { command, args });
      return {
        success: false,
        error: `Command timed out: ${fullCmd}`,
        code: "TIMEOUT"
      };
    }
    logger.error(context, `Command failed (exit ${exitCode})`, {
      command,
      args,
      stderr,
      stdout
    });
    return {
      success: false,
      error: stderr.length > 0 ? stderr : `Command failed with exit code ${exitCode}`,
      code: String(exitCode)
    };
  }
}
async function safeExecOutput(command, args, context) {
  const result = await safeExec(command, args, context);
  if (!result.success) return result;
  return { success: true, data: result.data.stdout };
}
const LAUNCHCTL = "/bin/launchctl";
const CONTEXT$5 = "LaunchctlService";
class LaunchctlService {
  static instance;
  constructor() {
  }
  /** Get the singleton instance */
  static getInstance() {
    if (LaunchctlService.instance === void 0) {
      LaunchctlService.instance = new LaunchctlService();
    }
    return LaunchctlService.instance;
  }
  /**
   * Get the current state of a launchd service by its bundle ID.
   * Parses 'launchctl list' output to determine if the service is running.
   *
   * @param bundleId - e.g. "com.apple.metadata.mds"
   */
  async getServiceState(bundleId) {
    const result = await safeExecOutput(LAUNCHCTL, ["list", bundleId], CONTEXT$5);
    if (!result.success) {
      if (result.code === "113" || result.error.includes("Could not find service")) {
        return { success: true, data: ServiceState.Disabled };
      }
      logger.warn(CONTEXT$5, `Could not determine state for ${bundleId}`, { error: result.error });
      return { success: true, data: ServiceState.Unknown };
    }
    return { success: true, data: ServiceState.Enabled };
  }
  /**
   * Check multiple services at once by parsing 'launchctl list' output.
   * More efficient than calling getServiceState for each service individually.
   *
   * @param bundleIds - Array of bundle IDs to check
   * @returns Map of bundleId -> ServiceState
   */
  async getMultipleServiceStates(bundleIds) {
    const result = await safeExecOutput(LAUNCHCTL, ["list"], CONTEXT$5);
    if (!result.success) {
      return result;
    }
    const output = result.data;
    const stateMap = /* @__PURE__ */ new Map();
    for (const bundleId of bundleIds) {
      const isRunning = output.includes(bundleId);
      stateMap.set(bundleId, isRunning ? ServiceState.Enabled : ServiceState.Disabled);
    }
    return { success: true, data: stateMap };
  }
  /**
   * Disable (unload) a launchd service.
   * Uses 'launchctl bootout' for macOS 10.11+ or falls back to 'launchctl unload'.
   *
   * @param bundleId - The launchd bundle ID to disable
   * @param requiresAdmin - Whether this service requires elevated privileges
   */
  async disableService(bundleId, requiresAdmin) {
    logger.info(CONTEXT$5, `Disabling service: ${bundleId}`, { requiresAdmin });
    const uid = process.getuid !== void 0 ? process.getuid() : 501;
    const domain = requiresAdmin ? "system" : `gui/${uid}`;
    const bootoutResult = await safeExec(
      LAUNCHCTL,
      ["bootout", `${domain}/${bundleId}`],
      CONTEXT$5
    );
    if (bootoutResult.success) {
      logger.info(CONTEXT$5, `Successfully disabled ${bundleId} via bootout`);
      return { success: true, data: void 0 };
    }
    const plistPath = this.resolvePlistPath(bundleId, requiresAdmin);
    if (plistPath !== null) {
      const unloadResult = await safeExec(LAUNCHCTL, ["unload", "-w", plistPath], CONTEXT$5);
      if (unloadResult.success) {
        logger.info(CONTEXT$5, `Successfully disabled ${bundleId} via unload`);
        return { success: true, data: void 0 };
      }
    }
    const disableResult = await safeExec(LAUNCHCTL, ["disable", `${domain}/${bundleId}`], CONTEXT$5);
    if (disableResult.success) {
      logger.info(CONTEXT$5, `Successfully disabled ${bundleId} via disable`);
      return { success: true, data: void 0 };
    }
    return {
      success: false,
      error: `Failed to disable service ${bundleId}: ${bootoutResult.error}`,
      code: "LAUNCHCTL_DISABLE_FAILED"
    };
  }
  /**
   * Enable (load) a launchd service.
   * Uses 'launchctl bootstrap' for macOS 10.11+ or falls back to 'launchctl load'.
   *
   * @param bundleId - The launchd bundle ID to enable
   * @param requiresAdmin - Whether this service requires elevated privileges
   */
  async enableService(bundleId, requiresAdmin) {
    logger.info(CONTEXT$5, `Enabling service: ${bundleId}`, { requiresAdmin });
    const uid = process.getuid !== void 0 ? process.getuid() : 501;
    const domain = requiresAdmin ? "system" : `gui/${uid}`;
    const enableResult = await safeExec(
      LAUNCHCTL,
      ["enable", `${domain}/${bundleId}`],
      CONTEXT$5
    );
    if (enableResult.success) {
      const plistPath2 = this.resolvePlistPath(bundleId, requiresAdmin);
      if (plistPath2 !== null) {
        const bootstrapResult = await safeExec(
          LAUNCHCTL,
          ["bootstrap", domain, plistPath2],
          CONTEXT$5
        );
        if (bootstrapResult.success) {
          logger.info(CONTEXT$5, `Successfully enabled ${bundleId} via bootstrap`);
          return { success: true, data: void 0 };
        }
      }
    }
    const plistPath = this.resolvePlistPath(bundleId, requiresAdmin);
    if (plistPath !== null) {
      const loadResult = await safeExec(LAUNCHCTL, ["load", "-w", plistPath], CONTEXT$5);
      if (loadResult.success) {
        logger.info(CONTEXT$5, `Successfully enabled ${bundleId} via load`);
        return { success: true, data: void 0 };
      }
    }
    return {
      success: false,
      error: `Failed to enable service ${bundleId}`,
      code: "LAUNCHCTL_ENABLE_FAILED"
    };
  }
  /**
   * Resolve the plist file path for a given bundle ID.
   * Checks standard launchd plist locations.
   */
  resolvePlistPath(bundleId, requiresAdmin) {
    const systemPaths = [
      `/System/Library/LaunchDaemons/${bundleId}.plist`,
      `/Library/LaunchDaemons/${bundleId}.plist`
    ];
    const userPaths = [
      `/System/Library/LaunchAgents/${bundleId}.plist`,
      `/Library/LaunchAgents/${bundleId}.plist`,
      `${os.homedir()}/Library/LaunchAgents/${bundleId}.plist`
    ];
    const paths = requiresAdmin ? [...systemPaths, ...userPaths] : [...userPaths, ...systemPaths];
    for (const p of paths) {
      return p;
    }
    return null;
  }
}
const DEFAULTS = "/usr/bin/defaults";
const CONTEXT$4 = "DefaultsService";
class DefaultsService {
  static instance;
  constructor() {
  }
  /** Get the singleton instance */
  static getInstance() {
    if (DefaultsService.instance === void 0) {
      DefaultsService.instance = new DefaultsService();
    }
    return DefaultsService.instance;
  }
  /**
   * Read the current value of a defaults key.
   *
   * @param domain - The defaults domain, e.g. "com.apple.CrashReporter"
   * @param key - The defaults key, e.g. "DialogType"
   */
  async readValue(domain, key) {
    const result = await safeExecOutput(DEFAULTS, ["read", domain, key], CONTEXT$4);
    if (!result.success) {
      if (result.error.includes("does not exist") || result.code === "1") {
        return { success: true, data: "" };
      }
      return result;
    }
    return { success: true, data: result.data.trim() };
  }
  /**
   * Write a value to a defaults key.
   *
   * @param domain - The defaults domain
   * @param key - The defaults key
   * @param type - The value type flag (string, bool, int, float)
   * @param value - The value to write
   */
  async writeValue(domain, key, type, value) {
    logger.info(CONTEXT$4, `Writing defaults: ${domain} ${key} = ${value} (${type})`);
    const result = await safeExec(DEFAULTS, ["write", domain, key, `-${type}`, value], CONTEXT$4);
    if (!result.success) {
      return {
        success: false,
        error: `Failed to write defaults ${domain} ${key}: ${result.error}`,
        ...result.code !== void 0 ? { code: result.code } : {}
      };
    }
    return { success: true, data: void 0 };
  }
  /**
   * Delete a defaults key (restores to system default).
   *
   * @param domain - The defaults domain
   * @param key - The defaults key to delete
   */
  async deleteValue(domain, key) {
    logger.info(CONTEXT$4, `Deleting defaults key: ${domain} ${key}`);
    const result = await safeExec(DEFAULTS, ["delete", domain, key], CONTEXT$4);
    if (!result.success) {
      if (result.error.includes("does not exist") || result.code === "1") {
        return { success: true, data: void 0 };
      }
      return {
        success: false,
        error: `Failed to delete defaults ${domain} ${key}: ${result.error}`,
        ...result.code !== void 0 ? { code: result.code } : {}
      };
    }
    return { success: true, data: void 0 };
  }
  /**
   * Determine the current state of a service controlled via defaults.
   * Compares the current value against the disabledValue.
   *
   * @param cmd - The DefaultsCommand definition from the service registry
   */
  async getServiceState(cmd) {
    const result = await this.readValue(cmd.domain, cmd.key);
    if (!result.success) {
      return result;
    }
    const currentValue = result.data;
    if (currentValue === "") {
      return { success: true, data: ServiceState.Enabled };
    }
    if (currentValue === cmd.disabledValue) {
      return { success: true, data: ServiceState.Disabled };
    }
    return { success: true, data: ServiceState.Enabled };
  }
  /**
   * Disable a service by writing its disabled value.
   *
   * @param cmd - The DefaultsCommand definition
   */
  async disableService(cmd) {
    return this.writeValue(cmd.domain, cmd.key, cmd.type, cmd.disabledValue);
  }
  /**
   * Enable a service by writing its enabled value (or deleting the key to restore default).
   *
   * @param cmd - The DefaultsCommand definition
   */
  async enableService(cmd) {
    return this.writeValue(cmd.domain, cmd.key, cmd.type, cmd.enabledValue);
  }
}
const SYSCTL = "/usr/sbin/sysctl";
const VM_STAT = "/usr/bin/vm_stat";
const CONTEXT$3 = "SystemInfoService";
class SystemInfoService {
  static instance;
  latestStats = null;
  pollTimer = null;
  activeCount = 0;
  disabledCount = 0;
  // Cached values that never change at runtime
  cachedCpuCount = null;
  cachedTotalRamBytes = null;
  // Pre-compiled regex patterns for vm_stat parsing
  static VM_STAT_PATTERNS = {
    free: /Pages free:\s+(\d+)/,
    active: /Pages active:\s+(\d+)/,
    wired: /Pages wired down:\s+(\d+)/,
    compressed: /Pages occupied by compressor:\s+(\d+)/
  };
  constructor() {
  }
  static getInstance() {
    if (SystemInfoService.instance === void 0) {
      SystemInfoService.instance = new SystemInfoService();
    }
    return SystemInfoService.instance;
  }
  setServiceCounts(active, disabled) {
    this.activeCount = active;
    this.disabledCount = disabled;
  }
  /**
   * Start polling. Fetches immediately, then every STATS_POLL_INTERVAL_MS.
   * Pre-warms the cached CPU count and total RAM on first call.
   */
  startPolling() {
    if (this.pollTimer !== null) return;
    void this.warmCaches().then(() => {
      void this.fetchStats();
    });
    this.pollTimer = setInterval(() => {
      void this.fetchStats();
    }, STATS_POLL_INTERVAL_MS);
    logger.info(CONTEXT$3, `Started polling every ${STATS_POLL_INTERVAL_MS}ms`);
  }
  stopPolling() {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      logger.info(CONTEXT$3, "Stopped polling");
    }
  }
  async getStats() {
    if (this.latestStats !== null) {
      return { success: true, data: this.latestStats };
    }
    return this.fetchStats();
  }
  /**
   * Read CPU count and total RAM once — these never change.
   */
  async warmCaches() {
    const [cpuResult, ramResult] = await Promise.all([
      safeExecOutput(SYSCTL, ["-n", "hw.logicalcpu"], CONTEXT$3),
      safeExecOutput(SYSCTL, ["-n", "hw.memsize"], CONTEXT$3)
    ]);
    if (cpuResult.success) {
      const count = parseInt(cpuResult.data, 10);
      if (!isNaN(count) && count > 0) this.cachedCpuCount = count;
    }
    if (ramResult.success) {
      const bytes = parseInt(ramResult.data, 10);
      if (!isNaN(bytes) && bytes > 0) this.cachedTotalRamBytes = bytes;
    }
    logger.debug(CONTEXT$3, "Caches warmed", {
      cpuCount: this.cachedCpuCount,
      totalRamGB: this.cachedTotalRamBytes !== null ? (this.cachedTotalRamBytes / 1024 ** 3).toFixed(1) : null
    });
  }
  async fetchStats() {
    const [cpuResult, ramResult] = await Promise.all([
      this.getCpuUsage(),
      this.getRamUsage()
    ]);
    const stats = {
      cpuUsagePercent: cpuResult.success ? cpuResult.data : this.latestStats?.cpuUsagePercent ?? 0,
      ramUsedGB: ramResult.success ? ramResult.data.usedGB : this.latestStats?.ramUsedGB ?? 0,
      ramTotalGB: ramResult.success ? ramResult.data.totalGB : this.latestStats?.ramTotalGB ?? 0,
      ramUsedPercent: ramResult.success ? ramResult.data.usedPercent : this.latestStats?.ramUsedPercent ?? 0,
      activeServicesCount: this.activeCount,
      disabledServicesCount: this.disabledCount,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.latestStats = stats;
    return { success: true, data: stats };
  }
  async getCpuUsage() {
    const loadResult = await safeExecOutput(SYSCTL, ["-n", "vm.loadavg"], CONTEXT$3);
    if (!loadResult.success) {
      return { success: false, error: "Failed to read load average", code: "CPU_READ_FAILED" };
    }
    if (this.cachedCpuCount === null) {
      const countResult = await safeExecOutput(SYSCTL, ["-n", "hw.logicalcpu"], CONTEXT$3);
      if (countResult.success) {
        const count = parseInt(countResult.data, 10);
        if (!isNaN(count) && count > 0) this.cachedCpuCount = count;
      }
    }
    const cpuCount = this.cachedCpuCount ?? 1;
    const loadMatch = loadResult.data.match(/\{\s*([\d.]+)/);
    if (loadMatch === null || loadMatch[1] === void 0) {
      return { success: false, error: "Failed to parse load average", code: "CPU_PARSE_FAILED" };
    }
    const loadAvg = parseFloat(loadMatch[1]);
    if (isNaN(loadAvg)) {
      return { success: false, error: "Invalid load average", code: "CPU_INVALID" };
    }
    return { success: true, data: Math.min(100, Math.round(loadAvg / cpuCount * 100)) };
  }
  async getRamUsage() {
    const vmStatResult = await safeExecOutput(VM_STAT, [], CONTEXT$3);
    if (!vmStatResult.success) {
      return { success: false, error: "Failed to read vm_stat", code: "RAM_READ_FAILED" };
    }
    if (this.cachedTotalRamBytes === null) {
      const totalResult = await safeExecOutput(SYSCTL, ["-n", "hw.memsize"], CONTEXT$3);
      if (totalResult.success) {
        const bytes = parseInt(totalResult.data, 10);
        if (!isNaN(bytes) && bytes > 0) this.cachedTotalRamBytes = bytes;
      }
    }
    if (this.cachedTotalRamBytes === null) {
      return { success: false, error: "Total RAM unknown", code: "RAM_TOTAL_UNKNOWN" };
    }
    const pageSize = 4096;
    const vmOutput = vmStatResult.data;
    const parsePages = (pattern) => {
      const match = vmOutput.match(pattern);
      if (match === null || match[1] === void 0) return 0;
      return parseInt(match[1], 10) * pageSize;
    };
    const activeBytes = parsePages(SystemInfoService.VM_STAT_PATTERNS.active);
    const wiredBytes = parsePages(SystemInfoService.VM_STAT_PATTERNS.wired);
    const compressedBytes = parsePages(SystemInfoService.VM_STAT_PATTERNS.compressed);
    const usedBytes = activeBytes + wiredBytes + compressedBytes;
    const totalBytes = this.cachedTotalRamBytes;
    const totalGB = totalBytes / 1024 ** 3;
    const usedGB = usedBytes / 1024 ** 3;
    return {
      success: true,
      data: {
        usedGB: Math.round(usedGB * 10) / 10,
        totalGB: Math.round(totalGB * 10) / 10,
        usedPercent: Math.min(100, Math.round(usedBytes / totalBytes * 100))
      }
    };
  }
}
const CONTEXT$2 = "ServiceManager";
class ServiceManager {
  static instance;
  launchctl = LaunchctlService.getInstance();
  defaults = DefaultsService.getInstance();
  sysInfo = SystemInfoService.getInstance();
  dataDir;
  backupPath;
  constructor() {
    this.dataDir = path.join(os.homedir(), DATA_DIR_NAME);
    this.backupPath = path.join(this.dataDir, BACKUP_FILENAME);
    fs.mkdirSync(this.dataDir, { recursive: true });
  }
  /** Get the singleton instance */
  static getInstance() {
    if (ServiceManager.instance === void 0) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }
  /**
   * Get all services with their current runtime states.
   * Reads actual system state — not cached.
   */
  async getAllServicesWithState() {
    logger.info(CONTEXT$2, "Reading all service states from system");
    const launchctlServices = SERVICE_REGISTRY.filter(
      (s) => s.controlMethod === ControlMethod.Launchctl || s.controlMethod === ControlMethod.Hybrid
    );
    const bundleIds = launchctlServices.map((s) => s.launchAgentId).filter((id) => id !== void 0);
    const launchctlStates = await this.launchctl.getMultipleServiceStates(bundleIds);
    const results = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const service of SERVICE_REGISTRY) {
      const state = await this.readServiceState(service, launchctlStates);
      const runtimeState = {
        serviceId: service.id,
        currentState: state,
        lastChecked: now
      };
      results.push({ ...service, runtimeState });
    }
    const active = results.filter((s) => s.runtimeState.currentState === ServiceState.Enabled).length;
    const disabled = results.filter((s) => s.runtimeState.currentState === ServiceState.Disabled).length;
    this.sysInfo.setServiceCounts(active, disabled);
    logger.info(CONTEXT$2, `Loaded ${results.length} services`, { active, disabled });
    return { success: true, data: results };
  }
  /**
   * Read the current state of a single service.
   */
  async readServiceState(service, launchctlStates) {
    try {
      if (service.controlMethod === ControlMethod.Launchctl || service.controlMethod === ControlMethod.Hybrid) {
        if (service.launchAgentId !== void 0 && launchctlStates.success) {
          return launchctlStates.data.get(service.launchAgentId) ?? ServiceState.Unknown;
        }
      }
      if (service.controlMethod === ControlMethod.Defaults || service.controlMethod === ControlMethod.Hybrid) {
        if (service.defaultsCommand !== void 0) {
          const result = await this.defaults.getServiceState(service.defaultsCommand);
          if (result.success) return result.data;
        }
      }
      return ServiceState.Unknown;
    } catch (err) {
      logger.warn(CONTEXT$2, `Failed to read state for ${service.id}`, { err });
      return ServiceState.Unknown;
    }
  }
  /**
   * Apply a batch of service changes with progress reporting and rollback on failure.
   *
   * @param changes - Array of service changes to apply
   * @param window - BrowserWindow to send progress events to
   */
  async applyChanges(changes, window) {
    logger.info(CONTEXT$2, `Applying ${changes.length} changes`);
    const snapshotResult = await this.takeSnapshot();
    if (!snapshotResult.success) {
      logger.warn(CONTEXT$2, "Failed to take snapshot before apply", { error: snapshotResult.error });
    }
    const applied = [];
    const errors = [];
    const sendProgress = (progress) => {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.APPLY_PROGRESS, progress);
      }
    };
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      if (change === void 0) continue;
      const service = SERVICE_REGISTRY.find((s) => s.id === change.serviceId);
      if (service === void 0) {
        errors.push(`Unknown service: ${change.serviceId}`);
        continue;
      }
      sendProgress({
        total: changes.length,
        completed: i,
        current: service.name,
        status: "running"
      });
      const result = await this.applyChange(service, change.action);
      if (result.success) {
        applied.push(change);
        logger.info(CONTEXT$2, `Applied change: ${change.action} ${service.id}`);
      } else {
        errors.push(`${service.name}: ${result.error}`);
        logger.error(CONTEXT$2, `Failed to apply change`, {
          service: service.id,
          action: change.action,
          error: result.error
        });
        sendProgress({
          total: changes.length,
          completed: i,
          current: service.name,
          status: "rollingback",
          error: result.error
        });
        const rollbackResult = await this.rollback(applied);
        if (!rollbackResult.success) {
          logger.error(CONTEXT$2, "Rollback failed", { error: rollbackResult.error });
        }
        sendProgress({
          total: changes.length,
          completed: i,
          current: service.name,
          status: "error",
          error: result.error
        });
        return {
          success: true,
          data: {
            success: false,
            applied: applied.length,
            failed: errors.length,
            rolledBack: true,
            errors
          }
        };
      }
    }
    sendProgress({
      total: changes.length,
      completed: changes.length,
      current: "",
      status: "success"
    });
    return {
      success: true,
      data: {
        success: true,
        applied: applied.length,
        failed: 0,
        rolledBack: false,
        errors: []
      }
    };
  }
  /**
   * Apply a single service change.
   */
  async applyChange(service, action) {
    const isDisable = action === ChangeAction.Disable;
    if (service.controlMethod === ControlMethod.Launchctl || service.controlMethod === ControlMethod.Hybrid) {
      if (service.launchAgentId !== void 0) {
        const result = isDisable ? await this.launchctl.disableService(service.launchAgentId, service.requiresAdmin) : await this.launchctl.enableService(service.launchAgentId, service.requiresAdmin);
        if (!result.success && service.controlMethod === ControlMethod.Launchctl) {
          return result;
        }
      }
    }
    if (service.controlMethod === ControlMethod.Defaults || service.controlMethod === ControlMethod.Hybrid) {
      if (service.defaultsCommand !== void 0) {
        const result = isDisable ? await this.defaults.disableService(service.defaultsCommand) : await this.defaults.enableService(service.defaultsCommand);
        if (!result.success) return result;
      }
    }
    return { success: true, data: void 0 };
  }
  /**
   * Rollback a list of applied changes (reverse the actions).
   */
  async rollback(applied) {
    logger.info(CONTEXT$2, `Rolling back ${applied.length} changes`);
    for (const change of [...applied].reverse()) {
      const service = SERVICE_REGISTRY.find((s) => s.id === change.serviceId);
      if (service === void 0) continue;
      const reverseAction = change.action === ChangeAction.Disable ? ChangeAction.Enable : ChangeAction.Disable;
      const result = await this.applyChange(service, reverseAction);
      if (!result.success) {
        logger.error(CONTEXT$2, `Rollback failed for ${service.id}`, { error: result.error });
      }
    }
    return { success: true, data: void 0 };
  }
  /**
   * Take a snapshot of all current service states and write to backup.json.
   */
  async takeSnapshot() {
    const servicesResult = await this.getAllServicesWithState();
    if (!servicesResult.success) return servicesResult;
    const snapshot = {
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      appVersion: APP_VERSION,
      states: servicesResult.data.map((s) => ({
        serviceId: s.id,
        state: s.runtimeState.currentState
      }))
    };
    try {
      fs.writeFileSync(this.backupPath, JSON.stringify(snapshot, null, 2), "utf-8");
      logger.info(CONTEXT$2, `Snapshot written to ${this.backupPath}`);
      return { success: true, data: void 0 };
    } catch (err) {
      return {
        success: false,
        error: `Failed to write snapshot: ${String(err)}`,
        code: "SNAPSHOT_WRITE_FAILED"
      };
    }
  }
  /**
   * Revert all services to the state recorded in the backup snapshot.
   */
  async revertAll(window) {
    logger.info(CONTEXT$2, "Reverting all changes from backup snapshot");
    let snapshot;
    try {
      const raw = fs.readFileSync(this.backupPath, "utf-8");
      snapshot = JSON.parse(raw);
    } catch (err) {
      return {
        success: false,
        error: `Failed to read backup snapshot: ${String(err)}`,
        code: "SNAPSHOT_READ_FAILED"
      };
    }
    const changes = snapshot.states.map((entry) => ({
      serviceId: entry.serviceId,
      action: entry.state === ServiceState.Enabled ? ChangeAction.Enable : ChangeAction.Disable
    }));
    const result = await this.applyChanges(changes, window);
    if (!result.success) return { success: false, error: result.error ?? "Revert failed" };
    return { success: true, data: void 0 };
  }
  /**
   * Check if a backup snapshot exists.
   */
  hasBackup() {
    return fs.existsSync(this.backupPath);
  }
}
const CONTEXT$1 = "IpcHandlers";
function registerIpcHandlers(getWindow) {
  const serviceManager = ServiceManager.getInstance();
  const sysInfo = SystemInfoService.getInstance();
  const dataDir = path.join(os.homedir(), DATA_DIR_NAME);
  const settingsPath = path.join(dataDir, SETTINGS_FILENAME);
  const firstLaunchPath = path.join(dataDir, FIRST_LAUNCH_FILENAME);
  ipcMain.handle(IPC_CHANNELS.GET_SERVICES, async () => {
    try {
      return await serviceManager.getAllServicesWithState();
    } catch (err) {
      logger.error(CONTEXT$1, "getServices failed", { err });
      return { success: false, error: "Failed to load services", code: "GET_SERVICES_FAILED" };
    }
  });
  ipcMain.handle(IPC_CHANNELS.GET_SYSTEM_STATS, async () => {
    try {
      return await sysInfo.getStats();
    } catch (err) {
      logger.error(CONTEXT$1, "getSystemStats failed", { err });
      return { success: false, error: "Failed to get system stats", code: "STATS_FAILED" };
    }
  });
  ipcMain.handle(
    IPC_CHANNELS.APPLY_CHANGES,
    async (_event, changes) => {
      try {
        const window = getWindow();
        if (window === null) {
          return { success: false, error: "No active window", code: "NO_WINDOW" };
        }
        return await serviceManager.applyChanges(changes, window);
      } catch (err) {
        logger.error(CONTEXT$1, "applyChanges failed", { err });
        return { success: false, error: "Failed to apply changes", code: "APPLY_FAILED" };
      }
    }
  );
  ipcMain.handle(IPC_CHANNELS.REVERT_ALL, async () => {
    try {
      const window = getWindow();
      if (window === null) {
        return { success: false, error: "No active window", code: "NO_WINDOW" };
      }
      return await serviceManager.revertAll(window);
    } catch (err) {
      logger.error(CONTEXT$1, "revertAll failed", { err });
      return { success: false, error: "Failed to revert changes", code: "REVERT_FAILED" };
    }
  });
  ipcMain.handle(IPC_CHANNELS.EXPORT_REPORT, async () => {
    try {
      const [servicesResult, statsResult] = await Promise.all([
        serviceManager.getAllServicesWithState(),
        sysInfo.getStats()
      ]);
      const settings = loadSettings(settingsPath);
      const report = {
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        appVersion: APP_VERSION,
        macosVersion: process.getSystemVersion(),
        systemStats: statsResult.success ? statsResult.data : {
          cpuUsagePercent: 0,
          ramUsedGB: 0,
          ramTotalGB: 0,
          ramUsedPercent: 0,
          activeServicesCount: 0,
          disabledServicesCount: 0,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        services: servicesResult.success ? servicesResult.data : [],
        settings
      };
      return { success: true, data: JSON.stringify(report, null, 2) };
    } catch (err) {
      logger.error(CONTEXT$1, "exportReport failed", { err });
      return { success: false, error: "Failed to export report", code: "EXPORT_FAILED" };
    }
  });
  ipcMain.handle(IPC_CHANNELS.HAS_BACKUP, () => {
    try {
      return { success: true, data: serviceManager.hasBackup() };
    } catch (err) {
      logger.error(CONTEXT$1, "hasBackup failed", { err });
      return { success: false, error: "Failed to check backup", code: "BACKUP_CHECK_FAILED" };
    }
  });
  ipcMain.handle(IPC_CHANNELS.IS_FIRST_LAUNCH, () => {
    try {
      const isDone = fs.existsSync(firstLaunchPath);
      return { success: true, data: !isDone };
    } catch (err) {
      logger.error(CONTEXT$1, "isFirstLaunch failed", { err });
      return { success: false, error: "Failed to check first launch", code: "FIRST_LAUNCH_FAILED" };
    }
  });
  ipcMain.handle(IPC_CHANNELS.MARK_FIRST_LAUNCH_DONE, () => {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(firstLaunchPath, (/* @__PURE__ */ new Date()).toISOString(), "utf-8");
      return { success: true, data: void 0 };
    } catch (err) {
      logger.error(CONTEXT$1, "markFirstLaunchDone failed", { err });
      return { success: false, error: "Failed to mark first launch", code: "MARK_LAUNCH_FAILED" };
    }
  });
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
    try {
      return { success: true, data: loadSettings(settingsPath) };
    } catch (err) {
      logger.error(CONTEXT$1, "getSettings failed", { err });
      return { success: false, error: "Failed to load settings", code: "SETTINGS_LOAD_FAILED" };
    }
  });
  ipcMain.handle(
    IPC_CHANNELS.SAVE_SETTINGS,
    (_event, settings) => {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
        app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
        logger.info(CONTEXT$1, "Settings saved", { settings });
        return { success: true, data: void 0 };
      } catch (err) {
        logger.error(CONTEXT$1, "saveSettings failed", { err });
        return { success: false, error: "Failed to save settings", code: "SETTINGS_SAVE_FAILED" };
      }
    }
  );
  logger.info(CONTEXT$1, "All IPC handlers registered");
}
function loadSettings(settingsPath) {
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
  }
  return { ...DEFAULT_SETTINGS };
}
const CONTEXT = "Main";
let mainWindow = null;
function createWindow() {
  const iconPath = path.join(__dirname, "../../src/Logos/AppIcon512.png");
  const appIcon = nativeImage.createFromPath(iconPath);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#0D0D0F",
    vibrancy: "under-window",
    visualEffectState: "active",
    icon: appIcon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    logger.info(CONTEXT, "Main window shown");
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env["ELECTRON_RENDERER_URL"] !== void 0) {
    void mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  logger.info(CONTEXT, "BrowserWindow created");
}
app.whenReady().then(() => {
  logger.info(CONTEXT, `${APP_NAME} starting up`, {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions["electron"],
    nodeVersion: process.versions["node"]
  });
  nativeTheme.themeSource = "dark";
  registerIpcHandlers(() => mainWindow);
  createWindow();
  SystemInfoService.getInstance().startPolling();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  SystemInfoService.getInstance().stopPolling();
  logger.info(CONTEXT, "All windows closed, quitting");
  logger.close();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("web-contents-created", (_event, contents) => {
  contents.on("will-navigate", (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== "null" && !url.startsWith("file://")) {
      event.preventDefault();
      logger.warn(CONTEXT, `Blocked navigation to: ${url}`);
    }
  });
});
