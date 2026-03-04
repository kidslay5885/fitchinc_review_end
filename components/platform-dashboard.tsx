"use client";

import { useMemo } from "react";
import type { Platform } from "@/lib/types";
import { allCohorts, cohortAvgScore } from "@/lib/types";
import {
  computeDemographics,
  computeScores,
  getSatisfactionItems,
} from "@/lib/analysis-engine";
import {
  SummaryCard,
  ChartCard,
  DonutChart,
  HBarChart,
  RecDonut,
  toChartData,
  toChartDataWithDefaults,
  toGenderData,
  pinItems,
  AGE_GROUPS,
} from "@/components/tab-overview";
import { RingScore } from "@/components/ring-score";
import { Loader2 } from "lucide-react";

interface PlatformDashboardProps {
  platform: Platform;
  dataLoading: boolean;
}

export function PlatformDashboard({ platform, dataLoading }: PlatformDashboardProps) {
  // 전체 기수 · 응답 수집
  const allPlatCohorts = useMemo(
    () => platform.instructors.flatMap((i) => allCohorts(i)),
    [platform]
  );

  const { preResponses, postResponses } = useMemo(() => {
    return {
      preResponses: allPlatCohorts.flatMap((c) => Array.isArray(c.preResponses) ? c.preResponses : []),
      postResponses: allPlatCohorts.flatMap((c) => Array.isArray(c.postResponses) ? c.postResponses : []),
    };
  }, [allPlatCohorts]);

  const allResponses = useMemo(
    () => [...preResponses, ...postResponses],
    [preResponses, postResponses]
  );

  const demographics = useMemo(() => computeDemographics(allResponses), [allResponses]);
  const scores = useMemo(() => computeScores(postResponses), [postResponses]);
  const satItems = useMemo(() => getSatisfactionItems(postResponses), [postResponses]);

  // 헤더 통계
  const doneCohorts = allPlatCohorts.filter((c) => (Array.isArray(c.postResponses) ? c.postResponses.length : 0) > 0);
  const allScores = doneCohorts.map((c) => cohortAvgScore(c)).filter((s) => s > 0);
  const avg =
    allScores.length > 0
      ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
      : "-";

  // chart data
  const gender = toGenderData(demographics.gender);
  const ageData = toChartDataWithDefaults(demographics.age, AGE_GROUPS);
  const jobData = pinItems(toChartData(demographics.job), { bottom: ["기타"] });
  const hoursData = toChartData(demographics.hours);
  const channelData = pinItems(toChartData(demographics.channel), { top: ["SNS", "sns"] });
  const satData = satItems.map((s) => ({ name: s.label, value: s.count }));

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/3 to-purple-500/2 rounded-[14px] border p-6 mb-5">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[22px] font-extrabold">{platform.name}</div>
            <div
              className="text-[13px] text-muted-foreground mt-1"
              title="완료 = 해당 기수에서 후기 설문이 1건 이상 수집된 경우"
            >
              강사 {platform.instructors.length}명 · 설문 참여{" "}
              {preResponses.length + postResponses.length}명 · 설문 완료{" "}
              {doneCohorts.length}기수
              <span className="text-[11px] text-muted-foreground/80 ml-1">
                (후기 설문 수집 기준)
              </span>
            </div>
          </div>
          <div
            className="text-center px-5 py-2.5 bg-card rounded-[10px] border"
            title="후기 설문의 커리큘럼·피드백 만족도 점수 평균을 10점 만점으로 환산한 값입니다. 각 기수별 평균을 다시 평균낸 수치입니다."
          >
            <div className="text-[11px] font-bold text-muted-foreground mb-0.5">
              강의 만족도 평균
            </div>
            <div className="text-[28px] font-extrabold leading-none">
              <span className={Number(avg) >= 9 ? "text-emerald-600" : "text-primary"}>
                {avg}
              </span>
              <span className="text-[13px] font-normal text-muted-foreground">/10</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading spinner */}
      {dataLoading ? (
        <div className="text-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          <div className="text-[13px] text-muted-foreground">
            설문 정보 로딩 중...
          </div>
        </div>
      ) : preResponses.length === 0 && postResponses.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-[14px] font-semibold text-muted-foreground">
            데이터 없음
          </div>
          <div className="text-[12px] text-muted-foreground mt-1">
            설문 파일을 업로드하면 차트가 표시됩니다.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* scope label */}
          <div className="text-[12px] text-muted-foreground">
            {platform.name} · 전체 강사 통합
          </div>

          {/* summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard label="사전 응답 수" value={`${preResponses.length}명`} tip="강의 시작 전 사전 설문에 참여한 총 응답자 수" />
            <SummaryCard label="후기 응답 수" value={`${postResponses.length}명`} tip="강의 종료 후 후기 설문에 참여한 총 응답자 수" />
            <SummaryCard
              label="만족도 점수"
              value={
                scores.ps1Avg > 0 || scores.ps2Avg > 0
                  ? `${(
                      (scores.ps1Avg + scores.ps2Avg) /
                      (scores.ps1Avg > 0 && scores.ps2Avg > 0 ? 2 : 1)
                    ).toFixed(1)}`
                  : "-"
              }
              sub="10점 만점"
              tip="후기 설문의 '커리큘럼 만족도'와 '피드백 만족도' 점수의 평균입니다. 10점 만점 기준으로 환산됩니다."
            />
            <SummaryCard
              label="추천률"
              value={postResponses.length > 0 ? `${scores.recRate}%` : "-"}
              tip="후기 설문 '이 강의를 지인분들께 추천하실 것 같으신가요?' 문항에서 긍정 응답을 한 비율입니다."
            />
          </div>

          {/* charts */}
          <div className="grid grid-cols-2 gap-5">
            <ChartCard title="성별 분포" empty={gender.data.length === 0} tip="설문 응답자의 성별 비율">
              <DonutChart data={gender.data} colors={gender.colors} />
            </ChartCard>

            <ChartCard title="연령대 분포" empty={ageData.length === 0} tip="설문 응답자의 연령대 분포">
              <HBarChart data={ageData} />
            </ChartCard>

            <ChartCard title="현재 하고 있는 일" empty={jobData.length === 0} tip="설문 응답자의 현재 직업 분포">
              <HBarChart data={jobData} />
            </ChartCard>

            <ChartCard title="부업 투자 시간" empty={hoursData.length === 0} tip="설문 응답자가 부업에 투자하는 시간 분포">
              <HBarChart data={hoursData} />
            </ChartCard>

            <ChartCard title="알게 된 경로" empty={channelData.length === 0} tip="설문 응답자가 해당 강의를 알게 된 경로 분포">
              <HBarChart data={channelData} />
            </ChartCard>

            <ChartCard title="좋았던 점" empty={satData.length === 0} tip="후기 설문 '만족스러웠던 점'에 대한 응답을 항목별로 집계한 수치">
              <HBarChart data={satData} />
            </ChartCard>

            <ChartCard title="커리큘럼 만족도" empty={postResponses.length === 0} tip="후기 설문의 '커리큘럼 만족도'와 '피드백 만족도' 점수를 각각 10점 만점으로 환산한 평균값">
              <div className="flex items-center justify-center gap-8 py-4">
                <RingScore
                  score={scores.ps1Avg}
                  size={80}
                  label="커리큘럼"
                  excluded={scores.ps1Excluded}
                />
                <RingScore
                  score={scores.ps2Avg}
                  size={80}
                  label="피드백"
                  excluded={scores.ps2Excluded}
                />
              </div>
            </ChartCard>

            <ChartCard title="추천 의향" empty={postResponses.length === 0} tip="후기 설문 '이 강의를 지인분들께 추천하실 것 같으신가요?'에 대한 응답을 긍정/부정으로 분류한 비율">
              <RecDonut postResponses={postResponses} />
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
