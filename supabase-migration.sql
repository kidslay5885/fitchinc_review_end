-- Phase 1: Supabase 스키마 확장
-- 기존 surveys, comments, share_links 테이블 보존, 추가만 수행

-- 1. 전체 응답 데이터 (인구통계, 점수 등)
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  gender TEXT DEFAULT '',
  age TEXT DEFAULT '',
  job TEXT DEFAULT '',
  hours TEXT DEFAULT '',
  channel TEXT DEFAULT '',
  computer REAL DEFAULT 0,
  goal TEXT DEFAULT '',
  hope_platform TEXT DEFAULT '',
  hope_instructor TEXT DEFAULT '',
  ps1 REAL DEFAULT 0,
  ps2 REAL DEFAULT 0,
  p_sat TEXT DEFAULT '',
  p_fmt TEXT DEFAULT '',
  p_free TEXT DEFAULT '',
  p_rec TEXT DEFAULT '',
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. PM 워크노트
CREATE TABLE IF NOT EXISTS pm_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  instructor TEXT NOT NULL,
  cohort TEXT NOT NULL,
  good TEXT DEFAULT '',
  bad TEXT DEFAULT '',
  action_plan TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, instructor, cohort)
);

-- 3. AI 분석 캐시
CREATE TABLE IF NOT EXISTS analysis_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  instructor TEXT NOT NULL,
  cohort TEXT,
  result JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, instructor, cohort)
);

-- 4. 기존 surveys 테이블 컬럼 추가
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS pm TEXT DEFAULT '';
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS total_students INTEGER DEFAULT 0;
