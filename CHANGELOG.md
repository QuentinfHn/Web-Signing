# Changelog

All notable changes to this project are documented in this file.

## v0.2.0 - 2026-02-06

### Release summary

- Added VNNOX player integration with status polling and Companion API support.
- Hardened Companion API authentication and required `ADMIN_PASSWORD` for startup.
- Improved content caching, cache invalidation, and display loading behavior.
- Fixed multiple Docker/deploy pipeline issues for more reliable production updates.
- Added map and preset UI improvements (live preview, layout/styling tweaks).

### What changed

#### Security and authentication

- Required `ADMIN_PASSWORD` for Companion API access and server startup safety checks.
- Added API key authentication for Companion routes.
- Added preset creation validation and tightened module resolution for ESM compatibility.

#### VNNOX integration and player status

- Added VNNOX player integration with polling and Companion endpoints.
- Allowed a VNNOX player to be linked to multiple screens.
- Fixed VNNOX link flow to fetch actual player status.
- Added VNNOX environment variables to `docker-compose`.
- Updated offline player visibility and renamed `lastOnlineTime` to `lastSeen`.

#### Content caching and display behavior

- Added content URL versioning to bust stale cache.
- Improved offline cache warming and realtime cache invalidation.
- Unified content path resolution for Docker/production compatibility.
- Prevented nginx `/content` handling from intercepting SPA routes.
- Resolved a 60-second Display page delay in Chrome with empty cache.
- Refined display cache hydration and related tests.

#### UI and editor improvements

- Added live content preview with slideshow support in map popups.
- Centered map overview thumbnails.
- Improved preset screen row layout with width/flex styling.
- Added cascade delete for screens when deleting a display.
- Refactored slideshow timer behavior to reset only when config changes.
- Refactored auto-sync internals and display state update handling.
- Ensured a minimum of four scenarios.

#### Deployment and operations

- Optimized deploy workflow and Docker build performance.
- Replaced `wget` with `curl` in frontend health checks.
- Improved deploy workflow logging and error handling.
- Removed docker login from deploy script to avoid credential caching issues.
- Added `--accept-data-loss` for production Prisma `db push`.
- Fixed Docker dependency installation and content path handling.
- Removed backend dependency on `led-controller-root`.
- Replaced emoji text in deploy workflow output with plain text.

### Full commit list since v0.1.0

- `c118d6f` fix: use curl instead of wget for frontend healthcheck
- `f656934` Optimize deploy workflow and Docker builds
- `dcf8356` Merge pull request #11 from QuentinfHn/fix/deploy-workflow-efficiency
- `e8a88e3` feat: add VNNOX player integration with status polling and companion API
- `5ec7ab1` fix: show last seen timestamp for offline players on map
- `6b9c5d7` fix: rename lastOnlineTime to lastSeen in VNNOX broadcast types
- `39090bb` Merge pull request #12 from QuentinfHn/add/playerstatus
- `28dc9b0` Merge pull request #13 from QuentinfHn/dev
- `c140c7c` chore: Remove `led-controller-root` dependency from backend.
- `9e54a81` Merge pull request #14 from QuentinfHn/dev
- `a4ebcec` fix: remove file:.. dependencies and use npm install in Dockerfiles
- `26c1fb2` fix: use correct content path in Docker (production mode)
- `6325a81` improve: better error handling and logging in deploy workflow
- `8a30c11` style: replace emojis with plain text in deploy workflow
- `f044c43` fix: add --accept-data-loss flag to prisma db push for production migrations
- `e68b369` Improve offline cache warming and realtime cache invalidation
- `760af29` fix: remove docker login from deploy to prevent credential caching issues
- `3493fc6` fix: add VNNOX env vars to docker-compose
- `8ce0598` feat: allow VNNOX player to be linked to multiple screens
- `9e43baa` fix: fetch actual VNNOX status when linking player
- `2f46d13` fix: unify content path resolution for production/Docker compatibility
- `fc9d5c3` fix: prevent nginx /content location from intercepting SPA route
- `3f74f51` fix: resolve 60s delay on Display page in Chrome with empty cache
- `b7bf0e7` feat: Add live content preview with slideshow support to map popups and accompanying styles.
- `825fb11` style: Center image thumbnails horizontally in the map overview.
- `741765f` style: Add width and flex properties to select elements within presetScreenRow.
- `f3bb143` feat: Cascade deletion of associated screens when deleting a display.
- `0aaea64` refactor: Optimize slideshow timer management to only reset timers when configuration changes and improve state updates with functional forms.
- `38d94b1` refactor: enhance auto-sync logic with internal state management and optimize display state updates and slideshow timer cleanup.
- `7a6e6e1` Adjust display cache hydration and fix tests
- `847852e` Version content URLs to bust content cache
- `c518bc6` security: require ADMIN_PASSWORD for Companion API
- `2f4dd9f` Ensure minimum of four scenarios
- `c7afb59` feat: Implement API key authentication for companion routes, add preset creation validation, and update module resolution for ESM compatibility.

### Stats

- 34 commits
- 61 files changed
- 3066 insertions, 589 deletions
