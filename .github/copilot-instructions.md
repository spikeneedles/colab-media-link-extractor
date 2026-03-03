# Copilot Instructions

## Project Overview

AI-powered media link extraction tool that scans IPTV playlists, APKs, Kodi configs, Git repositories, and 50+ file formats. Includes a Gemini 2.5 Flash AI assistant, community pattern hub, auto-discovery crawlers, and Xtream Codes / Prowlarr integration.

## Architecture

Two independent packages with separate `package.json` files:

- **Root (`/`)** — React 19 + TypeScript frontend (GitHub Spark framework, Vite dev server on `:5001`)
- **`/backend`** — Node.js/Express 5 backend (TypeScript, runs on `:3001` dev / `:3002` prod)

The frontend communicates with the backend via `VITE_BACKEND_URL` / `VITE_API_URL` (set in root `.env`). The backend's `.env.example` documents all required keys.

### Frontend (`/src`)

| Path | Role |
|------|------|
| `src/components/` | 50+ feature components (one feature per file, CamelCase named) |
| `src/lib/` | Core logic: `linkExtractor.ts`, `m3uGenerator.ts`, `crawler.ts`, `patternGenerator.ts`, `geminiAssistant.ts`, etc. |
| `src/hooks/` | Custom React hooks (`useAutoCrawler`, `useExtensionBridge`, `useRuntimeCapture`, etc.) |
| `src/api/` | API client functions calling backend endpoints |
| `src/components/ui/` | Radix UI primitive wrappers (do not edit — treat as a component library) |

### Backend (`/backend/src`)

| Path | Role |
|------|------|
| `index.ts` | Express app setup, core routes, service initialization |
| `routes/` | 13 modular route files (one domain per file, e.g., `aiRoutes.ts`, `kodiSyncRoutes.ts`) |
| `services/` | Stateful service classes (`SearchCrawler`, `BackgroundCrawler`, `DownloadMonitor`, `MediaMetadataEnricher`, etc.) |
| `browserPool.ts` | Puppeteer browser pool (respects `MAX_CONCURRENT_BROWSERS`) |
| `geminiService.ts` | Gemini 2.5 Flash wrapper |
| `cache.ts` | TTL-based `CacheManager` |
| `auth.ts` | Optional API key auth (`AUTH_ENABLED` env flag) |

## Commands

### Frontend (run from repo root)
```bash
npm run dev        # Start Vite dev server on :5001
npm run build      # tsc (no type-check) + vite build
npm run lint       # ESLint
npm run preview    # Preview production build
```

### Backend (run from `/backend`)
```bash
npm run dev        # tsx watch src/index.ts (hot reload)
npm run build      # tsc
npm run start      # node dist/index.js
npm test           # vitest (run all tests)
npx vitest run <file>  # Run a single test file
npm run generate-key   # Generate a new API key
```

### Docker (run from repo root)
```bash
docker compose up                    # Full stack (frontend + backend + redis + nginx)
docker compose -f docker-compose.dev.yml up   # Development variant
docker compose -f docker-compose.prod.yml up  # Production hardened
```

## Key Conventions

**Imports & Paths**
- Use the `@/` alias for all `src/` imports in the frontend (configured in `vite.config.ts` and `tsconfig.json`).
- Backend files use `.js` extensions in imports even when the source is `.ts` (ESM Node.js requirement).

**Backend Services**
- Services are initialized once in `backend/src/index.ts` and passed down or imported; don't re-instantiate singletons like `BrowserPool` in routes.
- New routes should be created as a file in `backend/src/routes/`, exported as a default Express Router, and mounted in `index.ts`.

**Frontend Components**
- UI primitives live in `src/components/ui/` and wrap Radix UI — compose these rather than adding raw Radix imports.
- Toast notifications use `sonner`. Error boundaries use `react-error-boundary`.
- Persistent client-side state uses `localStorage` via `storageManager.ts` in `src/lib/`.

**Environment**
- Frontend env vars must be prefixed `VITE_` and are read via `import.meta.env`.
- Backend reads from `backend/.env` (copy `backend/.env.example` to get started). Required external keys: `GEMINI_API_KEY`. Optional: `TMDB_API_KEY`, `TVDB_API_KEY`, `TRAKT_API_KEY`, debrid service keys.
- SQLite database lives at `backend/data/media.db` (auto-created on first run).

**API Route Prefixes**
- `/api/ai/*` — Gemini AI endpoints
- `/api/patterns/*` — Pattern CRUD
- `/api/crawler/*` — Crawler control
- `/api/stremio/*` — Stremio addon
- `/api/kodi/*` — Kodi sync
- `/api/apk/*` — APK scanning
- `/api/media/*` — Media processing & downloads (auth-gated when `AUTH_ENABLED=true`)
- `/api/extension/*` — Browser extension bridge

**TypeScript**
- Frontend: strict nullChecks enabled, `tsc -b --noCheck` skips type checking on build (use the lint step instead).
- Backend: standard `tsc` build, types in `backend/src/types/`.
