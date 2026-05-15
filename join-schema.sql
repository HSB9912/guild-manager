-- ========================================
-- 길드 가입 신청 시스템 — Supabase 스키마
-- 실행: Supabase 대시보드 > SQL Editor
-- ========================================

-- 가입 질문 (운영진이 추가/수정/삭제/순서변경)
CREATE TABLE IF NOT EXISTS join_questions (
  id BIGSERIAL PRIMARY KEY,
  label       TEXT NOT NULL,
  input_type  TEXT NOT NULL DEFAULT 'text'
              CHECK (input_type IN ('text','textarea','yesno')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 가입 신청
CREATE TABLE IF NOT EXISTS join_requests (
  id BIGSERIAL PRIMARY KEY,

  -- 고정 필드 (모집공고 재료)
  nickname    TEXT NOT NULL,
  suro_score  TEXT,
  job         TEXT,
  prev_guild  TEXT,

  -- 질문 답변 스냅샷: [{ q: '질문', a: '답변' }, ...]
  answers     JSONB DEFAULT '[]'::jsonb NOT NULL,

  hands_image_url TEXT,          -- 핸즈 인증 캡처 (R2)

  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected')),
  admin_note  TEXT,
  processed_by TEXT,
  processed_at TIMESTAMPTZ,

  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_join_req_status  ON join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_req_created ON join_requests(created_at DESC);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION update_join_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS join_requests_updated_at_trigger ON join_requests;
CREATE TRIGGER join_requests_updated_at_trigger
  BEFORE UPDATE ON join_requests
  FOR EACH ROW EXECUTE FUNCTION update_join_requests_updated_at();

-- ========================================
-- RLS
-- ========================================
ALTER TABLE join_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests  ENABLE ROW LEVEL SECURITY;

-- 질문: 누구나 조회 (가입 신청 페이지에서 읽음), 수정은 관리자만
DROP POLICY IF EXISTS join_q_select_anyone ON join_questions;
CREATE POLICY join_q_select_anyone ON join_questions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS join_q_admin_write ON join_questions;
CREATE POLICY join_q_admin_write ON join_questions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_whitelist WHERE email = (auth.jwt() ->> 'email') AND status = 'approved'))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_whitelist WHERE email = (auth.jwt() ->> 'email') AND status = 'approved'));

-- 신청: 누구나 INSERT (가입 신청), SELECT 가능, 수정/삭제는 관리자만
DROP POLICY IF EXISTS join_req_insert_anyone ON join_requests;
CREATE POLICY join_req_insert_anyone ON join_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS join_req_select_anyone ON join_requests;
CREATE POLICY join_req_select_anyone ON join_requests
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS join_req_update_admin ON join_requests;
CREATE POLICY join_req_update_admin ON join_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_whitelist WHERE email = (auth.jwt() ->> 'email') AND status = 'approved'));

DROP POLICY IF EXISTS join_req_delete_admin ON join_requests;
CREATE POLICY join_req_delete_admin ON join_requests
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_whitelist WHERE email = (auth.jwt() ->> 'email') AND status = 'approved'));

-- ========================================
-- 기본 질문 시드 (필요시 운영진이 수정)
-- ========================================
INSERT INTO join_questions (label, input_type, sort_order) VALUES
('1. 길드 가입 (1기 / 2기)',                  'text',     1),
('1-2. 오시게 된 경로 (지인소개면 지인분 닉)', 'text',     2),
('1-3. 뚠/뚱카롱을 선택해주신 이유',           'textarea', 3),
('1-5. 이전 길드 탈퇴 사유',                   'text',     4),
('1-6. 가입 문의 후 12시간 대기에 동의하시나요?', 'yesno',  5);
