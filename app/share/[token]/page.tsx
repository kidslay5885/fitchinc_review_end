import { getSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { ShareInstructorView } from "@/components/share-instructor-view";
import { fetchAllRanges } from "@/lib/supabase-paginate";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const supabase = getSupabase();

  // 공유 링크 조회
  const { data: shareLink } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", token)
    .single();

  if (!shareLink) {
    notFound();
  }

  // 만료 확인
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">링크가 만료되었습니다</h1>
          <p className="text-muted-foreground text-sm">
            이 공유 링크는 더 이상 유효하지 않습니다.
          </p>
        </div>
      </div>
    );
  }

  // ---- 강사 공유 페이지 ----
  if (shareLink.share_type === "instructor") {
    return (
      <ShareInstructorView
        token={token}
        title={shareLink.title}
        filters={{
          platform: shareLink.filter_platform,
          instructor: shareLink.filter_instructor,
          cohort: shareLink.filter_cohort,
          course: shareLink.filter_course,
        }}
      />
    );
  }

  // ---- 기존 댓글 공유 페이지 ----

  // 필터 조건으로 설문 조회
  let surveyQuery = supabase.from("surveys").select("id");
  if (shareLink.filter_platform) {
    surveyQuery = surveyQuery.eq("platform", shareLink.filter_platform);
  }
  if (shareLink.filter_instructor) {
    surveyQuery = surveyQuery.eq("instructor", shareLink.filter_instructor);
  }
  if (shareLink.filter_cohort) {
    surveyQuery = surveyQuery.eq("cohort", shareLink.filter_cohort);
  }

  const { data: surveys } = await surveyQuery;
  const surveyIds = surveys?.map((s) => s.id) || [];

  // 댓글 조회 (1000행 제한 우회 — 페이지네이션)
  let comments: Record<string, unknown>[] = [];
  if (surveyIds.length > 0) {
    comments = await fetchAllRanges<Record<string, unknown>>((from, to, withCount) => {
      let q = supabase
        .from("comments")
        .select("*", withCount ? { count: "exact" } : undefined)
        .in("survey_id", surveyIds)
        .order("created_at");
      if (shareLink.filter_sentiment) q = q.eq("sentiment", shareLink.filter_sentiment);
      return q.range(from, to);
    });
  }

  const positiveComments = comments.filter((c) => c.sentiment === "positive");
  const negativeComments = comments.filter((c) => c.sentiment === "negative");
  const neutralComments = comments.filter((c) => c.sentiment === "neutral");

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="py-4 px-6 border-b bg-card">
        <div className="max-w-3xl mx-auto flex items-center gap-2.5">
          <img src="/fitchnic-logo.png" alt="핏크닉" className="h-[22px] w-auto" />
          <span className="text-sm font-extrabold">클래스 인사이트</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* 제목 */}
        <h1 className="text-2xl font-extrabold mb-2">{shareLink.title}</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-8">
          {shareLink.filter_platform && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-xs">
              {shareLink.filter_platform}
            </span>
          )}
          {shareLink.filter_instructor && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-xs">
              {shareLink.filter_instructor}
            </span>
          )}
          {shareLink.filter_cohort && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-xs">
              {shareLink.filter_cohort}
            </span>
          )}
          <span>{comments.length}개 댓글</span>
        </div>

        {/* 통계 요약 */}
        {!shareLink.filter_sentiment && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-2xl font-extrabold text-emerald-700">
                {positiveComments.length}
              </div>
              <div className="text-xs text-emerald-600 mt-1">긍정</div>
            </div>
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-center">
              <div className="text-2xl font-extrabold text-red-700">
                {negativeComments.length}
              </div>
              <div className="text-xs text-red-600 mt-1">부정</div>
            </div>
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-center">
              <div className="text-2xl font-extrabold text-gray-600">
                {neutralComments.length}
              </div>
              <div className="text-xs text-gray-500 mt-1">중립</div>
            </div>
          </div>
        )}

        {/* 긍정 댓글 */}
        {positiveComments.length > 0 && (
          <section className="mb-8">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              긍정 피드백 ({positiveComments.length})
            </h2>
            <div className="space-y-2">
              {positiveComments.map((c: Record<string, unknown>) => (
                <div
                  key={String(c.id)}
                  className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-emerald-700">
                      {String(c.respondent ?? "")}
                    </span>
                    {c.ai_summary ? (
                      <span className="text-[10px] text-emerald-600 italic">
                        — {String(c.ai_summary)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-relaxed text-emerald-900">
                    {String(c.original_text ?? "")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 부정 댓글 */}
        {negativeComments.length > 0 && (
          <section className="mb-8">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              개선 피드백 ({negativeComments.length})
            </h2>
            <div className="space-y-2">
              {negativeComments.map((c: Record<string, unknown>) => (
                <div
                  key={String(c.id)}
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-red-700">
                      {String(c.respondent ?? "")}
                    </span>
                    {c.ai_summary ? (
                      <span className="text-[10px] text-red-600 italic">
                        — {String(c.ai_summary)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-relaxed text-red-900">
                    {String(c.original_text ?? "")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 중립 댓글 */}
        {neutralComments.length > 0 && (
          <section className="mb-8">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              기타 ({neutralComments.length})
            </h2>
            <div className="space-y-2">
              {neutralComments.map((c: Record<string, unknown>) => (
                <div
                  key={String(c.id)}
                  className="p-3.5 rounded-xl bg-gray-50 border border-gray-200"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-600">
                      {String(c.respondent ?? "")}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-700">
                    {String(c.original_text ?? "")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {comments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            표시할 댓글이 없습니다
          </div>
        )}

        {/* 푸터 */}
        <footer className="mt-12 pt-4 border-t text-center text-xs text-muted-foreground">
          Powered by 핏크닉 클래스 인사이트
        </footer>
      </div>
    </div>
  );
}
