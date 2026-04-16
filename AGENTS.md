# AGENTS.md - Epicollect5 Mobile App Development Guide

## Architecture Overview

This is a **dual-target hybrid application** built with Vue 3 + Ionic + Capacitor that runs as:
1. **Native Mobile App** (Android/iOS) - Uses Cordova SQLite plugin for offline-first data collection
2. **Progressive Web App (PWA)** - Single-page server-driven form submissions

**Key Insight**: The app detects its platform at boot (`main.js`) and initializes completely different initialization flows. This affects state, routing, and database access patterns.

### Platform Detection & Boot
- **Platform check**: `rootStore.isPWA = (rootStore.device.platform === PARAMETERS.PWA)`
- **Native flow**: Opens local SQLite DB → initializes stores → loads projects from DB
- **PWA flow**: Fetches project from server API → skips DB → uses ephemeral state
- Files: `src/main.js` (lines 105-333), `src/config/index.js` (PARAMETERS)

---

## Critical Architecture Patterns

### 1. **Pinia Stores as Singleton State Layer**
- Three root stores in `src/stores/`:
  - `root-store.js`: Global app state (user, device, URLs, modals, language)
  - `db-store.js`: Database instance & metadata (version, entries order)
  - `bookmark-store.js`: User bookmarks for quick project access
- **Important**: Stores are populated during boot - mock them with fresh Pinia in tests (`setActivePinia(createPinia())`)
- All stores use `const store = useXxxStore()` pattern; never import the store object directly

### 2. **Dual Data Flows: Database vs API**
- **Native**: `databaseSelectService` → SQLite queries (promises with callbacks)
- **PWA**: `webService` → Axios HTTP calls with JWT tokens
- **Models** (`src/models/`) act as in-memory caches:
  - `projectModel.initialise(data)` parses JSON from DB
  - `projectModel.initialisePWA(data)` expects server-provided objects
- Database is opened once in `root-store` but interacted through query services (no direct access)

### 3. **Services: No Inheritance, Object Literal Pattern**
All services are singletons exported as object literals with methods:
```
export const myService = {
  async doSomething(params) { ... },
  helperMethod() { ... }
};
```
- Import and use directly: `import { webService } from '@/services/web-service'`
- Never instantiate with `new`
- Use arrow functions to preserve `this` context or use `const self = this;` pattern

### 4. **Models vs Services Distinction**
- **Models** (`src/models/`): Stateful, domain objects holding project/entry structure (JSON-based)
- **Services**: Stateless utilities - database queries, API calls, file operations, validation
- Projects load via `projectModel` → accessed via `projectModel.getProjectExtra()` getter

---

## Entry & Form Data Structure

### Form Hierarchy
1. **Project** → contains multiple **Forms** → contains multiple **Inputs** (questions)
2. **Entries** = responses to forms, stored with:
   - `entry_uuid`: unique identifier (UUID v4)
   - `form_ref`: which form this entry answers
   - `parent_entry_uuid`: for hierarchy (branch) entries
   - `answers`: JSON string of all answers
   - `synced`: boolean, tracks upload state
   - `can_edit`: permission flag

### Branch Entries (Hierarchical)
- Child entries linked to parent via `parent_entry_uuid`
- PWA distinguishes: `branchEditType` = `BRANCH_LOCAL` (hierarchy) vs `BRANCH_REMOTE` (direct branch)
- Detection: check for `branch_ref` and `branch_owner_uuid` URL params

---

## Critical Developer Workflows

### Build Commands (From README)
- **Development**: `npm run serve` (hot reload, no compilation)
- **Native Debug**: `npm run native:debug` → builds web assets + copies to Android/iOS
  - Sets `VUE_APP_MODE=WEBVIEW`, `VUE_APP_DEBUG=1`
- **Native Prod**: `npm run native:prod` → runs tests, builds optimized, copies
  - Tests are mandatory prerequisite (`prenative:prod` hook)
- **PWA Dev**: `npm run pwa:browser` → runs on port 1234 with debug enabled
- **PWA Prod**: `npm run pwa:prod` → runs tests, optimizes, generates bundle analysis

