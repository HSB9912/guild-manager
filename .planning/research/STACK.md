# Stack Research

> Context: Migrating 뚠카롱 길드 관리 시스템 from a 740KB single-file HTML/JS/CSS app (11,000 lines) to React + Vite SPA. Existing backend (Supabase, Cloudflare R2 Worker) is preserved. Admin-only app, no SSR required.

---

## Recommended Stack

### Core Framework

| Library | Version | Rationale |
|---------|---------|-----------|
| **React** | 19.x | Industry-standard component model for decomposing a monolith. React 19 ships stable concurrent features and the `use()` hook for cleaner async data access. The existing codebase has no framework coupling, so any React version is viable; 19 is the current stable release as of early 2025. |
| **Vite** | 6.x | Fastest cold-start dev server for SPAs. Native ES module serving eliminates the slow bundler rebuild cycle. `vite build` with Rollup produces optimal chunk splitting per route. Directly matches the project constraint. |
| **TypeScript** | 5.x | Supabase's JS SDK ships full TypeScript types; the generated DB schema types (`supabase gen types typescript`) eliminate an entire class of runtime bugs when accessing row data. For an 11,000-line codebase being decomposed, types are the primary safety net during migration. |

---

### Routing

| Library | Version | Rationale |
|---------|---------|-----------|
| **React Router** | 7.x (framework mode optional, use library mode) | The standard SPA router. v7 stabilized the data router API (loaders, actions) that was experimental in v6. Use `createBrowserRouter` for type-safe route definitions and built-in code-splitting via `React.lazy`. Avoids the complexity of TanStack Router for a project whose routes are well-known and not dynamically generated. |

---

### State Management

| Library | Version | Rationale |
|---------|---------|-----------|
| **Zustand** | 5.x | Lightweight global state without boilerplate. This app has cross-cutting concerns (logged-in user, dark mode, selected guild member) that need to be shared across distant components. Zustand's flat store model fits that pattern perfectly. Redux Toolkit is overkill for a single-admin app. Jotai is fine but Zustand's devtools integration is more mature. |
| **TanStack Query (React Query)** | 5.x | All data in this app comes from Supabase and is inherently async. TanStack Query handles loading/error/stale states, background refetching, and cache invalidation — removing the need for dozens of `useEffect` + `useState` pairs that would otherwise litter every component. Pairs cleanly with Supabase client calls as query functions. |

---

### Styling

| Library | Version | Rationale |
|---------|---------|-----------|
| **Tailwind CSS** | 4.x | Explicit project constraint. The existing 740KB file already uses Tailwind (CDN); migrating to the PostCSS/Vite plugin version gives tree-shaking (only used utilities bundled) and removes the runtime CDN parse overhead. v4 ships with a new CSS-first config (`@theme`) and faster build times. Existing class names from the monolith are reusable as-is. |
| **tailwind-merge** (`twMerge`) | 3.x | When composing Tailwind class strings in React components (conditional classes, variant props), naive string concatenation produces conflicting utilities (e.g., `p-2 p-4`). `twMerge` resolves conflicts correctly and is the standard companion to Tailwind in React. |
| **clsx** | 2.x | Lightweight utility for conditionally joining class names. Used together with `twMerge` as the `cn()` utility pattern ubiquitous in the React/Tailwind ecosystem. |

---

### UI Components

| Library | Version | Rationale |
|---------|---------|-----------|
| **shadcn/ui** (copy-paste components) | latest (2025) | Not a dependency — it's a CLI that copies unstyled Radix UI primitives pre-styled with Tailwind into your source tree. Gives accessible, production-quality components (dialogs, tables, dropdowns, date pickers) that match Tailwind perfectly. You own the code, so no version lock-in. For a guild management UI with modals, tables, and forms this eliminates hundreds of lines of boilerplate. |
| **Radix UI** (peer of shadcn/ui) | 1.x | Underlying headless primitives used by shadcn/ui. Listed explicitly because you may reach for individual Radix primitives directly. WAI-ARIA compliant out of the box — keyboard navigation and screen reader support without manual implementation. |
| **Lucide React** | 0.x (latest) | shadcn/ui's default icon set. Clean, consistent SVG icons as React components. Font Awesome (currently CDN) can be replaced without visual regression since icon names map closely. |

