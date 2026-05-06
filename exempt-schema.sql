-- ========================================
-- 수로 면제 신청 시스템 — Supabase 스키마
-- 실행 위치: Supabase 대시보드 > SQL Editor
-- ========================================

-- 면제 신청 테이블
CREATE TABLE IF NOT EXISTS exempt_requests (
  id BIGSERIAL PRIMARY KEY,

  -- 신청자 본캐 정보
  main_char TEXT NOT NULL,                     -- 본캐닉
  main_class TEXT,                             -- 본캐 직업 (자동/수동)
  main_guild TEXT,                             -- 본캐 길드 (자동/수동)
  main_score INTEGER,                          -- 본캐 수로 점수
  is_score_manual BOOLEAN DEFAULT FALSE,       -- 점수 수동 입력 여부
  request_type TEXT NOT NULL,                  -- 'full' (9만+) / 'half' (9만 미만)

  -- 부캐 리스트 (JSON: [{name, guild, was_mapped, status}])
  sub_chars JSONB DEFAULT '[]'::jsonb NOT NULL,

  -- 메타
  is_new_member BOOLEAN DEFAULT FALSE,         -- 신규 가입 동시 신청
  kakao_nick TEXT,                             -- 오픈챗 닉 (사칭 방지)
  reason TEXT,                                 -- 사유 (선택)

  -- 처리 상태
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'hold', 'active', 'rejected', 'revoked')),
  admin_note TEXT,                             -- 운영진 메모
  processed_by TEXT,                           -- 승인/거절한 관리자
  processed_at TIMESTAMPTZ,
  revoked_by TEXT,                             -- 면제 푼 관리자
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_exempt_status ON exempt_requests(status);
CREATE INDEX IF NOT EXISTS idx_exempt_main_char ON exempt_requests(main_char);
CREATE INDEX IF NOT EXISTS idx_exempt_created ON exempt_requests(created_at DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_exempt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exempt_updated_at_trigger ON exempt_requests;
CREATE TRIGGER exempt_updated_at_trigger
  BEFORE UPDATE ON exempt_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_exempt_updated_at();

-- ========================================
-- RLS (Row Level Security) — 인증 없는 사이트라 단순 정책
-- ========================================

ALTER TABLE exempt_requests ENABLE ROW LEVEL SECURITY;

-- INSERT: 누구나 신청 가능 (anon role 포함)
DROP POLICY IF EXISTS exempt_insert_anyone ON exempt_requests;
CREATE POLICY exempt_insert_anyone
  ON exempt_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT: 누구나 조회 가능 (본인 신청 이력 확인용)
-- 단, 게시판이 아닌 면제 시스템이라 정보 노출 부담 적음
DROP POLICY IF EXISTS exempt_select_anyone ON exempt_requests;
CREATE POLICY exempt_select_anyone
  ON exempt_requests
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- UPDATE / DELETE: 관리자만 (admin_whitelist에 approved 상태로 등록된 이메일)
DROP POLICY IF EXISTS exempt_update_admin ON exempt_requests;
CREATE POLICY exempt_update_admin
  ON exempt_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_whitelist
      WHERE email = (auth.jwt() ->> 'email')
      AND status = 'approved'
    )
  );

DROP POLICY IF EXISTS exempt_delete_admin ON exempt_requests;
CREATE POLICY exempt_delete_admin
  ON exempt_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_whitelist
      WHERE email = (auth.jwt() ->> 'email')
      AND status = 'approved'
    )
  );
