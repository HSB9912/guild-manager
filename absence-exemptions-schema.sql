-- =====================================================
-- 장기 부재 면제 예약 (결혼/신행/입원 등)
-- 신청 → 운영진 검토 → 승인/거절 워크플로
-- 실행: Supabase Dashboard → SQL Editor → 실행
-- =====================================================

CREATE TABLE IF NOT EXISTS absence_exemptions (
  id BIGSERIAL PRIMARY KEY,

  -- 대상 멤버
  member_id   BIGINT REFERENCES members(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,                    -- 닉네임 스냅샷 (멤버 삭제·이름 변경 대비)

  -- 사유
  reason_type TEXT NOT NULL,                    -- 카테고리: 결혼·신행 / 입원·수술 / 군대 등 (자유 입력)
  reason_detail TEXT,                            -- 상세 사유 (기타 선택 시 직접 입력 또는 추가 설명)
  memo TEXT,                                     -- 운영진 메모

  -- 기간 (KST 기준 날짜)
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL CHECK (end_date >= start_date),

  -- 검토 워크플로
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- 검토 대기 (운영진 결정 전)
    'approved',   -- 승인 (발효 예약)
    'rejected',   -- 거절
    'ended',      -- 종료 (종료일 지남, cron 자동 처리)
    'cancelled'   -- 취소
  )),
  decision_by   TEXT,                            -- 승인/거절 처리한 운영진 닉
  decision_at   TIMESTAMPTZ,                     -- 처리 시각
  decision_note TEXT,                            -- 운영진 코멘트 (거절 사유 등)

  -- Cron 알림 발송 추적 (중복 알림 방지)
  notified_weeks TEXT[] DEFAULT '{}',            -- 디스코드 알림 발송한 주차 라벨 배열

  -- 등록
  requested_by   TEXT,                           -- 신청자 (멤버 본인 또는 운영진)
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_absence_member  ON absence_exemptions(member_id);
CREATE INDEX IF NOT EXISTS idx_absence_period  ON absence_exemptions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_absence_status  ON absence_exemptions(status);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION update_absence_exemptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS absence_exemptions_updated_at_trigger ON absence_exemptions;
CREATE TRIGGER absence_exemptions_updated_at_trigger
  BEFORE UPDATE ON absence_exemptions
  FOR EACH ROW EXECUTE FUNCTION update_absence_exemptions_updated_at();

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE absence_exemptions ENABLE ROW LEVEL SECURITY;

-- 모두 조회 가능 (멤버가 본인 신청 확인용)
DROP POLICY IF EXISTS absence_select_anyone ON absence_exemptions;
CREATE POLICY absence_select_anyone ON absence_exemptions
  FOR SELECT TO anon, authenticated USING (true);

-- 신청 (INSERT) 누구나 가능 (status='pending'으로만)
DROP POLICY IF EXISTS absence_insert_anyone ON absence_exemptions;
CREATE POLICY absence_insert_anyone ON absence_exemptions
  FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');

-- 수정/삭제 (승인·거절 등)은 관리자만
DROP POLICY IF EXISTS absence_admin_write ON absence_exemptions;
CREATE POLICY absence_admin_write ON absence_exemptions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_whitelist WHERE email = (auth.jwt() ->> 'email') AND status = 'approved'))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_whitelist WHERE email = (auth.jwt() ->> 'email') AND status = 'approved'));

DROP POLICY IF EXISTS absence_admin_delete ON absence_exemptions;
CREATE POLICY absence_admin_delete ON absence_exemptions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_whitelist WHERE email = (auth.jwt() ->> 'email') AND status = 'approved'));

-- =====================================================
-- 사유 카테고리 참고 목록 (UI 드롭다운용)
-- DB에는 reason_type을 자유 텍스트로 저장, UI에서 아래 목록 + 직접 입력 제공
-- =====================================================
-- 1. 결혼·신행
-- 2. 본인 입원·수술
-- 3. 가족 입원·수술·간병
-- 4. 본인·가족 상사 (장례)
-- 5. 임신·출산·산후조리
-- 6. 군 입대 / 군 휴가 / 전역
-- 7. 시험 준비 (수능·공시·자격증·취업)
-- 8. 장기 출장 / 해외 체류
-- 9. 이사 / 정착 기간
-- 10. 정신건강 / 번아웃 / 회복
-- 11. 직장 적응 (이직 직후)
-- 12. 기타 (직접 입력)
