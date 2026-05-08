-- ========================================
-- 운영진 할 일 보드 — Supabase 스키마
-- 실행 위치: Supabase 대시보드 > SQL Editor
-- ========================================

CREATE TABLE IF NOT EXISTS admin_todos (
  id BIGSERIAL PRIMARY KEY,

  title       TEXT NOT NULL,
  note        TEXT,
  priority    TEXT NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low','normal','high','urgent')),
  category    TEXT,                        -- 자유 텍스트 (예: 신청처리 / 운영 / 길드 / 기타)
  status      TEXT NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo','done')),

  due_date    DATE,                        -- 마감 (선택)

  created_by  TEXT,                        -- admin_whitelist 닉
  done_by     TEXT,
  done_at     TIMESTAMPTZ,

  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_todos_status   ON admin_todos(status);
CREATE INDEX IF NOT EXISTS idx_admin_todos_priority ON admin_todos(priority);
CREATE INDEX IF NOT EXISTS idx_admin_todos_created  ON admin_todos(created_at DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_admin_todos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_todos_updated_at_trigger ON admin_todos;
CREATE TRIGGER admin_todos_updated_at_trigger
  BEFORE UPDATE ON admin_todos
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_todos_updated_at();

-- ========================================
-- RLS — 관리자만 모든 권한 (신청 시스템과 동일 패턴)
-- ========================================
ALTER TABLE admin_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_todos_admin_all ON admin_todos;
CREATE POLICY admin_todos_admin_all ON admin_todos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_whitelist
      WHERE email = (auth.jwt() ->> 'email')
      AND status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_whitelist
      WHERE email = (auth.jwt() ->> 'email')
      AND status = 'approved'
    )
  );
