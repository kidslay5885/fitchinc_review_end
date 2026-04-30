-- 핵심 쿼리 가속용 인덱스
-- Supabase SQL Editor에서 한 번만 실행하세요.
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로
-- SQL Editor에서 한 줄씩 또는 통째로 실행하면 자동 처리됩니다.

-- 1) surveys 4단계 키 조회 (hierarchy / share/data / responses 등 거의 모든 라우트가 사용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surveys_lookup
  ON surveys (platform, instructor, course, cohort, survey_type);

-- 2) comments → survey 조인 (분류/액션 관련 라우트에서 핵심)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_survey
  ON comments (survey_id);

-- 3) tag 필터 (TabFeedbackHub 미분류/강사/플랫폼 그룹화)
--    부분 인덱스로 NULL 행은 제외해 인덱스 사이즈 감소
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_tag
  ON comments (tag) WHERE tag IS NOT NULL;

-- 4) action_tag 필터 (ActionRoleView 직무별 묶기)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_action
  ON comments (action_tag) WHERE action_tag IS NOT NULL;

-- 5) survey_responses → survey 조인 (responses 라우트)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_survey
  ON survey_responses (survey_id);

-- 6) 공유 링크 토큰 검증 (외부 사용자 진입 경로, 매 요청마다 호출)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_share_links_token
  ON share_links (token);

-- 7) app_settings의 LIKE 'instructor_photo:%' 패턴 검색
--    text_pattern_ops로 prefix 검색을 인덱스로 처리
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_settings_key_prefix
  ON app_settings (key text_pattern_ops);

-- 참고:
-- CONCURRENTLY 옵션 덕분에 인덱스 빌드 동안에도 테이블에 읽기/쓰기가 계속 가능합니다.
-- 단, 빌드는 일반 CREATE INDEX보다 약간 느립니다 (수만 건 기준 수 초).