### Testing Strategy
- **Framework**: Vitest (NOT Jest) - required by build system
- **Key pattern**: `vi.resetModules()` + dynamic imports in tests because `main.js` is an IIFE
- **Globals enabled** but must explicitly import in test files: `import { describe, it, expect, vi } from 'vitest'`
- Test structure in `tests/unit/` mirrors `src/` - service tests, component tests, spec files
- Coverage: `npm run coverage` (v8 provider, see `vitest.config.js`)

### Environment Variables
- **`.env.local`** (create from `.env-example.local`) controls:
  - `VUE_APP_MODE`: `WEBVIEW` (native) or `PWA` (web) - set by build scripts
  - `VUE_APP_DEBUG`: `1` to enable debug UI/skip validation
  - `VUE_APP_GOOGLE_CLIENT_ID_WEB`: OAuth client ID

---

## Code Style & Linting Rules

**STRICT enforcement - build will fail on violations:**
- Semicolons: ALWAYS required at statement end (`'semi': ['error', 'always']`)
- Quotes: SINGLE quotes only (`'quotes': ['error', 'single']`)
- Trailing commas: NEVER (`'comma-dangle': [1, 'never']`)
- Variables: Prefer `const` over `let`, NEVER use `var`

**Vue Components**:
- Follow exact option order: `props` → `emits` → `setup` → `data` → `computed` → `watch` → `methods`
- Use `setup()` composition API preferred over options API
- Multi-word component name checks disabled (custom elements from Ionic)

### File Organization
```
src/
├── components/          # Vue SFCs (organized by domain)
│   ├── questions/      # Question-type specific components
│   ├── answers/        # Answer display/edit components
│   ├── modals/         # Ionic modals
│   ├── globals/        # App-wide layouts
├── config/             # Constants (PARAMETERS, STRINGS)
├── models/             # Domain objects (project, entry, form, branch)
├── services/           # Business logic (organized by domain)
│   ├── database/       # Query & migration services
│   ├── auth/           # Authentication flows
│   ├── validation/     # Form validation rules
│   ├── filesystem/     # File/media operations
├── stores/             # Pinia store definitions
├── pages/              # Route page components
├── router/             # Vue Router configuration
├── use/                # Composables (reusable logic)
```

---

## Cross-Component Communication Patterns

### Root Store as Message Bus
- Modal open/close: set `rootStore.modalLogin`, listen in pages
- Progress tracking: set `rootStore.progressTransfer`, watched by progress modals
- User actions with callbacks: `rootStore.afterUserIsLoggedIn = { callback, params }`
- Routing state: `rootStore.routeParams` passed between entry editing pages

### Modal Lifecycle
- Modals opened via `modalController.create()` from `@ionic/vue`
- Return data from `modal.onDidDismiss()` → handled by caller
- Service: `modalsHandlerService` coordinates multistep flows (e.g., login → project load)

### Router State vs URL Params
- **Mobile app**: Uses named routes with params - routeParams stored in Pinia
- **PWA**: URL is source of truth - parsed at boot (`window.location.pathname`, `window.location.search`)
- Navigation happens via `router.push({ name: PARAMETERS.ROUTES.ENTRIES_ADD })`

---

## API & Server Integration

### Dual Authentication
1. **JWT tokens**: Native app - stored locally, refreshed via `initService.retrieveJwtToken()`
2. **Session cookies**: PWA - browser handles automatically (same-origin requests)

