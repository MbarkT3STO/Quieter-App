# Quieter

> macOS system optimizer — reclaim performance on aging Macs by selectively managing background services.

[![macOS](https://img.shields.io/badge/macOS-12%2B-blue?logo=apple)](https://www.apple.com/macos/)
[![Electron](https://img.shields.io/badge/Electron-30-47848F?logo=electron)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**GitHub:** [MbarkT3STO/Quieter-App](https://github.com/MbarkT3STO/Quieter-App)

---

## What is Quieter?

Quieter is a desktop app for macOS that lets you view, disable, and re-enable background system services — safely, transparently, and reversibly. It targets users on low-end or aging Macs who want to reduce CPU/RAM usage without guessing which processes to kill.

- **60 curated services** across 6 categories (Performance, Network, Visuals, Privacy, Sync, Misc)
- **No silent changes** — every toggle is pending until you explicitly click Apply
- **Automatic backup** — a snapshot is written before any change so you can always revert
- **Rollback on failure** — if any command fails mid-apply, all applied changes are reversed
- **Live state reading** — actual system state is read on launch, not cached

---

## Features

| Feature | Details |
|---|---|
| Service browser | 60 real macOS services with descriptions, risk levels, and impact ratings |
| Safe apply flow | Changes are staged as pending — nothing touches the system until Apply is clicked |
| Risk warnings | Advanced-risk services trigger a confirmation modal before applying |
| Snapshot & revert | Full state backup written to `~/.quieter/backup.json` before every apply |
| System stats | Live CPU % and RAM usage with a 90-second sparkline chart |
| Dark / Light / System theme | Full theme switcher with smooth transitions |
| Collapsible sidebar | Icon-only rail mode to maximize content space |
| Search | Real-time filter across service name, description, and category |
| Category views | Browse services by Performance, Network, Visuals, Privacy, Sync, Misc |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Electron 30 + Node.js |
| Language | TypeScript 5.4 (strict mode) |
| UI | Pure HTML5 + CSS3 — no React, Vue, or any UI framework |
| IPC | contextBridge + typed ipcRenderer/ipcMain |
| Build | electron-vite + electron-builder |
| Styling | CSS custom properties (design tokens) |

---

## Architecture

```
src/
├── main/                        ← Electron main process (Node.js)
│   ├── index.ts                 ← App entry, BrowserWindow setup
│   ├── ipc/
│   │   ├── handlers.ts          ← All ipcMain.handle() registrations
│   │   └── channels.ts          ← Typed IPC channel constants
│   ├── services/
│   │   ├── ServiceManager.ts    ← Orchestrates all service ops + snapshot/rollback
│   │   ├── LaunchctlService.ts  ← Wraps launchctl CLI (bootout/bootstrap)
│   │   ├── DefaultsService.ts   ← Wraps defaults write/read
│   │   ├── SystemInfoService.ts ← CPU/RAM polling via sysctl + vm_stat
│   │   └── PermissionService.ts ← Permission checks
│   └── utils/
│       ├── shell.ts             ← Safe execFile wrapper (no shell injection)
│       └── logger.ts            ← Structured JSON logger with rotation
├── preload/
│   ├── index.ts                 ← contextBridge exposures only
│   └── api.d.ts                 ← window.peakMacAPI type declarations
├── renderer/                    ← UI layer (zero Node.js APIs)
│   ├── index.html
│   ├── main.ts                  ← Bootstrap: layout, router, data loading
│   ├── core/
│   │   ├── Router.ts            ← Hash router
│   │   ├── Store.ts             ← Reactive state (observer pattern)
│   │   ├── EventBus.ts          ← Typed pub/sub event bus
│   │   ├── Component.ts         ← Abstract base component (mount/unmount lifecycle)
│   │   └── ThemeManager.ts      ← Dark/light/system theme switching
│   ├── components/
│   │   ├── Sidebar.ts           ← Collapsible navigation sidebar
│   │   ├── TopBar.ts            ← Page title + refresh + pending badge
│   │   ├── ServiceCard.ts       ← Service card with toggle, badge, effects
│   │   ├── ApplyBar.ts          ← Fixed bottom bar for pending changes
│   │   ├── Toggle.ts            ← CSS-only animated toggle switch
│   │   ├── Badge.ts             ← Risk level pill badge
│   │   ├── Modal.ts             ← Accessible dialog (onboarding + risk warning)
│   │   ├── Toast.ts             ← Toast notification stack
│   │   └── ProgressBar.ts       ← Apply progress indicator
│   ├── views/
│   │   ├── DashboardView.ts     ← Stats cards + CPU sparkline + quick actions
│   │   ├── ServicesView.ts      ← All services with inline search
│   │   ├── CategoryView.ts      ← Services filtered by category
│   │   └── SettingsView.ts      ← Settings + theme switcher + about card
│   └── assets/
│       ├── styles/
│       │   ├── tokens.css       ← Design tokens (dark + light themes)
│       │   ├── reset.css        ← Minimal CSS reset
│       │   ├── global.css       ← Typography, layout, utilities
│       │   └── components/      ← Per-component CSS files
│       └── icons/               ← App icon PNGs (16–1024px)
└── shared/
    ├── types.ts                 ← All TypeScript interfaces and enums
    ├── constants.ts             ← Shared constants (app name, paths, URLs)
    └── serviceRegistry.ts       ← 60 curated macOS services database
```

### Design Patterns

| Pattern | Where Used |
|---|---|
| Observer | `Store.ts` — reactive state subscriptions |
| Command | `ServiceManager.ts` — enable/disable/apply/rollback |
| Repository | `serviceRegistry.ts` — typed service data access |
| Strategy | `LaunchctlService` vs `DefaultsService` — different control mechanisms |
| Factory | `CategoryView.forCategory()` — view creation from route params |
| Singleton | `Store`, `EventBus`, `Logger`, `ThemeManager`, all services |

---

## Setup

### Requirements

- macOS 12 Monterey or later
- Node.js 18+
- npm 9+

### Install & Run

```bash
# Clone the repository
git clone https://github.com/MbarkT3STO/Quieter-App.git
cd Quieter-App

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Other Commands

```bash
# Type check (no emit)
npm run typecheck

# Lint
npm run lint

# Fix lint issues
npm run lint:fix

# Production build (outputs to out/)
npm run build

# Package as .dmg for distribution
npm run dist:mac
```

---

## Service Categories

| Category | Count | Examples |
|---|---|---|
| Performance | 13 | Spotlight, Siri, Apple Intelligence, mediaanalysisd, chronod |
| Network | 10 | AirDrop, Handoff, Bonjour, searchpartyd, WeatherKit |
| Visuals | 8 | Transparency, Reduce Motion, Live Text, Visual Look Up |
| Privacy | 10 | Crash Reporter, Analytics, Biome Sync, Context Store |
| Sync | 7 | iCloud Drive, Photos, Keychain, accountsd, contactsd |
| Misc | 12 | Time Machine, Software Update, Power Nap, Gatekeeper |

---

## Safety Model

1. **No immediate apply** — toggling a service only marks it as pending. Nothing touches the system until the user clicks "Apply Changes"
2. **Confirmation modal** — services marked `risk: 'advanced'` trigger a warning dialog before proceeding
3. **Snapshot before apply** — `~/.quieter/backup.json` is written before any changes are made
4. **Rollback on failure** — if any command fails mid-apply, all already-applied changes are reversed automatically
5. **Live state sync** — actual system state is read from `launchctl` and `defaults` on every launch
6. **Input sanitization** — all shell arguments are validated against a safe character allowlist before execution

---

## Adding a New Service

1. Open `src/shared/serviceRegistry.ts`
2. Add a `MacService` entry to the appropriate category array
3. Verify `launchAgentId` by running `launchctl list | grep <name>` in Terminal
4. Verify `defaultsCommand` keys with `defaults read <domain>` in Terminal
5. Set `risk: RiskLevel.Advanced` for anything that could break core functionality

```typescript
{
  id: 'my-service',                        // unique slug
  name: 'My Service',                      // display name
  category: ServiceCategory.Performance,
  launchAgentId: 'com.apple.myservice',    // from launchctl list
  controlMethod: ControlMethod.Launchctl,
  risk: RiskLevel.Safe,
  impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
  description: 'What this service does.',
  disableEffect: 'What the user gains by disabling it.',
  enableEffect: 'What the user loses if disabled.',
  defaultState: ServiceState.Enabled,
  requiresRestart: false,
  requiresAdmin: false,
}
```

---

## Data Files

| Path | Purpose |
|---|---|
| `~/.quieter/backup.json` | Service state snapshot for revert |
| `~/.quieter/settings.json` | App settings (theme, launch at login, etc.) |
| `~/.quieter/logs/app.log` | Structured JSON log with rotation at 5 MB |
| `~/.quieter/.first-launch-done` | First launch flag (triggers onboarding modal) |

---

## Why Some Services Re-enable After Apply

macOS has three tiers of service protection:

| Tier | Example | Persists after restart? |
|---|---|---|
| `defaults write` controlled | Transparency, Reduce Motion | ✅ Always |
| User LaunchAgent (`launchctl disable`) | Game Center, Screen Time | ✅ Usually |
| SIP-protected system daemon | Spotlight mds, Bluetooth | ❌ No — macOS re-enables on boot |

Services in `/System/Library/LaunchDaemons/` are protected by System Integrity Protection (SIP). Disabling them requires booting into Recovery Mode — outside the scope of a safe optimizer.

---

## License

MIT — see [LICENSE](LICENSE) for details.
