# 🔑 버니 길드 관리 — 관리자 인수인계

> 사이트: https://hsb9912.github.io/guild-manager/
> 이 문서는 **소유권/계정 이관용**. 코드 수정 방법은 [WORKLOG.md](WORKLOG.md) 참고.
> ⚠️ **이 문서에 비밀번호·키 값은 적지 않는다.** (공개 저장소) 값은 별도로 직접 전달.

---

## 1. 지금 뭐가 누구 것인가 (의존 서비스 전수)

| # | 서비스 | 현재 소유 | 사이트에서 하는 일 | 끊기면 |
|---|--------|----------|------------------|--------|
| 1 | **GitHub** `hsb9912/guild-manager` | 개인 계정 HSB9912 | 코드 저장 + **Pages 호스팅(사이트 그 자체)** | 사이트 전체 다운 |
| 2 | **Supabase** 프로젝트 `luglshrfkkeacmefnvlm` | 개인 계정 | DB(길드원·수로점수·보석금·할일) + **구글 로그인** | 데이터 전멸 = 사실상 서비스 종료 |
| 3 | **Cloudflare** (`*.hongsb9912.workers.dev`) | 개인 계정 | Workers 3종 + **R2 이미지 저장소** | 보석금 인증샷·가이드 이미지 전부 깨짐, 부캐조회·디스코드 알림 정지 |
| 4 | **넥슨 Open API 키** | 개인 넥슨 계정 | 동기화(길드원 명단·레벨·직업), 닉변 감지, 계정그룹 | 동기화 기능 정지 |
| 5 | **디스코드 웹훅** | 길드 디스코드 | 보석금 신청 알림 | 알림만 정지 (나머지 정상) |
| 6 | **구글 OAuth** | Supabase Auth 설정 | 운영진 로그인 | 운영진 로그인 불가 |
| 7 | ~~maplelens OCR~~ | **제3자(peune)** | 수로 OCR 인식 | 이관 불가. 끊기면 OCR만 죽음(수동입력은 정상) |

### Cloudflare 세부 (가장 까다로움)
- Workers: `guild-images`(R2 업로드) · `guild-bail-notify`(디스코드 알림) · `guild-meaegi-proxy`(부캐 조회)
- R2 버킷: `bail-images`(보석금 인증샷) · `guide-images`(가이드/버디 이미지)
- 공개 URL: `pub-ee3a7d1dfe0a442b96336f0c81289a46.r2.dev`

---

## 2. 이관 전략 — **GitHub Organization 권장**

개인 계정 → 개인 계정으로 넘기면 **사이트 주소가 바뀐다.**
`hsb9912.github.io/...` → `새주인.github.io/...` (모든 링크·즐겨찾기 깨짐, 다음 인수인계 때 또 바뀜)

**Organization(무료)을 만들어 리포를 옮기면** 주소가 `조직이름.github.io/guild-manager`로 **한 번만** 바뀌고,
이후 관리자 교체는 **조직 소유자만 바꾸면 끝** — 주소도 안 바뀌고 재이관도 불필요.

```
[권장]  개인 HSB9912  ──리포 이전──▶  Organization (예: bunny-guild)
                                       소유자: 나 + 새 관리자
                                       → 인계 끝나면 나만 빠짐
```

---

## 3. 이관 순서 (이 순서대로)

### STEP 1. GitHub — 조직 생성 + 리포 이전
1. https://github.com/organizations/new → **Free** 플랜, 조직명 정하기(예: `bunny-guild`)
2. 새 관리자를 조직에 초대 → **Owner** 권한 부여 (Organization → People → Invite member)
3. 리포 이전: `hsb9912/guild-manager` → Settings → General → 맨 아래 **Danger Zone → Transfer ownership** → 조직 선택
4. Pages 재확인: 이전된 리포 → Settings → Pages → Source `main` / `/ (root)` 인지 확인
5. **새 주소로 접속 테스트** 후 길드원에게 공지 (기존 주소는 리다이렉트가 보장되지 않음)

### STEP 2. Supabase — 프로젝트 이관
1. 새 관리자가 Supabase 가입 → 조직(Organization) 생성
2. 기존 프로젝트 → **Project Settings → General → Transfer project** → 새 조직 선택
   - 무료 플랜 조직당 프로젝트 2개 제한이니 새 조직이 비어 있어야 함
   - *이관이 막히면 대안:* 기존 조직에 새 관리자를 **Owner로 초대**하고 내가 나가기
3. 이관 후 **Project URL·anon key가 그대로인지 확인** (바뀌면 `assets/app.js` 상단 `BACKEND` 수정 필요)
4. 운영진 로그인 확인: Authentication → Providers → **Google** 설정 유지되는지, 자체 Google Cloud 클라이언트를 쓴다면 그 프로젝트도 이관 대상

### STEP 3. Cloudflare — ⚠️ 여기가 제일 위험
**주의: 워커/R2를 새 계정에 재배포하면 URL이 바뀌고, DB에 저장된 보석금 인증샷 100여 건 링크가 전부 깨진다.**

- **[안전] 방법 A — 계정 접근권 넘기기 (권장)**
  Cloudflare → Manage Account → **Members → Invite** 로 새 관리자를 **Super Administrator**로 추가
  → 확인 후 내가 탈퇴. URL 그대로라 아무것도 안 깨짐.
  (이 Cloudflare 계정을 개인 용도로도 쓰고 있다면 이 방법은 부적합 → 방법 B)

