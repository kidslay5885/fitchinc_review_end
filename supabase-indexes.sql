-- 핵심 쿼리 가속용 인덱스
-- Supabase SQL Editor에서 통째로 실행하세요.
-- CONCURRENTLY 옵션 없이 일반 CREATE INDEX를 사용합니다.
-- (CONCURRENTLY는 트랜잭션 밖에서만 가능한데 SQL Editor가 자동으로 트랜잭션을 감쌉니다)
-- 핏크닉 데이터 규모에서 인덱스 빌드는 보통 수백 ms 안에 끝나고
-- 그동안의 짧은 락은 사용자가 거의 체감하지 못합니다.

-- 1) surveys 4단계 키 조회 (hierarchy / share/data / responses 등 거의 모든 라우트)
CREATE INDEX IF NOT EXISTS idx_surveys_lookup
  ON surveys (platform, instructor, course, cohort, survey_type);

-- 2) comments → survey 조인 (분류/액션 관련 라우트의 핵심)
CREATE INDEX IF NOT EXISTS idx_comments_survey
  ON comments (survey_id);

-- 3) tag 필터 (TabFeedbackHub 미분류/강사/플랫폼 그룹화)
--    부분 인덱스로 NULL 행은 제외해 인덱스 사이즈 감소
CREATE INDEX IF NOT EXISTS idx_comments_tag
  ON comments (tag) WHERE tag IS NOT NULL;

-- 4) action_tag 필터 (ActionRoleView 직무별 묶기)
CREATE INDEX IF NOT EXISTS idx_comments_action
  ON comments (action_tag) WHERE action_tag IS NOT NULL;

-- 5) survey_responses → survey 조인 (responses 라우트)
CREATE INDEX IF NOT EXISTS idx_responses_survey
  ON survey_responses (survey_id);

-- 6) 공유 링크 토큰 검증 (외부 사용자 진입 경로, 매 요청마다 호출)
CREATE INDEX IF NOT EXISTS idx_share_links_token
  ON share_links (token);

-- 7) app_settings의 LIKE 'instructor_photo:%' 패턴 검색
--    text_pattern_ops로 prefix 검색을 인덱스로 처리
CREATE INDEX IF NOT EXISTS idx_app_settings_key_prefix
  ON app_settings (key text_pattern_ops);
