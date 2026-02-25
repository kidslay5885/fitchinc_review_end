"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type Dispatch,
  type ReactNode,
} from "react";
import type {
  Platform,
  Instructor,
  Course,
  Cohort,
  SurveyResponse,
} from "@/lib/types";
import { generateId, allCohorts } from "@/lib/types";
import { DEFAULT_PLATFORMS } from "@/lib/constants";

// ---- State ----
export interface AppState {
  platforms: Platform[];
  selectedPlatformId: string | null;
  selectedInstructorId: string | null;
  selectedCourseId: string | null;
  selectedCohortId: string | null;
  activeTab: string;
  hydrated: boolean;
  loading: boolean;
}

const initialState: AppState = {
  platforms: DEFAULT_PLATFORMS,
  selectedPlatformId: null,
  selectedInstructorId: null,
  selectedCourseId: null,
  selectedCohortId: null,
  activeTab: "overview",
  hydrated: false,
  loading: true,
};

// ---- Actions ----
type Action =
  | { type: "HYDRATE"; platforms: Platform[] }
  | { type: "SELECT_PLATFORM"; id: string | null }
  | { type: "SELECT_INSTRUCTOR"; id: string | null; platforms?: Platform[] }
  | { type: "SELECT_COURSE"; id: string | null }
  | { type: "SELECT_COHORT"; id: string | null }
  | { type: "SET_TAB"; tab: string }
  | {
      type: "ADD_RESPONSES";
      platformName: string;
      instructorName: string;
      courseName: string;
      cohortLabel: string;
      surveyType: "사전" | "후기";
      responses: SurveyResponse[];
      instructorCategory?: string;
    }
  | { type: "LOAD_COHORT_DATA"; platformName: string; instructorName: string; courseName: string; cohortLabel: string; preResponses: SurveyResponse[]; postResponses: SurveyResponse[] }
  | { type: "UPDATE_INSTRUCTOR"; instructor: Instructor }
  | { type: "DELETE_INSTRUCTOR"; id: string }
  | { type: "UPDATE_COHORT"; instructorId: string; cohort: Cohort }
  | { type: "DELETE_COHORT"; instructorId: string; cohortId: string }
  | { type: "SET_PLATFORMS"; platforms: Platform[] }
  | { type: "SET_LOADING"; loading: boolean };

