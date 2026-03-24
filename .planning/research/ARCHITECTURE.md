# Architecture Research

> Context: Migrating 뚠카롱 길드 관리 시스템 from a 740KB monolithic `index.html` (11,000 lines) to a React + Vite SPA. Backend (Supabase, Cloudflare R2 Worker) stays unchanged. All existing features must migrate 1:1.

---

## Recommended Structure

```
guild-manager/
├── index.html                    # Vite entry point
├── vite.config.ts
├── tailwind.config.ts
├── src/
│   ├── main.tsx                  # React root, Supabase client init
│   ├── App.tsx                   # Router shell, auth gate
│   │
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client singleton
│   │   ├── r2.ts                 # Cloudflare R2 Worker client
│   │   └── ocr.ts                # OpenCV.js wrapper / OCR logic
│   │
│   ├── hooks/
│   │   ├── useAuth.ts            # Google OAuth + allowlist check
│   │   ├── useMembers.ts         # Guild member CRUD
│   │   ├── useScores.ts          # Weekly score records
│   │   ├── usePromotion.ts       # Promotion/demotion logic
│   │   ├── useBuddy.ts           # Buddy matching
│   │   ├── useCalendar.ts        # Events / schedule
│   │   └── useBoard.ts           # Board posts
│   │
│   ├── store/
│   │   └── index.ts              # Zustand store (global UI state only)
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── MembersPage.tsx
│   │   ├── ScoresPage.tsx
│   │   ├── AnalysisPage.tsx
│   │   ├── PromotionPage.tsx
│   │   ├── BoardPage.tsx
│   │   ├── BuddyPage.tsx
│   │   └── CalendarPage.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # Sidebar + top bar + content area
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   │
│   │   ├── auth/
│   │   │   └── AuthGuard.tsx     # Redirects unauthenticated users
│   │   │
│   │   ├── members/
│   │   │   ├── MemberTable.tsx
│   │   │   ├── MemberForm.tsx
│   │   │   └── MemberCard.tsx
│   │   │
│   │   ├── scores/
│   │   │   ├── ScoreInput.tsx    # Manual entry + OCR trigger
│   │   │   ├── WeekSelector.tsx
│   │   │   ├── ScoreTable.tsx
│   │   │   └── OcrUploader.tsx   # Image upload → OpenCV.js pipeline
│   │   │
│   │   ├── analysis/
│   │   │   ├── StatsOverview.tsx
│   │   │   ├── ScoreChart.tsx    # Chart.js wrapper
│   │   │   ├── DistributionChart.tsx
│   │   │   └── RewardCalculator.tsx
│   │   │
│   │   ├── promotion/
│   │   │   ├── PromotionRules.tsx
│   │   │   ├── PromotionHistory.tsx
│   │   │   └── TierBadge.tsx
│   │   │
│   │   ├── board/
│   │   │   ├── PostList.tsx
│   │   │   ├── PostDetail.tsx
│   │   │   └── PostEditor.tsx
│   │   │
│   │   ├── buddy/
│   │   │   ├── BuddyList.tsx
│   │   │   └── MatchCard.tsx
│   │   │
│   │   ├── calendar/
│   │   │   ├── CalendarGrid.tsx
│   │   │   └── EventForm.tsx
│   │   │
│   │   └── ui/
│   │       ├── Modal.tsx
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Badge.tsx
│   │       ├── Spinner.tsx
│   │       ├── DarkModeToggle.tsx
│   │       └── Toast.tsx
│   │
│   └── types/
│       ├── member.ts
│       ├── score.ts
│       ├── promotion.ts
│       ├── board.ts
│       ├── buddy.ts
│       └── calendar.ts
```

---

## Component Boundaries

### Layer responsibilities

| Layer | Owns | Does NOT own |
|-------|------|-------------|
| `lib/` | External service clients (Supabase, R2, OpenCV) | React state, UI |
| `hooks/` | Data fetching, mutations, derived state per domain | Rendering, routing |
| `store/` | Cross-cutting UI state (dark mode, toast queue, sidebar open) | Server data |
| `components/ui/` | Reusable primitives | Domain logic |
| `components/<domain>/` | Domain-specific rendering | Fetching data directly |
| `pages/` | Route-level composition | Business logic |
| `App.tsx` | Routing, auth gate | Data |

