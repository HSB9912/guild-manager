-- ========================================
-- 수로 보석금 신청 시스템 — Supabase 스키마
-- 실행 위치: Supabase 대시보드 > SQL Editor
-- ========================================
--
-- 비즈니스 로직 메모:
--  · 수로 미참 시 노블 사용 불가, 보석금 납부 시 해제
--  · 길드별 기본 금액(솔 에르다 조각): 뚠카롱 80 / 뚱카롱 40 / 밤·별·달·꿀·솜 20
--  · 동일 캐릭이 같은 반기에 또 보석금 → 2배, 3배, 4배 (누진)
--  · 누진세는 반기(YYYY-H1 / YYYY-H2) 기준 자동 초기화
--  · 길드창고(뚠/뚱카롱) 입금 후 스샷 업로드 → 운영진 확인 → 노블 해제
-- ========================================

CREATE TABLE IF NOT EXISTS bail_requests (
  id BIGSERIAL PRIMARY KEY,

  -- 신청자 본캐 (대표 닉)
  main_char TEXT NOT NULL,                     -- 본캐닉 (members.name)

  -- 보석금 납부 대상 캐릭 (본캐 또는 부캐)
  payer_char TEXT NOT NULL,                    -- 보석금 내는 캐릭 닉
  payer_guild TEXT NOT NULL,                   -- 해당 캐릭 길드 (뚠/뚱/밤/별/달/꿀/솜)
  payer_role TEXT,                             -- 해당 캐릭 직위 (참고)
  payer_is_main BOOLEAN DEFAULT FALSE,         -- 본캐 여부

  -- 금액 계산
  base_amount INTEGER NOT NULL,                -- 길드 기본 금액 (80/40/20)
  multiplier INTEGER NOT NULL DEFAULT 1,       -- 누진 배수 (1/2/3/4...)
  total_amount INTEGER NOT NULL,               -- 실제 납부 금액 (base × multiplier)
  offense_count INTEGER NOT NULL DEFAULT 1,    -- 이번 반기 위반 누적 횟수 (= multiplier)

  -- 반기 식별 (누진세 초기화 기준)
  half_year TEXT NOT NULL,                     -- 'YYYY-H1' (1~6월) / 'YYYY-H2' (7~12월)

  -- 미참 회차 정보 (참고용 - 클라이언트가 자동 감지하여 채움)
  miss_period_id BIGINT,                       -- 미참한 수로 회차 id
  miss_period_label TEXT,                      -- 회차 라벨

  -- 증빙
  proof_image_url TEXT,                        -- 길드창고 입금 스샷 (R2)

  -- 신청자 메모
  reason TEXT,                                 -- 사유/비고
  kakao_nick TEXT,                             -- 본인 확인용 (선택)

  -- 처리 상태
  --  pending        : 신청됨, 운영진 확인 대기
  --  approved       : 보석금 인정 (스샷 확인 완료)
  --  noble_unlocked : 노블 해제 완료 (최종)
  --  rejected       : 거절
  --  hold           : 보류
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'noble_unlocked', 'rejected', 'hold')),
  admin_note TEXT,
  processed_by TEXT,                           -- 처리한 관리자
  processed_at TIMESTAMPTZ,
  unlocked_by TEXT,                            -- 노블 해제 처리한 관리자
  unlocked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bail_status ON bail_requests(status);
CREATE INDEX IF NOT EXISTS idx_bail_main_char ON bail_requests(main_char);
CREATE INDEX IF NOT EXISTS idx_bail_payer_char ON bail_requests(payer_char);
CREATE INDEX IF NOT EXISTS idx_bail_half_year ON bail_requests(half_year);
CREATE INDEX IF NOT EXISTS idx_bail_payer_half ON bail_requests(payer_char, half_year);
CREATE INDEX IF NOT EXISTS idx_bail_created ON bail_requests(created_at DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_bail_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bail_updated_at_trigger ON bail_requests;
CREATE TRIGGER bail_updated_at_trigger
  BEFORE UPDATE ON bail_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_bail_updated_at();

-- ========================================
-- RLS — 면제 시스템과 동일 패턴
-- ========================================

ALTER TABLE bail_requests ENABLE ROW LEVEL SECURITY;

-- INSERT: 누구나 신청 가능
DROP POLICY IF EXISTS bail_insert_anyone ON bail_requests;
CREATE POLICY bail_insert_anyone
  ON bail_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT: 누구나 조회 가능 (본인 이력 확인용 + 누진 카운트 계산)
DROP POLICY IF EXISTS bail_select_anyone ON bail_requests;
CREATE POLICY bail_select_anyone
  ON bail_requests
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- UPDATE / DELETE: 관리자만
DROP POLICY IF EXISTS bail_update_admin ON bail_requests;
CREATE POLICY bail_update_admin
  ON bail_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_whitelist
      WHERE email = (auth.jwt() ->> 'email')
      AND status = 'approved'
    )
  );

DROP POLICY IF EXISTS bail_delete_admin ON bail_requests;
CREATE POLICY bail_delete_admin
  ON bail_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_whitelist
      WHERE email = (auth.jwt() ->> 'email')
      AND status = 'approved'
    )
  );
