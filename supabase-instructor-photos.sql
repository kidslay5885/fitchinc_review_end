-- 강사 사진을 base64(JSONB) 대신 Supabase Storage에 저장하기 위한 버킷
-- Supabase SQL Editor에서 한 번만 실행하세요.

-- 1) public read 버킷 생성 (이미 있으면 그대로)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instructor-photos',
  'instructor-photos',
  true,
  2 * 1024 * 1024, -- 2MB (클라가 256x256으로 압축하므로 충분)
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) RLS 정책
--    storage.objects 테이블에 RLS가 enable되어 있다는 가정.
--    service_role은 RLS를 우회하므로 서버 라우트(getSupabase)는 바로 동작한다.
--    아래 정책은 anon/authenticated 클라이언트가 익명으로 사진을 읽을 수 있게 한다.

-- 누구나 읽기 (공유 페이지 등에서 사진 표시)
DROP POLICY IF EXISTS "instructor-photos public read" ON storage.objects;
CREATE POLICY "instructor-photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'instructor-photos');

-- 쓰기/삭제는 service_role만 (별도 INSERT/UPDATE/DELETE 정책 없으면 RLS로 자동 차단됨)
-- 만약 명시가 필요하면 아래 주석 해제:
-- CREATE POLICY "instructor-photos service write" ON storage.objects FOR ALL
--   USING (bucket_id = 'instructor-photos' AND auth.role() = 'service_role');