### Key boundary rules

1. **Pages compose, they do not fetch.** Pages import domain hooks and pass data down to components as props. Components are dumb about data origin.
2. **Hooks talk to `lib/`, not to each other.** Cross-domain dependencies (e.g., AnalysisPage needs both members and scores) are resolved at the page level by calling two independent hooks.
3. **`lib/supabase.ts` is the single Supabase client.** Never create a second client instance anywhere else.
4. **OCR is isolated in `lib/ocr.ts` + `OcrUploader` component.** OpenCV.js loads lazily; nothing else in the app imports or depends on it.
5. **`components/ui/`** primitives have zero domain knowledge. They accept only generic props (children, onClick, variant, etc.).

### Who talks to whom

```
LoginPage
  └─ useAuth ──────────────────────────── lib/supabase (OAuth)

AppShell / Sidebar / TopBar
  └─ store (darkMode, sidebar state)

MembersPage
  └─ useMembers ───────────────────────── lib/supabase (members table)
       └─ MemberTable, MemberForm, MemberCard

ScoresPage
  ├─ useScores ────────────────────────── lib/supabase (scores table)
  ├─ useMembers (read-only, for names)
  └─ OcrUploader ──────────────────────── lib/ocr → lib/r2 (image upload)

AnalysisPage
  ├─ useScores
  ├─ useMembers
  └─ ScoreChart, DistributionChart ─────── (Chart.js, no external calls)

PromotionPage
  ├─ usePromotion ─────────────────────── lib/supabase (promotion table)
  └─ useMembers (read-only)

BoardPage
  └─ useBoard ─────────────────────────── lib/supabase (board table)
       └─ PostEditor ──────────────────── lib/r2 (image attachments)

BuddyPage
  └─ useBuddy ─────────────────────────── lib/supabase (buddy table)
       └─ useMembers (read-only)

CalendarPage
  └─ useCalendar ──────────────────────── lib/supabase (events table)
```

---

## Data Flow

### General pattern (server data)

```
Supabase DB
    │
    ▼
lib/supabase.ts  (raw query)
    │
    ▼
hooks/use<Domain>.ts  (React Query or SWR: fetch, cache, mutations)
    │
    ▼
Page component  (destructures data, loading, error)
    │
    ▼
Domain component  (renders, emits callbacks)
    │  (user action)
    ▼
hook mutation fn  (optimistic update → Supabase → revalidate)
    │
    ▼
UI reflects updated server state
```

### Auth flow

```
App.tsx loads
    │
    ├─ Supabase restores session from localStorage
    │
    ▼
useAuth checks session + allowlist email
    │
    ├─ Authenticated → render AppShell + routes
    └─ Not authenticated → redirect to LoginPage
                              │
                              └─ Google OAuth popup
                                      │
                                      ▼
                                 Supabase callback
                                      │
                                      ▼
                                 Allowlist check
                                      │
                                 ┌────┴────┐
                              Allowed   Denied
                                 │         └─ signOut + error toast
                                 ▼
                              App loads
```

### OCR flow (isolated)

```
User selects screenshot
    │
    ▼
OcrUploader → lib/r2.ts → Cloudflare R2 Worker (stores image)
    │
    ▼
lib/ocr.ts → OpenCV.js (lazy-loaded WASM) → extracted score values
    │
    ▼
ScoreInput pre-filled with OCR result
    │
    ▼
User confirms → useScores.addScore() → Supabase
```

### Global UI state flow

```
DarkModeToggle / sidebar toggle
    │
    ▼
Zustand store (persisted to localStorage)
    │
    ▼
AppShell reads store → applies Tailwind dark class to root
```

---

## State Management

### Approach: React Query (TanStack Query) for server state + Zustand for UI state

**Server state** (members, scores, promotions, board, buddy, calendar):
- Managed by **TanStack Query** (`useQuery` / `useMutation`).
- Rationale: automatic caching, background revalidation, optimistic updates, and loading/error states out of the box — directly replacing the manual fetch + re-render pattern in the current monolith.
- Each domain hook wraps one or more `useQuery` calls with a stable query key (e.g., `['scores', weekId]`).
- Mutations call `queryClient.invalidateQueries` on success to keep cache consistent.

