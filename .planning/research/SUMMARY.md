# Research Summary

> Synthesized from STACK.md, FEATURES.md, ARCHITECTURE.md, and PITFALLS.md
> Project: 뚠카롱 길드 관리 시스템 — Brownfield migration from 740KB monolithic HTML/JS/CSS (11,000 lines) to React + Vite SPA
> Backend (Supabase, Cloudflare R2 Worker) is preserved unchanged.
> Date: 2026-03-24

---

## Stack Decision

| Concern | Choice | Reason |
|---------|--------|--------|
| Framework + build | React 19 + Vite 6 + TypeScript 5 | Explicit project constraints; both are current stable releases. TS types generated from live Supabase schema are the primary safety net during decomposition. |
| Routing | React Router 7 (library mode, `createBrowserRouter`) | Stable data router API; built-in code-splitting via `React.lazy`; avoids TanStack Router complexity for known, static routes. |
| Server state | TanStack Query 5 | Replaces dozens of `useEffect`+`useState` fetch patterns; automatic caching, background revalidation, and mutation invalidation are directly applicable to every Supabase call in this app. |
| UI state | Zustand 5 | Lightweight global state for cross-cutting concerns (dark mode, sidebar, toast queue). No Provider boilerplate. |
| Styling | Tailwind CSS 4 (PostCSS/Vite) + tailwind-merge + clsx | Explicit constraint; existing class names reuse as-is. `darkMode: 'class'` must be set from day one to match the original. |
| Components | shadcn/ui + Radix UI + Lucide React | Copy-paste Tailwind-native components; no version lock-in; WAI-ARIA accessible out of the box. |
| Forms | React Hook Form 7 + Zod 3 | Performant uncontrolled inputs; Zod schema doubles as TypeScript type and runtime validator. |
| Charts | Chart.js 4 + react-chartjs-2 5 | Already in use; preserving it removes one migration risk vector. Replace post-migration only. |
| OCR | OpenCV.js 4 (WASM, lazy-loaded) | Already in use; load asynchronously to keep main bundle fast (~8MB WASM must not block initial load). |
| Auth | @supabase/supabase-js 2 + Supabase React auth helpers | Google OAuth + email allowlist flow is already working; npm package is API-identical to the CDN version. |
| Backend | Supabase (unchanged) + Cloudflare R2 Worker (unchanged) | No backend changes during migration. |
| Tooling | ESLint 9 + Prettier 3 + Vitest 3 | Hooks linting catches the most common migration bugs; Vitest for pure logic (score calculations, promotion rules). |

**What was ruled out:** Next.js/Remix (no SSR needed), Redux Toolkit (overkill), Axios (native fetch sufficient), MUI/Ant Design/Chakra (conflict with Tailwind), Recharts/Victory (unnecessary chart migration risk), SWR (TanStack Query is more feature-complete for write-heavy ops), @supabase/ssr (designed for server frameworks, not SPAs).

---

## Feature Priorities

### Table Stakes — must exist at parity before any enhancement

| Feature | Complexity | Key Dependency |
|---------|-----------|----------------|
| Admin-only auth (Google OAuth + email allowlist) | Low | Gate for all features |
| Member CRUD (name, job, level, rank, join date) | Low | None |
| Member list with search/filter/sort | Low | Member CRUD |
| Weekly score recording | Low | Member list |
| Score history per member | Low | Score recording |
| Absence / zero-score flagging | Low | Score recording |
| Aggregate weekly summary | Low | Score recording |
| Promotion/demotion thresholds + recommendations | Medium | Score history + rank system |
| Promotion/demotion history log | Low | Rank system |
| Bulletin board (notice + free post) | Low | None |
| Rank/tier system with display and assignment | Low | None |

### Differentiators — what makes this better than a spreadsheet

| Feature | Complexity | Status |
|---------|-----------|--------|
| OCR score import from MapleStory screenshots (OpenCV.js) | High | Already implemented |
| Per-member trend charts + guild participation rate (Chart.js) | Medium | Already implemented |
| Level/job distribution charts | Low–Medium | Already implemented |
| Buddy matching (뚠뚠 버디) with pair history | Medium | Already implemented |
| Guild event calendar with score deadline indicators | Medium | Already implemented |
| Automated reward calculation + reward history | Medium | Already implemented |
| Enhanced stats dashboard (all domains aggregated) | Medium | Planned enhancement |
| Exportable reports (CSV/image for Discord) | Medium | Planned enhancement |
| Dark mode + mobile-responsive layout | Low–Medium | UX polish |

