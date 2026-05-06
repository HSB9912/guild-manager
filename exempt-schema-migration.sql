-- ========================================
-- 수로 면제 신청 — 'hold' (보류) 상태 추가 마이그레이션
-- 실행: Supabase 대시보드 > SQL Editor
-- ========================================

-- 기존 CHECK 제약 삭제 후 'hold' 포함하여 재생성
ALTER TABLE exempt_requests
  DROP CONSTRAINT IF EXISTS exempt_requests_status_check;

ALTER TABLE exempt_requests
  ADD CONSTRAINT exempt_requests_status_check
  CHECK (status IN ('pending', 'hold', 'active', 'rejected', 'revoked'));