function findOrCreatePlatform(platforms: Platform[], name: string): Platform[] {
  if (platforms.find((p) => p.name === name)) return platforms;
  return [...platforms, { id: generateId(), name, instructors: [] }];
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, platforms: action.platforms, hydrated: true, loading: false };

    case "SELECT_PLATFORM":
      return {
        ...state,
        selectedPlatformId: action.id,
        selectedInstructorId: null,
        selectedCourseId: null,
        selectedCohortId: null,
        activeTab: "feedback",
      };

    case "SELECT_INSTRUCTOR": {
      if (!action.id) {
        return {
          ...state,
          selectedInstructorId: null,
          selectedCourseId: null,
          selectedCohortId: null,
          activeTab: "overview",
        };
      }
      // 강의 1개면 자동 선택
      const platforms = action.platforms || state.platforms;
      const plat = platforms.find((p) => p.id === state.selectedPlatformId);
      const inst = plat?.instructors.find((i) => i.id === action.id);
      const autoSelectCourse = inst && inst.courses.length === 1 ? inst.courses[0].id : null;

      return {
        ...state,
        selectedInstructorId: action.id,
        selectedCourseId: autoSelectCourse,
        selectedCohortId: null,
        activeTab: "overview",
      };
    }

    case "SELECT_COURSE":
      return { ...state, selectedCourseId: action.id, selectedCohortId: null, activeTab: "overview" };

    case "SELECT_COHORT":
      return { ...state, selectedCohortId: action.id, activeTab: "overview" };

    case "SET_TAB":
      return { ...state, activeTab: action.tab };

    case "ADD_RESPONSES": {
      let platforms = [...state.platforms.map((p) => ({ ...p, instructors: [...p.instructors] }))];

      platforms = findOrCreatePlatform(platforms, action.platformName);
      const platIdx = platforms.findIndex((p) => p.name === action.platformName);
      const plat = { ...platforms[platIdx], instructors: [...platforms[platIdx].instructors] };

      let instIdx = plat.instructors.findIndex((i) => i.name === action.instructorName);
      if (instIdx < 0) {
        plat.instructors.push({
          id: generateId(),
          name: action.instructorName,
          category: action.instructorCategory || "",
          photo: "",
          photoPosition: "center 2%",
          courses: [],
        });
        instIdx = plat.instructors.length - 1;
      }
      const inst = { ...plat.instructors[instIdx], courses: [...plat.instructors[instIdx].courses] };

      const courseName = action.courseName || "";
      let courseIdx = inst.courses.findIndex((c) => c.name === courseName);
      if (courseIdx < 0) {
        inst.courses.push({
          id: generateId(),
          name: courseName,
          cohorts: [],
        });
        courseIdx = inst.courses.length - 1;
      }
      const course = { ...inst.courses[courseIdx], cohorts: [...inst.courses[courseIdx].cohorts] };

      let coIdx = course.cohorts.findIndex((c) => c.label === action.cohortLabel);
      if (coIdx < 0) {
        course.cohorts.push({
          id: generateId(),
          label: action.cohortLabel,
          pm: "",
          date: "",
          endDate: "",
          totalStudents: 0,
          preResponses: [],
          postResponses: [],
        });
        coIdx = course.cohorts.length - 1;
      }
      const cohort = { ...course.cohorts[coIdx] };

      if (action.surveyType === "사전") {
        cohort.preResponses = [...cohort.preResponses, ...action.responses];
      } else {
        cohort.postResponses = [...cohort.postResponses, ...action.responses];
      }

      course.cohorts[coIdx] = cohort;
      inst.courses[courseIdx] = course;
      plat.instructors[instIdx] = inst;
      platforms[platIdx] = plat;

      return { ...state, platforms };
    }

    case "LOAD_COHORT_DATA": {
      const platforms = state.platforms.map((p) => {
        if (p.name !== action.platformName) return p;
        return {
          ...p,
          instructors: p.instructors.map((i) => {
            if (i.name !== action.instructorName) return i;
            return {
              ...i,
              courses: i.courses.map((course) => {
                if (course.name !== action.courseName) return course;
                return {
                  ...course,
                  cohorts: course.cohorts.map((c) => {
                    if (c.label !== action.cohortLabel) return c;
                    return {
                      ...c,
                      preResponses: action.preResponses,
                      postResponses: action.postResponses,
                    };
                  }),
                };
              }),
            };
          }),
        };
      });
      return { ...state, platforms };
    }

    case "UPDATE_INSTRUCTOR": {
      const platforms = state.platforms.map((p) => ({
        ...p,
        instructors: p.instructors.map((i) =>
          i.id === action.instructor.id ? action.instructor : i
        ),
      }));
      return { ...state, platforms };
    }

    case "DELETE_INSTRUCTOR": {
      const platforms = state.platforms.map((p) => ({
        ...p,
        instructors: p.instructors.filter((i) => i.id !== action.id),
      }));
      return {
        ...state,
        platforms,
        selectedInstructorId:
          state.selectedInstructorId === action.id ? null : state.selectedInstructorId,
        selectedCourseId:
          state.selectedInstructorId === action.id ? null : state.selectedCourseId,
        selectedCohortId:
          state.selectedInstructorId === action.id ? null : state.selectedCohortId,
      };
    }

    case "UPDATE_COHORT": {
      const platforms = state.platforms.map((p) => ({
        ...p,
        instructors: p.instructors.map((i) =>
          i.id === action.instructorId
            ? {
                ...i,
                courses: i.courses.map((course) => ({
                  ...course,
                  cohorts: course.cohorts.map((c) =>
                    c.id === action.cohort.id ? action.cohort : c
                  ),
                })),
              }
            : i
        ),
      }));
      return { ...state, platforms };
    }

    case "DELETE_COHORT": {
      const platforms = state.platforms.map((p) => ({
        ...p,
        instructors: p.instructors.map((i) =>
          i.id === action.instructorId
            ? {
                ...i,
                courses: i.courses.map((course) => ({
                  ...course,
                  cohorts: course.cohorts.filter((c) => c.id !== action.cohortId),
                })),
              }
            : i
        ),
      }));
      return { ...state, platforms };
    }

    case "SET_PLATFORMS":
      return { ...state, platforms: action.platforms };

    case "SET_LOADING":
      return { ...state, loading: action.loading };

    default:
      return state;
  }
}