**UI state** (dark mode, sidebar open/closed, toast notifications):
- Managed by **Zustand** with `persist` middleware for dark mode.
- Rationale: lightweight (no boilerplate), no Provider wrapping needed, and the only true "global" state in this app is cosmetic/session UI — not domain data.

**Local component state** (`useState`):
- Form field values, modal open/close within a single component tree, pagination cursor.

**Auth state**:
- Supabase's own session stored in `localStorage` (default). `useAuth` hook wraps `supabase.auth.getSession()` and `onAuthStateChange` listener. No duplication in Zustand.

### What NOT to put in global state
- Server/database data — belongs in React Query cache only.
- Form state — local `useState` or `react-hook-form`.
- Per-page filter/sort state — local `useState` in the page component.

---

## Build Order

Build in dependency order: lower layers before higher layers. Each phase is independently deployable.

### Phase 1 — Foundation (no features yet)
1. Vite + React + TypeScript + Tailwind project scaffold
2. `lib/supabase.ts` — client singleton, verify connection to existing DB
3. `lib/r2.ts` — R2 Worker client (copy existing fetch logic)
4. Auth: `useAuth`, `AuthGuard`, `LoginPage` — Google OAuth end-to-end
5. `AppShell`, `Sidebar`, `TopBar` — layout shell with routing (React Router)
6. Zustand store — dark mode, sidebar, toast

**Gate:** Can log in, see empty shell, dark mode works.

### Phase 2 — Core data layer (most features depend on members)
7. `types/member.ts` + `useMembers` hook
8. `MembersPage` + `MemberTable`, `MemberForm`, `MemberCard`

**Gate:** Full member CRUD works against live Supabase.

### Phase 3 — Scores (depends on members for display names)
9. `types/score.ts` + `useScores` hook
10. `ScoresPage` + `WeekSelector`, `ScoreTable`, `ScoreInput` (manual entry only)

**Gate:** Weekly scores can be entered and viewed.

### Phase 4 — Analysis (depends on scores + members)
11. `AnalysisPage` + `StatsOverview`, `ScoreChart` (Chart.js), `DistributionChart`, `RewardCalculator`

**Gate:** Charts render from live data; reward calculations match existing logic.

### Phase 5 — Promotion (depends on members + scores)
12. `types/promotion.ts` + `usePromotion` hook
13. `PromotionPage` + `PromotionRules`, `PromotionHistory`, `TierBadge`

**Gate:** Promotion/demotion history viewable; rules configurable.

### Phase 6 — Board (independent of member/score domain)
14. `types/board.ts` + `useBoard` hook
15. `BoardPage` + `PostList`, `PostDetail`, `PostEditor`

**Gate:** Posts can be created, read, and deleted.

### Phase 7 — Buddy matching (depends on members)
16. `types/buddy.ts` + `useBuddy` hook
17. `BuddyPage` + `BuddyList`, `MatchCard`

**Gate:** Buddy pairs viewable and manageable.

### Phase 8 — Calendar (independent)
18. `types/calendar.ts` + `useCalendar` hook
19. `CalendarPage` + `CalendarGrid`, `EventForm`

**Gate:** Events can be created and displayed on calendar.

### Phase 9 — OCR (isolated, can be done any time after Phase 3)
20. `lib/ocr.ts` — OpenCV.js lazy-load wrapper
21. `OcrUploader` component integrated into `ScoresPage`

**Gate:** Screenshot upload extracts scores and pre-fills input form.

### Phase 10 — Polish
22. Mobile responsive audit across all pages
23. `components/ui/` primitives hardened (Modal, Toast, Spinner, Badge)
24. Error boundaries per page
25. Code-splitting verification (each page chunk loads independently)

---

## Dependency Summary

```
Foundation (Auth + Shell + Store)
    └─ Members
         ├─ Scores
         │    ├─ Analysis
         │    ├─ Promotion
         │    └─ OCR (Phase 9, slots into Scores page)
         └─ Buddy
Board (independent)
Calendar (independent)
```

Board and Calendar have no dependencies on other domain modules and can be built in parallel with any phase after Foundation.