### Anti-Features (deliberately excluded)

Real-time chat/messaging, public member portal, raid/party scheduler, PWA/offline mode, Nexon Open API integration, push notifications, multi-guild/SaaS mode. All excluded due to complexity-to-value ratio or incompatibility with admin-only scope.

---

## Architecture Overview

### Directory Structure (key decisions)

```
src/
  lib/          # External service clients only (supabase.ts, r2.ts, ocr.ts)
  hooks/        # Domain data hooks (useMembers, useScores, usePromotion, etc.)
  store/        # Zustand — UI state only (dark mode, sidebar, toasts)
  pages/        # Route-level components — compose hooks + components, no direct fetching
  components/
    layout/     # AppShell, Sidebar, TopBar
    auth/       # AuthGuard
    <domain>/   # Domain-specific components (members/, scores/, analysis/, etc.)
    ui/         # Reusable primitives with zero domain knowledge
  types/        # Per-domain TypeScript types (generated from Supabase schema)
```

### Layer Boundary Rules

1. **Pages compose, they do not fetch.** All data fetching lives in domain hooks; pages pass data as props.
2. **Hooks talk to `lib/`, not to each other.** Cross-domain needs (e.g., AnalysisPage needing both members and scores) are resolved at the page level by calling two independent hooks.
3. **`lib/supabase.ts` is a singleton.** Creating a second Supabase client instance anywhere silently breaks RLS (returns empty arrays with no error).
4. **OCR is fully isolated.** `lib/ocr.ts` + `OcrUploader` component; OpenCV.js lazy-loaded; nothing else in the app depends on it.
5. **`components/ui/` primitives have zero domain knowledge** — generic props only.

### State Management Split

- **Server data** (members, scores, promotions, board, buddy, calendar): TanStack Query with stable cache keys per domain; mutations call `queryClient.invalidateQueries` on success.
- **UI state** (dark mode, sidebar, toasts): Zustand with `persist` middleware for dark mode.
- **Auth state**: Supabase session in `localStorage`; `useAuth` wraps `onAuthStateChange`; no duplication in Zustand.
- **Form/local state**: `useState` or React Hook Form — never in global store.

---

## Top Risks

1. **Big Bang cutover** — Attempting to migrate everything before any incremental deploy. Every phase must end with a working, deployed URL. Keep the original app live throughout migration for parallel validation.

2. **Losing implicit business logic** — Score calculations (수로 점수), promotion/demotion thresholds (승강 기준), reward formulas, and buddy-matching rules are buried in 11,000 lines. Extract each formula to a pure TypeScript function with explicit inputs/outputs and cross-validate outputs against the original before retiring it. This is the highest-probability source of silent regressions.

3. **Broken Google OAuth + email allowlist** — Auth redirect URIs must be registered in Google Cloud Console and Supabase for all environments (localhost:5173, staging, production) before writing any auth code. The `<AuthGuard>` must suspend rendering until `supabase.auth.getSession()` resolves. The email allowlist check must be enforced in the routing layer, not just as a UI redirect.

4. **Supabase singleton violation causing silent RLS failures** — Multiple `createClient()` calls across components produce independent unauthenticated clients that silently return empty arrays on protected tables. Enforce a single import of `lib/supabase.ts` everywhere; never instantiate inside components or hooks.

5. **OpenCV.js breaking in the Vite/ESM environment** — The original app uses `window.cv` via a CDN `<script>` tag; Vite's module isolation can break this. Prototype the OpenCV.js integration in Phase 1 as a spike before committing to architecture. Fall back to a Web Worker if module system conflicts are intractable.

**Additional risks to watch:**
- Tailwind dark mode must use `class` strategy from day one (CDN original uses class-based toggling; PostCSS default is `media`).
- Chart.js version: pin to the same major version used in the original to avoid v2→v4 API breaks. Always destroy chart instance in `useEffect` cleanup.
- Cloudflare R2 Worker CORS: update allowed origins to include all dev/staging domains before image upload feature work; move auth token to `.env`.
- Scope creep: no new features or design changes during the parity migration. All improvement ideas go to a post-migration backlog.
- Date/time handling: the original almost certainly assumes KST (UTC+9). Make timezone explicit in a utility function from day one; use `date-fns` rather than raw `Date` manipulation.

---

## Recommended Build Order