### Axios Configuration
- Web service uses interceptor pattern in `webService.getHeaders()` → injects JWT
- PWA uses `/api/internal` endpoints (different from web app's public `/api` routes)
- Timeout: `PARAMETERS.DEFAULT_TIMEOUT` (check `config/index.js`)

### Project Versioning
- Projects store schema version - migrations trigger on mismatch
- Update detection: compare local version against server via `projectModel`

---

## Database Access Pattern (Native Only)

### SQLite Via Cordova Plugin
- Instance: `dbStore.db` (opened once, never closed mid-session)
- All queries use promise wrappers: `databaseSelectService.getRows(query, params)`
- No direct SQL - use domain query services: `databaseSelectService`, `databaseInsertService`, `databaseUpdateService`
- Transactions: wrapped in `.transaction()` callback with rollback on error

### Key Tables
- `projects`: meta + JSON schema
- `entries`: responses, linked to forms via `form_ref`
- `settings`: app preferences
- `users`: local user profile

### Migration System
- Version stored in settings table
- Migration files in `src/services/database/` execute on boot if needed
- Import pattern: dynamic based on version number

---

## Special Platform Considerations

### Capacitor vs Cordova
- **Capacitor**: Modern replacement for Cordova (used for native APIs)
- **Legacy**: Old apps may still use Cordova plugins (e.g., SQLite via cordova-sqlite-storage)
- App distinguishes: `Capacitor.isNativePlatform()` vs PWA
- Media paths differ - comment in `main.js` line 273-276 explains legacy vs new filesystem APIs

### Geolocation & Permissions
- Stored in `rootStore.deviceGeolocation`
- Permission flag: `rootStore.geolocationPermission`
- Watch pattern: starts on location input focus, stops when not needed
- Web fallback: uses browser Geolocation API

### Error Tracking
- Rollbar integration in `rollbarService`
- Console capture: configured at `main.js` line 61-67 (bold blue console.info override)

---

## Testing Patterns & Gotchas

### main.js Boot Testing
- **Challenge**: main.js is an IIFE that runs at import time
- **Solution**: Reset modules between tests (`vi.resetModules()`)
- **Pattern**: Mock all services BEFORE importing main.js
- Example: see `tests/unit/main.spec.js` (lines 1-30 explain the approach)

### Component Testing
- Mock router, stores, services
- Use `@vue/test-utils` with `mount()` for SFC testing
- Ionic components need custom element config in vitest: `isCustomElement: (tag) => tag.includes('-')`

### Database Service Testing
- Mock `dbStore.db` with vitest functions (don't create real SQLite)
- Promise-based: services return promises even for sync callbacks

---

## Debugging Tips

### Debug Mode Features
- Set `VUE_APP_DEBUG=1` in build scripts
- Enables: debug UI elements, validation bypass (`VUE_APP_BYPASS_UNIQUENESS=1`), XDEBUG support
- Check `PARAMETERS.DEBUG` to guard debug-only features
- Source maps enabled in `vue.config.js` for native & PWA builds

### Common Issues
1. **"Module X not found"**: Check `@/` alias in `vitest.config.js` and `vue.config.js`
2. **Store is undefined**: Ensure `setActivePinia(createPinia())` runs before using stores
3. **Trailing comma errors**: Run `npm run lint` - ESLint will auto-fix many issues
4. **Database locked**: SQLite transaction error - check for uncaught promise rejections

---

## When Adding Features

1. **New Form Input Type?** → Create component in `src/components/questions/`, use models to access form structure
2. **New API Endpoint?** → Add to `webService.js`, follow JWT header pattern
3. **New Permission?** → Check Capacitor plugin docs, add to platform init flow in `main.js`
4. **New Store State?** → Add to appropriate Pinia store, use computed() for derived state
5. **New Database Table?** → Create migration in `src/services/database/migrations/`, increment version
6. **New Page?** → Create in `src/pages/`, add route to `src/router/index.js` (PWA vs native routes differ)
7. **New Test?** → Use Vitest with explicit imports, mock external dependencies first

---

## Key Files to Know

- `src/main.js`: Boot logic, platform detection, store initialization
- `src/config/index.js`: All constants, API routes, parameters
- `src/stores/root-store.js`: Global state contract
- `src/models/project-model.js`: Project structure access layer
- `src/services/web-service.js`: All API communication
- `src/router/index.js`: Route definitions (different for PWA vs native)
- `vitest.config.js`: Test environment setup (globals, jsdom, vue plugin)
- `.github/copilot-instructions.md`: ESLint/style rules (read first!)

