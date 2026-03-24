# 뚠카롱 길드 관리 시스템

## What This Is

메이플스토리 "뚠카롱" 길드의 운영을 위한 관리 시스템. 길드원 관리, 수로 점수 추적/분석, 승강제 운영, 게시판, 캘린더, 버디 매칭 등을 제공하는 관리자 전용 웹 애플리케이션이다. 현재 740KB 단일 HTML 파일로 되어 있으며, React + Vite SPA로 전면 재구축한다.

## Core Value

길드 운영에 필요한 모든 데이터(길드원, 수로 점수, 승강, 일정)를 한곳에서 빠르고 정확하게 관리할 수 있어야 한다.

## Requirements

### Validated

- ✓ Google OAuth 관리자 인증 — existing
- ✓ 길드원 CRUD (추가/수정/삭제/목록) — existing
- ✓ 수로 점수 기록 및 주차별 관리 — existing
- ✓ 수로 분석 (개인별/전체 통계, 차트) — existing
- ✓ 승강제 운영 (승급/강등 기준, 이력) — existing
- ✓ 길드 현황 통계 (레벨 분포, 직업 분포 등) — existing
- ✓ 수로 보상 계산 — existing
- ✓ 게시판 (공지/자유 글 작성/조회) — existing
- ✓ 뚠뚠 버디 매칭 시스템 — existing
- ✓ 캘린더/일정 관리 — existing
- ✓ OCR 스크린샷 점수 인식 — existing
- ✓ 다크모드 — existing
- ✓ 모바일 반응형 UI — existing
- ✓ Cloudflare R2 이미지 업로드 — existing

### Active

- [ ] React + Vite SPA로 전면 구조 전환
- [ ] 컴포넌트 기반 아키텍처로 재설계
- [ ] 페이지별 코드 분할 (라우팅)
- [ ] 통계 대시보드 강화
- [ ] 기존 모든 기능 1:1 마이그레이션

### Out of Scope

- 실시간 알림/채팅 — 향후 추가 예정
- 보스 레이드 스케줄링 — 향후 추가 예정
- PWA (오프라인/설치) — 향후 추가 예정

## Context

- 현재 단일 `index.html` (740KB, 11,000줄)에 HTML + CSS + JS 전부 포함
- 백엔드: Supabase (DB + Auth), Cloudflare R2 Worker (이미지)
- 스타일: Tailwind CSS (CDN), Font Awesome 아이콘
- 차트: Chart.js
- OCR: OpenCV.js 기반 클라이언트 사이드 처리
- 인증: Google OAuth → Supabase Auth → 허용 이메일 체크
- 기존 사용자가 있으므로 기능 동작은 100% 호환 유지 필요

## Constraints

- **Tech Stack**: React + Vite + Tailwind CSS — 기존 스타일 재활용 및 생태계 호환
- **Backend**: Supabase 유지 — DB 스키마/API 변경 최소화
- **Infra**: Cloudflare R2 Worker 유지 — 이미지 프록시 로직 동일
- **Compatibility**: 기존 Supabase 데이터와 100% 호환
- **Auth**: Google OAuth 유지

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + Vite SPA 선택 | SSR 불필요(관리자 전용), 가볍고 빠른 개발, Supabase/Tailwind 연동 용이 | — Pending |
| 프레임워크 없이 바닐라 분리 대신 React 선택 | 11,000줄 규모에서 컴포넌트 기반이 유지보수에 압도적 우위 | — Pending |
| 기존 기능 1:1 마이그레이션 우선 | 사용자 영향 최소화, 구조 전환에 집중 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-24 after initialization*