| Phase | Deliverable | Gate / Validation |
|-------|-------------|-------------------|
| **Phase 1 — Foundation** | Vite + React + TS + Tailwind scaffold; `lib/supabase.ts` singleton; `lib/r2.ts`; Google OAuth auth end-to-end with email allowlist; AppShell + Sidebar + React Router; Zustand store; OpenCV.js spike | Can log in, see empty shell, dark mode works, OCR WASM loads, R2 CORS validated |
| **Phase 2 — Members** | `types/member.ts` (from generated schema); `useMembers` hook; MembersPage + MemberTable, MemberForm, MemberCard | Full member CRUD works against live Supabase |
| **Phase 3 — Scores** | `types/score.ts`; `useScores` hook; ScoresPage + WeekSelector, ScoreTable, ScoreInput (manual only) | Weekly scores can be entered and viewed |
| **Phase 4 — Analysis** | AnalysisPage + StatsOverview, ScoreChart, DistributionChart, RewardCalculator (Chart.js validated) | Charts render from live data; reward calculations match existing logic |
| **Phase 5 — Promotion** | `types/promotion.ts`; `usePromotion` hook; PromotionPage + PromotionRules, PromotionHistory, TierBadge | Promotion/demotion history viewable; rules configurable |
| **Phase 6 — Board** | `types/board.ts`; `useBoard` hook; BoardPage + PostList, PostDetail, PostEditor (with R2 image uploads) | Posts can be created, read, and deleted; images attach correctly |
| **Phase 7 — Buddy Matching** | `types/buddy.ts`; `useBuddy` hook; BuddyPage + BuddyList, MatchCard | Buddy pairs viewable and manageable |
| **Phase 8 — Calendar** | `types/calendar.ts`; `useCalendar` hook; CalendarPage + CalendarGrid, EventForm | Events can be created and displayed |
| **Phase 9 — OCR** | `lib/ocr.ts` OpenCV.js wrapper; OcrUploader integrated into ScoresPage | Screenshot upload extracts scores and pre-fills input form |
| **Phase 10 — Polish** | Mobile responsive audit; error boundaries per page; UI primitive hardening; code-splitting verification | All pages pass mobile viewport check; no 404 on hard refresh (SPA fallback configured) |

**Rationale for sequence:** Auth gates everything; Members are required by Scores, Analysis, Promotion, and Buddy; Scores are required by Analysis, Promotion, and OCR. Board and Calendar have no domain dependencies and can be parallelized after Phase 1. OCR slots into the Scores page after the manual entry flow is stable. The enhanced stats dashboard (Phase 10+) aggregates all domains and is correctly deferred until parity is confirmed.

---

## Key Insights

**Cross-cutting findings synthesized across all four research areas:**

1. **The backend is the stable foundation.** Supabase and the Cloudflare R2 Worker are not changing. Every architectural decision should minimize the surface area that touches the backend during migration. The Supabase client singleton rule is the single most important structural constraint in the codebase.

2. **Type generation is the migration safety net.** Running `supabase gen types typescript` before writing any component or hook is the highest-leverage action in the project. It converts the entire Supabase schema into compile-time checks, catching row-level mismatches that would otherwise surface as silent runtime bugs in a 14-feature migration.

3. **OpenCV.js is the highest-risk external dependency.** It is the only library with a non-trivial Vite/ESM integration challenge. It should be spiked in Phase 1 even though the OCR feature is not built until Phase 9. Discovering a fundamental incompatibility in Phase 9 would require architectural backtracking.

4. **Implicit business logic is the highest-probability regression source.** Score formulas, promotion thresholds, reward calculations, and buddy-matching rules are not UI concerns — they are domain logic buried across 11,000 lines of imperative code. They must be extracted to pure, tested TypeScript functions before any UI is built around them. This is the work most likely to be skipped under schedule pressure and the work most likely to produce user-visible errors.

5. **TanStack Query eliminates the most code.** The original monolith contains dozens of `fetch` + `useEffect` + `useState` + manual re-render patterns per feature. TanStack Query's `useQuery`/`useMutation` with shared cache keys replaces all of them uniformly. The migration is an opportunity to establish this pattern once and enforce it across all 14 features, preventing the state fragmentation pitfall.

6. **Incremental deployment is non-negotiable.** With active users and a live production system, the migration risk is not primarily technical — it is operational. Every phase must produce a deployable, testable build. The original app must remain live for parallel validation throughout. The phase gate criteria in the build order are not optional milestones; they are the mechanism that keeps the migration from becoming a big-bang rewrite.

7. **The feature scope is intentionally frozen during migration.** The stats dashboard enhancement, Nexon API integration, exportable reports, and other improvements are explicitly post-parity work. The discipline of logging ideas to a backlog rather than building them during migration is what makes the 1:1 parity goal achievable on a predictable timeline.
