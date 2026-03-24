# Pitfalls Research

> Context: Migrating a 740KB, 11,000-line monolithic HTML file (guild management system for MapleStory guild "뚠카롱") to React + Vite SPA. Active users. Must maintain 100% feature parity with existing Supabase data and auth.

---

## Critical Pitfalls

### 1. Attempting a "Big Bang" Cutover Instead of Incremental Delivery

**Warning signs**
- Planning phases that end with "everything works" rather than shippable slices
- No interim deployable checkpoint until the migration is nearly complete
- The original app stays live with no parallel testing period

**Prevention strategy**
- Structure phases so each one produces a deployable, testable build — even if incomplete
- Keep the original `index.html` deployed and accessible during the entire migration
- Define an explicit "parity checkpoint" per feature group (auth, member CRUD, score tracking, etc.) before moving to the next group
- Run both old and new UIs against the same Supabase project simultaneously during validation

**Phase mapping**
- Phase 1 (scaffold/infra): Establish deploy pipeline so every phase produces a real URL
- Every subsequent phase: ends with a working deploy, not just passing unit tests

---

### 2. Losing Implicit Business Logic Hidden in the Monolith

**Warning signs**
- Translating code mechanically without reading the surrounding context
- Score calculation, promotion/demotion thresholds, reward formulas, or buddy-matching rules are "obvious" so they go undocumented
- A feature "works" in isolation but produces different totals than the original

**Prevention strategy**
- Before migrating any feature, extract its core logic into a plain TypeScript function with explicit inputs/outputs and test it against real Supabase data from the existing system
- Document every formula found in the monolith (수로 점수 계산, 승강 기준, 보상 계산) as constants or utility functions with a comment referencing the original line number in `index.html`
- Treat any numeric formula as high-risk; cross-validate outputs with the existing app before retiring it

**Phase mapping**
- Phase covering 수로/승강/보상: allocate dedicated time to logic extraction before UI work begins

---

### 3. Breaking Google OAuth + Supabase Auth Redirect Flow

**Warning signs**
- Hardcoded redirect URIs that differ between local dev, staging, and production
- Auth callback lands on a Vite dev server URL that Supabase / Google doesn't have whitelisted
- Session state lost on page refresh because React Router renders before the Supabase session is restored

**Prevention strategy**
- Register all environments (localhost:5173, staging URL, production URL) in both Google Cloud Console and Supabase Auth settings before writing a single line of auth code
- Implement a `<AuthGuard>` that suspends rendering until `supabase.auth.getSession()` resolves — never assume session state is synchronously available on mount
- Replicate the "allowed email check" logic from the original app as a separate post-auth gate, not just a UI redirect; verify it blocks unauthorized accounts in the new system before going live

**Phase mapping**
- Phase 1 (scaffold): Auth plumbing complete before any feature work starts; do not proceed to feature phases with a broken or simulated auth flow

---

### 4. State Management Fragmentation Across 14 Features

**Warning signs**
- Each feature (게시판, 캘린더, 버디 매칭, etc.) fetches Supabase data independently with no shared cache
- Member list fetched 5 times across different components because there is no shared member store
- Optimistic updates in one component are invisible to sibling components until a full page reload

**Prevention strategy**
- Decide on a data-fetching strategy in Phase 1 and enforce it: either React Query (recommended for Supabase) with a shared cache, or a lightweight global store (Zustand). Do not mix approaches
- Identify "shared entities" early — members, weekly scores, calendar events — and treat them as global cache keys that all features read from rather than re-fetching independently
- For any mutation (adding a member, recording a score), invalidate the relevant cache keys immediately so all views update without a reload

**Phase mapping**
- Phase 1: choose and document the data-fetching strategy; Phase 2+: enforce it in every feature

---

### 5. Tailwind CSS Class Conflicts Between CDN (Original) and PostCSS (New)

**Warning signs**
- The original app uses Tailwind via CDN with arbitrary values and no purging; the React app uses Tailwind via PostCSS with content scanning
- Custom color names, spacing values, or plugin classes used in the original that don't exist in the new config
- Dark mode behavior changes because the CDN used `class` strategy but the new config defaults to `media`

**Prevention strategy**
- Audit the original app's Tailwind usage before scaffolding: extract all custom config, arbitrary values (`w-[740px]`, `text-[#somecolor]`), and dark mode usage
- Set `darkMode: 'class'` in `tailwind.config.js` from day one — the original app uses class-based toggling
- Keep a `tailwind.config.js` that mirrors the original's CDN config as closely as possible; do not introduce design system changes during migration (that is a post-migration task)

