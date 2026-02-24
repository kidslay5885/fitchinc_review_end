-- 강사 이미지·기수 순서 영구 저장용 테이블 (새 창/새로고침 시 복원)
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE app_settings IS '앱 설정: instructor_photo:{platform}:{instructor}, cohort_order:{platform}:{instructor}';
