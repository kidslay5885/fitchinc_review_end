import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import type { SurveyForm } from "@/lib/types";
import { SurveyFormPublic } from "@/components/survey-form-public";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("survey_forms")
      .select("title, platform, instructor, cohort, survey_type, description")
      .eq("token", token)
      .single();
    if (data) {
      const title = data.title || `${data.platform} ${data.instructor} ${data.cohort || ""} ${data.survey_type} 설문`.trim();
      const desc = (data.description || "").replace(/<[^>]*>/g, "").trim() || `${title} - 설문에 참여해주세요`;
      return {
        title,
        description: desc,
        openGraph: { type: "website", locale: "ko_KR", title, description: desc, siteName: "클래스인사이트" },
      };
    }
  } catch {}
  return { title: "설문 응답", openGraph: { type: "website", locale: "ko_KR", title: "설문 응답" } };
}

export default async function SurveyPage({ params }: Props) {
  const { token } = await params;

  let form: SurveyForm | null = null;
  let errorMsg = "";

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("survey_forms")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !data) {
      errorMsg = "설문을 찾을 수 없습니다.";
    } else if (!data.is_active) {
      errorMsg = "이 설문은 마감되었습니다.";
    } else {
      form = data as SurveyForm;
    }
  } catch {
    errorMsg = "설문을 불러오는 중 오류가 발생했습니다.";
  }

  if (errorMsg || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg border p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">📋</div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">설문 안내</h1>
          <p className="text-sm text-gray-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return <SurveyFormPublic form={form} />;
}