// ---- Context ----
const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<Action>;
  loadCohortData: (platformName: string, instructorName: string, courseName: string, cohortLabel: string) => Promise<void>;
  refreshHierarchy: () => Promise<void>;
} | null>(null);

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppStore must be used within AppProvider");
  return ctx;
}

// Derived selectors
export function useSelectedPlatform() {
  const { state } = useAppStore();
  return state.platforms.find((p) => p.id === state.selectedPlatformId) || null;
}

export function useSelectedInstructor() {
  const plat = useSelectedPlatform();
  const { state } = useAppStore();
  if (!plat || !state.selectedInstructorId) return null;
  return plat.instructors.find((i) => i.id === state.selectedInstructorId) || null;
}

export function useSelectedCourse() {
  const inst = useSelectedInstructor();
  const { state } = useAppStore();
  if (!inst || !state.selectedCourseId) return null;
  return inst.courses.find((c) => c.id === state.selectedCourseId) || null;
}

export function useSelectedCohort() {
  const inst = useSelectedInstructor();
  const course = useSelectedCourse();
  const { state } = useAppStore();
  if (!inst || !state.selectedCohortId) return null;
  // course가 선택되어 있으면 그 course 안에서, 아니면 전체 courses에서 찾기
  const cohorts = course ? course.cohorts : allCohorts(inst);
  return cohorts.find((c) => c.id === state.selectedCohortId) || null;
}

// ---- placeholder response 생성 ----
function makePlaceholderResponses(count: number): SurveyResponse[] {
  return Array(count).fill(null).map(() => ({
    id: generateId(), name: "", gender: "", age: "", job: "", hours: "",
    channel: "", computer: 0, goal: "", hopePlatform: "", hopeInstructor: "",
    ps1: 0, ps2: 0, pSat: "", pFmt: "", pFree: "", pRec: "", rawData: {},
  }));
}

// hierarchy API 응답 타입
interface HierarchyCohort { label: string; pm: string; preCount: number; postCount: number; startDate: string; endDate: string; totalStudents: number }
interface HierarchyCourse { name: string; cohorts: HierarchyCohort[] }
interface HierarchyInstructor { name: string; courses: HierarchyCourse[] }
interface HierarchyPlatform { name: string; instructors: HierarchyInstructor[] }

function buildInstructor(ai: HierarchyInstructor): Instructor {
  return {
    id: generateId(),
    name: ai.name,
    category: "",
    photo: "",
    photoPosition: "center 2%",
    courses: ai.courses.map((ac) => ({
      id: generateId(),
      name: ac.name,
      cohorts: ac.cohorts.map((aco) => ({
        id: generateId(),
        label: aco.label,
        pm: aco.pm || "",
        date: aco.startDate || "",
        endDate: aco.endDate || "",
        totalStudents: aco.totalStudents || 0,
        preResponses: makePlaceholderResponses(aco.preCount || 0),
        postResponses: makePlaceholderResponses(aco.postCount || 0),
      })),
    })),
  };
}