---

### Data / Backend

| Library | Version | Rationale |
|---------|---------|-----------|
| **@supabase/supabase-js** | 2.x | The official Supabase client. Wraps PostgREST, Supabase Auth, Realtime, and Storage. v2 is the stable production release. Do NOT upgrade to v3 (not yet released as of early 2025). The existing app already uses this client via CDN; the npm package is identical in API. |
| **Supabase CLI** (dev tooling) | 2.x | Used to generate TypeScript types from the live DB schema (`supabase gen types typescript --project-id ...`). Run this once during migration setup and again whenever the schema changes. This is the single highest-leverage action for type safety during migration. |

---

### Charts

| Library | Version | Rationale |
|---------|---------|-----------|
| **Chart.js** | 4.x | Already used in the existing app. Keeping it removes one migration risk vector. Wrap each chart in a dedicated React component using `useRef` + `useEffect` to manage the Chart.js instance lifecycle (create on mount, destroy on unmount). Do NOT switch to Recharts or Victory mid-migration — that's a separate project. |
| **react-chartjs-2** | 5.x | Thin React wrapper for Chart.js that handles the `useRef`/lifecycle boilerplate automatically. Directly compatible with Chart.js 4.x. Removes ~50 lines of imperative lifecycle code per chart component. |

---

### OCR / Image Processing

| Library | Version | Rationale |
|---------|---------|-----------|
| **OpenCV.js** | 4.x (WASM build) | Already used for client-side screenshot OCR. No replacement is warranted — the existing logic works. Load it asynchronously via a dynamic `import()` or a `<script>` tag in the component that needs it to avoid blocking the initial bundle. The WASM file is large (~8MB); lazy-loading it keeps the main bundle fast. |

---

### Forms

| Library | Version | Rationale |
|---------|---------|-----------|
| **React Hook Form** | 7.x | The guild management app has member CRUD forms, score entry forms, and calendar event forms. React Hook Form uses uncontrolled inputs with a ref-based approach, making it the most performant form library for React. Integrates directly with Zod for validation. |
| **Zod** | 3.x | Schema-based validation. Define a single Zod schema per form, use it for both TypeScript typing and runtime validation. Integrates with React Hook Form via `@hookform/resolvers`. Prevents invalid data from reaching Supabase. |

---

### Auth

| Library | Version | Rationale |
|---------|---------|-----------|
| **@supabase/auth-helpers-react** (or the newer `@supabase/ssr`) | latest | The existing auth flow is Google OAuth → Supabase Auth → allowlist email check. Supabase's React helpers provide `useSession`, `useUser`, and `useSupabaseClient` hooks, reducing auth state management to essentially zero custom code. For a pure SPA (no SSR), the React helpers package is simpler than the `@supabase/ssr` package (which targets Next.js/Remix). |

---

### Build & Dev Tooling

| Library | Version | Rationale |
|---------|---------|-----------|
| **ESLint** | 9.x (flat config) | ESLint 9 ships the new flat config format. Use `eslint-plugin-react-hooks` to enforce rules of hooks — the most common source of bugs during a migration from imperative code. |
| **Prettier** | 3.x | Consistent code formatting. Reduces diff noise during migration review when many files are touched simultaneously. |
| **Vitest** | 3.x | Unit testing framework co-located with Vite. Same config, same transform pipeline. Use for testing utility functions (score calculations, promotion/demotion logic) extracted from the monolith. Not for full E2E — out of scope for initial migration. |

---

## What NOT to Use

### Next.js / Remix
The project explicitly chose React + Vite SPA, and correctly so. This is an admin-only app with no SEO requirements, no server-side rendering needs, and no edge rendering benefit. Adding a full-stack framework introduces file-based routing conventions, server component complexity, and deployment requirements (Node.js server or adapter) that are entirely unnecessary. The Supabase backend is the server.

### Redux Toolkit
Overkill for a single-admin, single-user-session app. The store would be large, the boilerplate significant, and the cognitive overhead high during a migration where the primary task is decomposition, not state architecture. Zustand covers all identified state needs.