**Phase mapping**
- Phase 1: Tailwind config locked before any component is built

---

### 6. OCR (OpenCV.js) Breaking in the Vite/ESM Environment

**Warning signs**
- OpenCV.js is loaded as a global script tag in the original; it relies on `window.cv` being available
- Vite's ESM bundling and module isolation breaks `window.cv` assumptions
- The OCR feature is treated as "we'll figure it out later" and deferred until last

**Prevention strategy**
- Prototype the OpenCV.js integration in the Vite environment in Phase 1 before committing to the architecture — this is the highest-risk external dependency in the stack
- Load OpenCV.js as a side-effect script via `index.html` `<script>` tag rather than importing it, and wrap usage in a `useOpenCV` hook that waits for `window.cv` to be defined
- If the Vite environment causes intractable issues, isolate OCR behind a Web Worker so it runs outside the module system entirely

**Phase mapping**
- Phase 1 spike: validate OpenCV.js loads and a basic threshold operation runs; do not build the full OCR feature until this is confirmed

---

### 7. Chart.js Migration Regressions

**Warning signs**
- Chart.js `v2.x` syntax used in the original is incompatible with `v3.x`/`v4.x` (which npm installs by default)
- Canvas elements not properly cleaned up in React, causing "Canvas already in use" errors on re-render
- Responsive/dark mode chart theming that was applied globally via CDN config now needs per-component setup

**Prevention strategy**
- Pin Chart.js to the same major version used in the original; check `index.html` for the CDN URL to identify the version
- Always destroy the chart instance in the `useEffect` cleanup function: `return () => chart.destroy()`
- Use `react-chartjs-2` wrapper rather than direct Chart.js imperative API to avoid lifecycle management bugs

**Phase mapping**
- Phase covering 수로 분석/통계: Chart.js integration validated before building all chart variants

---

### 8. Cloudflare R2 Worker CORS and Auth Headers Changing

**Warning signs**
- The original app sends image upload requests directly from the browser to the R2 Worker with specific headers that were set in the monolith's fetch calls
- The React build changes the `Origin` header (different port, different domain during staging), causing CORS rejections
- The Worker's auth token is hardcoded in the original HTML and gets exposed in source maps if copied naively into React code

**Prevention strategy**
- Move the R2 Worker auth token to a `.env` file (`VITE_R2_WORKER_TOKEN`) and access it via `import.meta.env` — never inline secrets in component code
- Test the R2 upload flow from the Vite dev server (localhost:5173) against the live Worker early; update the Worker's CORS allowed origins to include all dev/staging domains before feature work starts
- Ensure the Worker's auth check matches what the React app sends — compare request headers side-by-side with the original

**Phase mapping**
- Phase covering Cloudflare R2 / 이미지 업로드: CORS validation is the first task, not the last

---

## Migration-Specific Risks

### R1. Feature Scope Creep During "While We're At It" Rewrites

Migrating 11,000 lines invites the temptation to improve everything simultaneously. Adding new features, redesigning UI, or refactoring data models during migration compounds risk multiplicably.

- **Detection**: Sprint tickets that include both "migrate X" and "improve X" in the same task
- **Prevention**: Enforce a strict rule — Phase 1 through parity phase: **no new features, no design changes**. Log all improvement ideas in a post-migration backlog. The roadmap's "통계 대시보드 강화" item must be scheduled after parity is confirmed, not during.

---

### R2. Routing Assumptions From the Monolith (Hash vs. History Mode)

The original single-file app likely uses hash-based navigation (`#section`) or manual DOM show/hide. React Router uses the History API by default.