// ---- Provider component ----

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refreshHierarchy = useCallback(async () => {
    try {
      const res = await fetch("/api/hierarchy");
      if (!res.ok) throw new Error("hierarchy fetch failed");
      const data: HierarchyPlatform[] = await res.json();

      // hierarchy API 데이터를 Platform[] 형태로 변환
      const platforms: Platform[] = DEFAULT_PLATFORMS.map((dp) => {
        const apiPlat = data.find((p) => p.name === dp.name);
        if (!apiPlat) return { ...dp, instructors: [] };

        return {
          ...dp,
          instructors: apiPlat.instructors.map(buildInstructor),
        };
      });

      // API에서 온 플랫폼 중 DEFAULT에 없는 것 추가
      for (const apiPlat of data) {
        if (!platforms.find((p) => p.name === apiPlat.name)) {
          platforms.push({
            id: generateId(),
            name: apiPlat.name,
            instructors: apiPlat.instructors.map(buildInstructor),
          });
        }
      }

      // 서버 앱 설정 복원 (강사 사진, 기수 순서) - 새 창/새로고침 시 유지
      if (typeof window !== "undefined") {
        try {
          const res = await fetch("/api/app-settings");
          if (res.ok) {
            const { instructorPhotos, cohortOrders } = await res.json();
            for (const p of platforms) {
              for (const inst of p.instructors) {
                const key = `instructor_photo:${p.name}:${inst.name}`;
                const photoData = instructorPhotos?.[key];
                if (photoData?.photo != null) {
                  inst.photo = photoData.photo || "";
                  inst.photoPosition = photoData.photoPosition || "center 2%";
                }
              }
              for (const inst of p.instructors) {
                // 기수 순서 복원: course별로
                for (const course of inst.courses) {
                  const keySuffix = course.name ? `:${course.name}` : "";
                  const key = `cohort_order:${p.name}:${inst.name}${keySuffix}`;
                  const labels = cohortOrders?.[key];
                  if (Array.isArray(labels) && labels.length > 0) {
                    try {
                      const localKey = course.name
                        ? `cohort-order-${p.name}-${inst.name}-${course.name}`
                        : `cohort-order-${p.name}-${inst.name}`;
                      localStorage.setItem(localKey, JSON.stringify(labels));
                    } catch {
                      // ignore
                    }
                  }
                }
                // 하위 호환: 기존 cohort_order 키도 복원 시도
                const legacyKey = `cohort_order:${p.name}:${inst.name}`;
                const legacyLabels = cohortOrders?.[legacyKey];
                if (Array.isArray(legacyLabels) && legacyLabels.length > 0) {
                  try {
                    localStorage.setItem(`cohort-order-${p.name}-${inst.name}`, JSON.stringify(legacyLabels));
                  } catch {
                    // ignore
                  }
                }
              }
            }
          }
        } catch {
          // API 실패 시 localStorage만 사용
        }
        // localStorage에 저장된 강사 사진·수강생 수 복원 (서버에 없을 때만 적용)
        for (const p of platforms) {
          for (const inst of p.instructors) {
            try {
              const raw = localStorage.getItem(`instructor-photo-${p.name}-${inst.name}`);
              if (raw) {
                const parsed = JSON.parse(raw);
                // 서버에서 이미 복원된 사진이 있으면 덮어쓰지 않음
                if (!inst.photo && parsed.photo) {
                  inst.photo = parsed.photo;
                  inst.photoPosition = parsed.photoPosition || "center 2%";
                }
              }
            } catch {
              // ignore
            }
            for (const c of allCohorts(inst)) {
              try {
                const v = localStorage.getItem(`total-students-${p.name}-${inst.name}-${c.label}`);
                if (v && /^\d+$/.test(v)) c.totalStudents = parseInt(v, 10);
              } catch {
                // ignore
              }
            }
          }
        }
      }

      dispatch({ type: "HYDRATE", platforms });
    } catch (err) {
      console.error("Hierarchy load error:", err);
      dispatch({ type: "HYDRATE", platforms: DEFAULT_PLATFORMS });
    }
  }, []);

  const loadCohortData = useCallback(async (platformName: string, instructorName: string, courseName: string, cohortLabel: string) => {
    try {
      const params = new URLSearchParams({ platform: platformName, instructor: instructorName, course: courseName, cohort: cohortLabel });
      const res = await fetch(`/api/responses?${params}`);
      if (!res.ok) throw new Error("responses fetch failed");
      const data = await res.json();

      dispatch({
        type: "LOAD_COHORT_DATA",
        platformName,
        instructorName,
        courseName,
        cohortLabel,
        preResponses: data.preResponses || [],
        postResponses: data.postResponses || [],
      });
    } catch (err) {
      console.error("Cohort data load error:", err);
    }
  }, []);

  useEffect(() => {
    refreshHierarchy();
  }, [refreshHierarchy]);

  return React.createElement(
    AppContext.Provider,
    { value: { state, dispatch, loadCohortData, refreshHierarchy } },
    children
  );
}
