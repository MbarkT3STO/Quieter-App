# Quieter

A production-ready macOS system optimizer built with Electron + TypeScript. Helps users on low-end or aging Macs reclaim performance by selectively managing background services.

## Architecture

```
quieter/
├── src/
│   ├── main/                    ← Electron main process (Node.js)
│   │   ├── index.ts             ← App entry, BrowserWindow setup
│   │   ├── ipc/
│   │   │   ├── handlers.ts      ← All ipcMain.handle() registrations
│   │   │   └── channels.ts      ← Typed IPC channel constants
│   │   ├── services/
│   │   │   ├── ServiceManager.ts    ← Orchestrates all service ops
│   │   │   ├── LaunchctlService.ts  ← Wraps launchctl CLI
│   │   │   ├── DefaultsService.ts   ← Wraps defaults write/read
│   │   │   ├── SystemInfoService.ts ← CPU/RAM polling
│   │   │   └── PermissionService.ts ← Permission checks
│   │   └── utils/
│   │       ├── shell.ts         ← Safe exec wrapper (no injection)
│   │       └── logger.ts        ← Structured file + console logger
│   ├── preload/
│   │   ├── index.ts             ← contextBridge exposures
│   │   └── api.d.ts             ← window.peakMacAPI type declarations
│   ├── renderer/                ← UI (no Node.js APIs)
│   │   ├── index.html
│   │   ├── main.ts              ← Renderer bootstrap
│   │   ├── core/
│   │   │   ├── Router.ts        ← Hash router
│   │   │   ├── Store.ts         ← Reactive state (observer pattern)
│   │   │   ├── EventBus.ts      ← Typed pub/sub
│   │   │   └── Component.ts     ← Abstract base component
│   │   ├── components/          ← Reusable UI components
│   │   └── views/               ← Full page views
│   └── shared/
│       ├── types.ts             ← All TypeScript interfaces/enums
│       ├── constants.ts         ← Shared constants
│       └── serviceRegistry.ts   ← 30+ curated macOS services
├── electron.vite.config.ts
├── tsconfig.json
└── package.json
```

## Design Patterns

| Pattern | Where Used |
|---------|-----------|
| Observer | `Store.ts` — reactive state subscriptions |
| Command | `ServiceManager.ts` — enable/disable/apply operations |
| Repository | `serviceRegistry.ts` — service data access |
| Strategy | `LaunchctlService` vs `DefaultsService` — different control mechanisms |
| Factory | `CategoryView.forCategory()` — component creation |
| Singleton | `Store`, `EventBus`, `Logger`, all services |

## Setup

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Build for production
npm run build

# Package as .dmg
npm run dist:mac
```

## Requirements

- macOS 12 Monterey or later
- Node.js 18+
- npm 9+

## Adding a New Service

1. Open `src/shared/serviceRegistry.ts`
2. Add a new `MacService` entry to the appropriate category array
3. Follow the interface — all fields are required
4. Verify the `launchAgentId` against `launchctl list` on your Mac
5. Verify `defaultsCommand` keys against `defaults read <domain>` output
6. Set `risk: 'advanced'` for anything that could break core functionality

### Example entry:

```typescript
{
  id: 'my-service',
  name: 'My Service',
  category: ServiceCategory.Performance,
  launchAgentId: 'com.apple.myservice',
  controlMethod: ControlMethod.Launchctl,
  risk: RiskLevel.Safe,
  impact: { cpu: ImpactLevel.Low, ram: ImpactLevel.Low },
  description: 'What this service does in plain English.',
  disableEffect: 'What the user gains by disabling it.',
  enableEffect: 'What the user loses if disabled.',
  defaultState: ServiceState.Enabled,
  requiresRestart: false,
  requiresAdmin: false,
}
```

## Safety Model

1. **No immediate apply** — toggling marks a service as pending only
2. **Confirmation modal** — advanced-risk services require explicit confirmation
3. **Snapshot before apply** — `~/.quieter/backup.json` written before any changes
4. **Rollback on failure** — if any change fails mid-apply, all applied changes are reversed
5. **Live state sync** — actual system state read on launch, not cached
6. **Input sanitization** — all shell arguments validated against a safe character allowlist

## Data Files

| Path | Purpose |
|------|---------|
| `~/.quieter/backup.json` | Service state snapshot for revert |
| `~/.quieter/settings.json` | App settings |
| `~/.quieter/logs/app.log` | Structured JSON log |
| `~/.quieter/.first-launch-done` | First launch flag |

## License

MIT