### Axios
`@supabase/supabase-js` abstracts all HTTP calls to Supabase. For the Cloudflare R2 Worker, native `fetch()` is sufficient. Adding Axios adds ~14KB to the bundle for zero benefit.

### Vite 5.x (older minor)
Vite 6 is the current stable release. Vite 5 is not end-of-life but starting new projects on it means a migration within 12 months. No reason to start on the older version.

### React 18.x (older major)
React 19 is the current stable release. The `use()` hook and improved async patterns are directly useful for this project's data-fetching patterns. React 18 works but offers no advantage for a greenfield React setup.

### MUI / Ant Design / Chakra UI
These component libraries ship their own styling systems that conflict with Tailwind. The project has an existing Tailwind-based visual language from the monolith. Layering a second design system on top creates specificity conflicts and bundle bloat. shadcn/ui is the correct choice because it IS Tailwind.

### Recharts / Victory / Nivo
Replacing Chart.js with a React-native charting library during the migration introduces unnecessary risk. The existing charts are validated by users. Chart.js + react-chartjs-2 is a stable bridge that preserves exact visual parity. Consider a chart library replacement post-migration as a separate initiative.

### Valtio / Recoil / MobX
Recoil is deprecated (Meta archived it). Valtio and MobX are valid but have smaller ecosystems than Zustand. Zustand + TanStack Query covers all state needs. Using multiple state management libraries creates cognitive overhead.

### SWR
SWR is Vercel's data-fetching library and is a valid alternative to TanStack Query. However, TanStack Query is more feature-complete (mutations with optimistic updates, infinite queries, background sync) and has a larger ecosystem. For a Supabase-backed app with write-heavy operations (CRUD), TanStack Query's mutation API is meaningfully better.

### @supabase/ssr
This package is designed for server-side frameworks (Next.js, Remix, SvelteKit) where cookies must be managed server-side to avoid auth token flickering. For a pure Vite SPA, it adds complexity without benefit. Use `@supabase/supabase-js` directly with the React auth helpers.

---

## Confidence Levels

| Recommendation | Confidence | Notes |
|---------------|------------|-------|
| React 19 + Vite 6 | **High** | Explicitly required by project constraints; both are current stable releases |
| TypeScript 5 | **High** | Near-universal in 2025 React projects; Supabase type generation makes this a no-brainer |
| React Router 7 (library mode) | **High** | Dominant SPA router; v7 data API is stable and production-proven |
| Tailwind CSS 4 | **High** | Explicit project constraint; v4 is the current stable release |
| TanStack Query 5 | **High** | Standard for async data in React; replaces dozens of useEffect patterns directly |
| Zustand 5 | **High** | Standard lightweight global state; clear fit for cross-cutting UI state |
| shadcn/ui + Radix UI | **High** | Best-in-class accessible components for Tailwind projects in 2025 |
| @supabase/supabase-js 2 | **High** | Already in use; no API changes required |
| Chart.js 4 + react-chartjs-2 5 | **High** | Preserves existing chart logic; lowest-risk migration path |
| React Hook Form 7 + Zod 3 | **High** | Standard form validation stack; direct integration path |
| tailwind-merge + clsx | **High** | Universally used with Tailwind in React; zero-risk additions |
| OpenCV.js 4 (lazy-loaded) | **Medium** | Existing functionality preserved; lazy-loading strategy requires one non-trivial implementation decision |
| Supabase React auth helpers | **Medium** | Supabase's auth helper packages have had naming/package changes; verify the correct package name against Supabase docs at implementation time (`@supabase/auth-helpers-react` vs `@supabase/ssr` vs direct `supabase.auth` usage) |
| Vitest 3 | **Medium** | Appropriate tool, but test coverage scope during migration is undefined; may not be used heavily in phase 1 |
| ESLint 9 flat config | **Medium** | Correct tool; flat config is a breaking change from v8 and has a learning curve if the team is unfamiliar with it |

---

*Last updated: 2026-03-24*
*Research context: Brownfield migration, React + Vite SPA, Supabase backend retained*