- **[대공사] 방법 B — 새 계정에 재배포**
  1. 워커 3종 소스 받아서 새 계정에 배포 → 새 URL 3개
  2. `assets/app.js`의 `BAIL_MEAEGI_URL` · `BAIL_R2.worker` · `BAIL_NOTIFY_URL` 교체
  3. R2 버킷 2개 **파일 전부 복사** + 새 공개 URL 발급
  4. **DB 일괄 치환**: `bail_requests.proof_image_url`, 가이드/버디 이미지 URL의 옛 도메인 → 새 도메인
  5. 워커 시크릿(디스코드 웹훅, R2 API 키) 새로 설정

### STEP 4. 넥슨 API 키 교체
1. 새 관리자가 https://openapi.nexon.com/ko/my-application 에서 **본인 키 발급**
2. 사이트 → **동기화** 페이지 → 키 입력칸에 저장 (브라우저 localStorage에 저장됨)
3. `assets/app.js`의 `_bunnyDefKey()` — **내 넥슨 키가 난독화되어 박혀 있음.** 새 키로 교체하거나 함수를 지워야 함
   (안 지우면 내 넥슨 계정 키가 계속 쓰임 → 반드시 처리)

### STEP 5. 디스코드 웹훅
- 알림 채널에서 **새 웹훅 생성** → `guild-bail-notify` 워커의 시크릿(웹훅 URL) 교체 → 옛 웹훅 삭제
- 멘션 역할 ID는 `app.js` `_bailNotifyDiscord()`에 하드코딩 — 역할 바뀌면 같이 수정

### STEP 6. 앱 내부 권한
- **운영진 계정**: Supabase `admin_whitelist` 테이블에 새 관리자 구글 이메일 추가(`status = approved`), 내 이메일 삭제
- 사이트에서 구글 로그인 → 사이드바에 "관리자 운영" 메뉴 보이면 성공

---

## 4. 이관 후 검증 체크리스트

- [ ] 새 주소로 사이트 열림 (길드원·수로 분석 데이터 보임)
- [ ] 새 관리자 구글 로그인 → 관리자 메뉴 보임 / 내 계정은 안 보임
- [ ] **동기화** 실행됨 (넥슨 키 정상)
- [ ] **보석금 신청** 폼: 본캐 검색 → 스샷 업로드 → 제출 (R2 정상)
- [ ] 신청 처리 → 보석금 탭: **과거 인증샷 이미지가 보임** (R2 링크 안 깨짐)
- [ ] 디스코드 알림 도착
- [ ] 새 관리자가 코드 수정 → push → 배포 반영 (아래 5번)
- [ ] 백업 1회: `node tools/db-snapshot.js`

---

## 5. 새 관리자가 알아야 할 "수정 방법" 요약

자세한 건 **[WORKLOG.md](WORKLOG.md)** — 아래는 핵심만.

```bash
git clone https://github.com/<새조직>/guild-manager.git
cd guild-manager
# 수정 후
node --check assets/app.js      # 문법 검사
node tools/smoke.js             # 배포 전 데이터 검증
git add -u && git commit -m "..." && git push   # push하면 1~2분 뒤 자동 배포
```

**꼭 지킬 3가지**
1. `assets/app.js` 나 `assets/bunny.css` 를 고쳤으면 → **모든 `*.html`의 `?v=날짜코드` 를 일괄 bump**
   (안 올리면 사용자 브라우저가 옛 파일을 캐시해서 수정이 반영 안 됨)
2. 사용자가 체감하는 변경이면 → `app.js` 상단 `CHANGELOG` 배열 맨 위에 한 줄 추가
3. DB 지우거나 대량 수정 전 → `node tools/db-snapshot.js` 로 백업

**구조**: 각 `*.html`은 껍데기, 실제 화면은 전부 `assets/app.js` 한 파일(약 5천 줄)의 `PAGES[키]` 함수가 그림.

> 🔰 **개발 모르는 사람용**: 가입 신청 폼(`/join/`)만 고치는 거라면 → **[join/README.md](join/README.md)**
> GitHub 가입부터 웹에서 직접 수정·커밋까지, 설치 없이 따라 할 수 있게 정리돼 있음. (신규 직업 추가 등)

---

## 6. 보안 — 이관하며 같이 정리할 것

- **Supabase anon 키가 소스에 공개**돼 있고 RLS가 느슨해서, 키만 알면 **외부에서 DB 수정이 가능**한 상태.
  (지금까지 편의로 열어둠) 이관 후 새 관리자와 **RLS 정책 조이기** 검토 권장.
- `bail_requests` 는 **DELETE 정책이 없어** 운영진도 삭제 불가. 필요하면:
  ```sql
  create policy bail_requests_delete_auth on public.bail_requests
    for delete to authenticated using (true);
  ```
- 이관 완료 후 **내 계정 흔적 제거**: admin_whitelist, GitHub 조직/리포, Supabase 조직, Cloudflare 멤버, 넥슨 키

---

*작성: 2026-07 · 인수인계 시점 기준. 서비스 대시보드 메뉴명은 조금씩 바뀔 수 있음.*