- **Detection**: Any `window.location.hash` or `getElementById` + `display` show/hide patterns in the original
- **Prevention**: Audit all navigation patterns in the original before designing the React Router structure. If hash-based navigation was used for any deep-link features (e.g., sharing a direct link to a member's profile), replicate those URLs in React Router. Deploying to Cloudflare Pages requires configuring `_redirects` or equivalent to handle SPA fallback — missing this causes 404s on hard refresh.

---

### R3. Component Granularity Mistakes in the First Pass

Splitting 11,000 lines into components for the first time leads to two failure modes: too coarse (one giant component per page = monolith in JSX) or too fine (every row and button is a separate file = excessive prop-drilling).

- **Detection**: Any component file over ~400 lines is too coarse; any component that receives more than 6 props and forwards most of them is probably too fine
- **Prevention**: Use feature-based directory structure (`/features/members/`, `/features/scores/`) with co-located sub-components. The migration phase is not the time to design a perfect component hierarchy — start with one component per page route, then extract sub-components only when a clear reuse case exists.

---

### R4. Mobile Responsiveness Regression

The original app has validated mobile layout. React + Vite + PostCSS Tailwind can silently break responsive classes if the config differs.

- **Detection**: Test on a real mobile device (or Chrome DevTools mobile emulation) at the end of every feature phase — not only at the end of the migration
- **Prevention**: Add a mobile viewport screenshot to the "done" criteria for every page migrated. Pay particular attention to the 수로 점수 table (wide tables are common failure points) and the 캘린더 view.

---

### R5. Forgetting the "허용 이메일 체크" Admin Gate

The original app performs a secondary check after Google OAuth to verify the logged-in email is in an allowed list. This is a security-critical gate, not cosmetic.

- **Detection**: Any code path where a logged-in Google account reaches guild data without the email allowlist check passing
- **Prevention**: Implement the email allowlist gate as middleware in the routing layer (`<AdminRoute>` component) before any feature is accessible. Write a test that asserts an unrecognized Google account is rejected. Do not leave this as "the last thing to wire up."

---

## Data Compatibility Risks

### D1. Supabase Table Schema Assumptions Encoded in Component Props

The original app accesses Supabase rows as plain objects and may rely on specific column names throughout 11,000 lines. Introducing TypeScript types during migration without carefully matching the actual schema will cause silent runtime failures.

- **Detection**: TypeScript errors being suppressed with `as any` or `// @ts-ignore` during the migration — this means the type doesn't match reality
- **Prevention**:
  - Use `supabase gen types typescript` to generate types directly from the live schema before writing any component
  - Treat generated types as the ground truth; do not manually write types for Supabase tables
  - Lock the Supabase JS client to the same major version used by the original (check the CDN URL in `index.html`)

---

### D2. Row-Level Security (RLS) Behavior Differences Under the React Auth Flow

The original app authenticates once and all Supabase calls share that session. In React, the Supabase client must be a singleton; multiple instances created across components will not share the auth session and will fail RLS checks silently (returning empty arrays instead of errors).

- **Detection**: Supabase queries that return 0 rows in the new app but return data in the original, with no error thrown
- **Prevention**:
  - Create the Supabase client exactly once as a module-level singleton (`/lib/supabase.ts`) and import it everywhere
  - Never call `createClient()` inside a component or hook
  - After implementing auth, manually verify that a simple `select` on a protected table returns the expected rows before proceeding to feature work

---

### D3. Realtime / Subscription Cleanup Causing Memory Leaks and Duplicate Events

If the original app used Supabase Realtime subscriptions (e.g., for live score updates or board notifications), React's component lifecycle makes cleanup mandatory.

- **Detection**: Supabase subscription channels that are not removed in `useEffect` cleanup; duplicate events firing after navigating away and back to a page
- **Prevention**:
  - Every `supabase.channel()` subscription must have a corresponding `supabase.removeChannel()` in the `useEffect` return function
  - Use a single subscription per logical domain (one channel for scores, one for members) rather than per-component subscriptions
  - If Realtime is not critical for the initial release, defer it — do not implement it opportunistically during migration

---

### D4. Supabase Storage vs. Cloudflare R2 URL Format Changes

The original app may construct image URLs by concatenating Supabase project URL + storage path, or via the R2 Worker URL. If URL construction logic changes in the React app, existing stored image URLs in the database will become broken links.

- **Detection**: Images that displayed correctly in the original app show as broken in the new app despite the same database rows
- **Prevention**:
  - Locate every place in the original `index.html` where image URLs are constructed or displayed
  - Replicate the exact URL construction logic — do not "clean up" the format during migration
  - After migrating the image display feature, spot-check 5–10 existing database records with images to confirm they render correctly

---

### D5. Date/Time Handling Differences (캘린더, 수로 주차)

The original app likely performs date math (weekly score periods, calendar events) using JavaScript Date objects with implicit timezone assumptions. React components that re-render frequently can expose timezone bugs that the original's one-time render masked.

- **Detection**: Weekly score period boundaries that are off by one day; calendar events appearing on the wrong date for users in non-KST timezones
- **Prevention**:
  - Identify the timezone assumption in the original (almost certainly KST / UTC+9) and make it explicit in a utility function from day one
  - Use a consistent date library (e.g., `date-fns` with locale) rather than raw `Date` manipulation
  - Test date boundary cases: Sunday/Monday transitions for weekly scores, DST edge cases if relevant

---

*Last updated: 2026-03-24*
