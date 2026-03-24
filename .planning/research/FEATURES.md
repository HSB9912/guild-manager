# Features Research

> Context: MapleStory MMORPG guild management (뚠카롱 길드). Admin-only web app.
> Migration from 740KB monolithic HTML → React + Vite SPA. All existing features must be preserved 1:1.

---

## Table Stakes

Features that guild admins take for granted. Absence causes immediate distrust or abandonment.

### Member Management
- **Member CRUD** — Add, edit, remove members with character name, job class, level, rank, join date.
  Complexity: Low. No dependencies.
- **Member list with search/filter** — Filter by rank, job class, level range. Sort by any column.
  Complexity: Low. Depends on: Member data model.
- **Member profile page** — Individual view of all data for one member (scores, history, rank).
  Complexity: Low–Medium. Depends on: Member CRUD, Score tracking.
- **Rank/tier system** — Guild ranks (e.g., 마스터, 부마스터, 길드원) with display and assignment.
  Complexity: Low. No dependencies.

### Activity / Score Tracking
- **Weekly score recording** — Manually enter scores per member per week (수로 점수).
  Complexity: Low. Depends on: Member list.
- **Score history per member** — View a member's score across all recorded weeks.
  Complexity: Low. Depends on: Score recording.
- **Aggregate weekly summary** — Total scores for a given week across all members.
  Complexity: Low. Depends on: Score recording.
- **Absence / zero-score flagging** — Identify members who submitted no activity this week.
  Complexity: Low. Depends on: Score recording.

### Promotion / Demotion System (승강제)
- **Configurable thresholds** — Define score cutoffs that trigger promotion or demotion.
  Complexity: Low–Medium. Depends on: Score tracking.
- **Promotion/demotion recommendations** — Auto-compute who qualifies based on thresholds.
  Complexity: Medium. Depends on: Thresholds, Score history.
- **History log** — Record of every rank change with date and reason.
  Complexity: Low. Depends on: Rank system.

### Communication
- **Bulletin board (게시판)** — Post notices and general posts. Read by admin and viewable to guild members.
  Complexity: Low. No dependencies.
- **Notice vs. free post separation** — Distinguish pinned announcements from regular posts.
  Complexity: Low. Depends on: Bulletin board.

### Authentication
- **Admin-only access** — Only approved Google accounts can log in. No self-registration.
  Complexity: Low. Depends on: Google OAuth + Supabase Auth allowlist.

---

## Differentiators

Features that set this system apart from a shared spreadsheet or a generic guild tool.

### OCR Score Import (현재 구현됨)
- **Screenshot → score extraction** — Paste or upload a MapleStory in-game screenshot; OpenCV.js parses the score table automatically.
  Complexity: High. Depends on: Score recording pipeline, image hosting (Cloudflare R2).
  Why differentiating: Eliminates manual transcription — the single biggest pain point for weekly score entry. No competing free tool does this for MapleStory.

### Analytics & Charts (현재 구현됨)
- **Per-member trend chart** — Score over time as a line/bar chart (Chart.js).
  Complexity: Medium. Depends on: Score history.
- **Guild-wide participation rate** — % of members who hit the activity threshold each week.
  Complexity: Medium. Depends on: Score history, threshold config.
- **Level & job class distribution** — Visual breakdown of the guild's composition.
  Complexity: Low–Medium. Depends on: Member data.
- **Score ranking leaderboard** — Weekly and cumulative top-N by score.
  Complexity: Low. Depends on: Score history.

### Buddy Matching (뚠뚠 버디, 현재 구현됨)
- **Algorithmic pairing** — Match members into buddy pairs for in-game cooperative content, considering schedule or level compatibility.
  Complexity: Medium. Depends on: Member list, optionally Calendar.
- **Pair history** — Track which members have been paired previously to avoid repeats.
  Complexity: Low. Depends on: Buddy matching.

### Calendar / Event Scheduling (현재 구현됨)
- **Guild event calendar** — Weekly and monthly view of guild events, raids, deadlines.
  Complexity: Medium. No hard dependencies, but integrates with Bulletin board for announcements.
- **Score submission deadline reminders** — Visual indicator on calendar when weekly score window closes.
  Complexity: Low. Depends on: Calendar, Score tracking.

### Reward Calculation (현재 구현됨)
- **Automated reward allocation** — Compute each member's reward share based on score, rank, or custom formula.
  Complexity: Medium. Depends on: Score history, Rank system.
- **Reward history log** — Per-member record of rewards distributed.
  Complexity: Low. Depends on: Reward calculation.

### Stats Dashboard (강화 예정)
- **Enhanced overview dashboard** — Single-page summary: active members, this week's scores, upcoming events, recent promotions.
  Complexity: Medium. Depends on: All data domains (members, scores, calendar, promotions).
- **Exportable reports** — Download weekly summary as CSV or image for posting in Discord.
  Complexity: Medium. Depends on: Score history, analytics.

### UX Polish
- **Dark mode** — System-aware or manually toggled.
  Complexity: Low. No dependencies.
- **Mobile-responsive layout** — Full usability on phone for in-game admin actions.
  Complexity: Low–Medium. No hard dependencies; requires disciplined Tailwind layout.
- **Image uploads (Cloudflare R2)** — Attach images to bulletin posts or member profiles.
  Complexity: Low (infrastructure already in place). Depends on: R2 Worker.

---

## Anti-Features

Things deliberately NOT built in the current milestone, with justification.

### Real-time Chat / Messaging
- Why not: Guild chat already exists inside MapleStory and in KakaoTalk/Discord. Building a competing chat creates a fragmentation problem — members won't switch. High complexity (WebSockets, presence, moderation) for near-zero adoption.
- Status: Out of scope. Revisit only if guild explicitly requests in-system messaging separate from Discord.

### Public-facing Member Portal / Self-service
- Why not: This is an admin tool. Exposing a member-facing portal doubles the access-control surface, requires UX for non-admins, and risks leaking internal scoring politics. Current model (admin enters data, posts notices on bulletin board) is intentional.
- Status: Out of scope indefinitely unless the guild's operational model changes.

### Boss Raid / Party Composition Scheduler
- Why not: Raid scheduling tools (e.g., WhenToRaid, guild Discord bots) already do this well. The overlap with the existing calendar is minor. Building a full raid scheduler is a separate product scope.
- Status: Out of scope. A simple calendar event entry covers the minimum need.

### PWA / Offline Mode
- Why not: Admin use case is always online (score entry requires Supabase writes; OCR requires processing pipeline). Offline mode adds service-worker complexity with almost no benefit for this specific workflow.
- Status: Out of scope. Revisit after migration stabilizes.

### In-game API Integration (Nexon Open API)
- Why not: Nexon's MapleStory API provides character lookup (level, job, popularity). Attractive in theory, but API rate limits, maintenance burden when Nexon changes endpoints, and the fact that OCR already solves the score-entry problem make this low ROI. Manual CRUD is fast enough given guild size.
- Status: Out of scope for migration. Optional enhancement post-stabilization.

### Automated Notifications / Push Alerts
- Why not: Requires either a backend cron job + email/push service, or a Discord bot integration. Both are significant infrastructure additions. The bulletin board + calendar covers the communication need adequately.
- Status: Out of scope. Discord webhook for announcements is the lighter-weight path if ever needed.

### Multi-guild / SaaS Mode
- Why not: This is explicitly built for 뚠카롱 guild. Generalizing to a SaaS product changes the product's identity, adds tenant isolation complexity, and is outside the stated purpose.
- Status: Out of scope permanently unless project goals change fundamentally.

---

## Feature Dependencies

A map of what must exist before another feature can be built.

```
Google OAuth + Supabase Auth allowlist
  └── All features (gate)

Member CRUD
  ├── Member list / search / filter
  ├── Member profile page
  ├── Score recording
  ├── Buddy matching
  └── Guild stats (level/job distribution)

Score recording (weekly)
  ├── Score history per member
  │     ├── Per-member trend chart
  │     ├── Score ranking leaderboard
  │     ├── Guild participation rate
  │     └── Promotion/demotion recommendations
  ├── Absence / zero-score flagging
  ├── Reward calculation
  │     └── Reward history log
  └── Score submission deadline (→ Calendar)

Rank/tier system
  ├── Promotion/demotion history log
  ├── Promotion/demotion recommendations (+ Score history)
  └── Reward calculation (rank weighting)

Bulletin board
  └── Notice vs. free post separation
  └── Image uploads (Cloudflare R2 Worker)

Calendar
  ├── Score submission deadline display
  └── Buddy matching (optional: schedule-aware pairing)

OCR screenshot recognition
  └── Score recording pipeline (writes into same model)

Stats Dashboard (enhanced)
  ├── Member CRUD (composition data)
  ├── Score history (activity data)
  ├── Calendar (upcoming events)
  └── Promotion history (recent changes)
```

### Critical Path for Migration

The following sequence respects dependencies and delivers usable value at each step:

1. Auth (gate for everything)
2. Member CRUD + list
3. Score recording + history
4. Promotion system (thresholds + recommendations + history)
5. Bulletin board + Calendar
6. Analytics / charts
7. Buddy matching
8. Reward calculation
9. OCR import
10. Stats dashboard (enhanced — aggregates all above)

---

*Research date: 2026-03-24*
*Scope: MapleStory MMORPG guild management, admin-only, brownfield React migration*
