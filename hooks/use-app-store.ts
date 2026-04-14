"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import type {
  Platform,
  Instructor,
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
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "APPLY_PHOTOS"; photos: Record<string, { photo: string; photoPosition: string; category: string }> }
  | { type: "DELETE_COURSE"; instructorId: string; courseId: string };

function findOrCreatePlatform(platforms: Platform[], name: string): Platform[] {
  if (platforms.find((p) => p.name === name)) return platforms;
  return [...platforms, { id: generateId(), name, instructors: [] }];
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "HYDRATE": {
      // 기존 state에서 사진 데이터를 보존 (refreshHierarchy 시 사진 소실 방지)
      const existingPhotos = new Map<string, { photo: string; photoPosition: string; category: string }>();
      for (const p of state.platforms) {
        for (const inst of p.instructors) {
          if (inst.photo) {
            existingPhotos.set(`${p.name}:${inst.name}`, {
              photo: inst.photo,
              photoPosition: inst.photoPosition,
              category: inst.category,
            });
          }
        }
      }
      const hydratedPlatforms = action.platforms.map((p) => ({
        ...p,
        instructors: p.instructors.map((inst) => {
          if (inst.photo) return inst;
          const saved = existingPhotos.get(`${p.name}:${inst.name}`);
          if (saved) {
            return { ...inst, photo: saved.photo, photoPosition: saved.photoPosition, category: saved.category || inst.category };
          }
          return inst;
        }),
      }));
      return { ...state, platforms: hydratedPlatforms, hydrated: true, loading: false };
    }

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
      const autoSelectCourse = inst && (inst.courses || []).length === 1 ? inst.courses[0].id : null;

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
                      dataLoaded: true,
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

    case "DELETE_COURSE": {
      const platforms = state.platforms.map((p) => ({
        ...p,
        instructors: p.instructors.map((i) =>
          i.id === action.instructorId
            ? { ...i, courses: i.courses.filter((c) => c.id !== action.courseId) }
            : i
        ),
      }));
      // 삭제된 강의가 선택 중이면 초기화
      const deletedCourseWasSelected = state.selectedCourseId === action.courseId;
      return {
        ...state,
        platforms,
        selectedCourseId: deletedCourseWasSelected ? null : state.selectedCourseId,
        selectedCohortId: deletedCourseWasSelected ? null : state.selectedCohortId,
      };
    }

    case "SET_PLATFORMS":
      return { ...state, platforms: action.platforms };

    case "SET_LOADING":
      return { ...state, loading: action.loading };

    case "APPLY_PHOTOS": {
      const platforms = state.platforms.map((p) => ({
        ...p,
        instructors: p.instructors.map((inst) => {
          if (inst.photo) return inst; // 이미 사진이 있으면 스킵
          const key = `instructor_photo:${p.name}:${inst.name}`;
          const pd = action.photos[key];
          if (pd?.photo) {
            return { ...inst, photo: pd.photo, photoPosition: pd.photoPosition || "center 2%", category: pd.category || inst.category };
          }
          return inst;
        }),
      }));
      return { ...state, platforms };
    }

    default:
      return state;
  }
}

// ---- Context ----
const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<Action>;
  loadCohortData: (platformName: string, instructorName: string, courseName: string, cohortLabel: string) => Promise<void>;
  loadBatchCohortData: (platformName: string, instructorName: string, cohorts: { course: string; cohort: string }[]) => Promise<void>;
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

// hierarchy API 응답 타입
interface HierarchyCohort { label: string; pm: string; preCount: number; postCount: number; startDate: string; endDate: string; totalStudents: number; hasPreSurvey?: boolean; hasPostSurvey?: boolean }
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
        preResponses: [],
        postResponses: [],
        preCount: aco.preCount || 0,
        postCount: aco.postCount || 0,
        hasPreSurvey: aco.hasPreSurvey ?? (aco.preCount > 0),
        hasPostSurvey: aco.hasPostSurvey ?? (aco.postCount > 0),
      })),
    })),
  };
}

// ---- Provider component ----

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 기수 단위 in-flight 요청 추적 (중복 fetch 방지)
  const inFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  const cohortKey = (p: string, i: string, c: string, co: string) => `${p}|${i}|${c}|${co}`;

  const refreshHierarchy = useCallback(async () => {
    try {
      // ★ hierarchy + 사진/설정을 병렬로 동시 fetch (워터폴 제거)
      const [hierarchyRes, settingsRes] = await Promise.all([
        fetch("/api/hierarchy", { cache: "no-store" }),
        fetch("/api/app-settings", { cache: "no-store" }).catch(() => null),
      ]);

      if (!hierarchyRes.ok) throw new Error(`hierarchy fetch failed: ${hierarchyRes.status}`);
      const data: HierarchyPlatform[] = await hierarchyRes.json();

      // 사진/설정 파싱 (실패해도 계속 진행)
      let instructorPhotos: Record<string, { photo?: string; photoPosition?: string; category?: string }> = {};
      let cohortOrders: Record<string, string[]> = {};
      if (settingsRes?.ok) {
        try {
          const json = await settingsRes.json();
          instructorPhotos = json.instructorPhotos || {};
          cohortOrders = json.cohortOrders || {};
        } catch { /* ignore */ }
      }

      // hierarchy API 데이터를 Platform[] 형태로 변환
      const platforms: Platform[] = DEFAULT_PLATFORMS.map((dp) => {
        const apiPlat = data.find((p) => p.name === dp.name);
        if (!apiPlat) return { ...dp, instructors: [] };
        return { ...dp, instructors: apiPlat.instructors.map(buildInstructor) };
      });

      // API에서 온 플랫폼 중 DEFAULT에 없는 것 추가
      for (const apiPlat of data) {
        if (!platforms.find((p) => p.name === apiPlat.name)) {
          platforms.push({ id: generateId(), name: apiPlat.name, instructors: apiPlat.instructors.map(buildInstructor) });
        }
      }

      // 사진 + localStorage 데이터 머지 (별도 dispatch 없이 한 번에)
      const photosToSync: { platform: string; instructor: string; photo: string; photoPosition: string; category: string }[] = [];

      if (typeof window !== "undefined") {
        for (const p of platforms) {
          for (const inst of p.instructors) {
            // 사진 적용: 서버 → localStorage 폴백
            const photoKey = `instructor_photo:${p.name}:${inst.name}`;
            const pd = instructorPhotos[photoKey];
            if (pd?.photo) {
              inst.photo = pd.photo;
              inst.photoPosition = pd.photoPosition || "center 2%";
              if (pd.category) inst.category = pd.category;
            } else {
              try {
                const raw = localStorage.getItem(`instructor-photo-${p.name}-${inst.name}`);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed.photo) {
                    inst.photo = parsed.photo;
                    inst.photoPosition = parsed.photoPosition || "center 2%";
                    if (parsed.category) inst.category = parsed.category;
                    // ★ 서버에 없고 localStorage에만 있는 사진 → 동기화 대상
                    photosToSync.push({
                      platform: p.name,
                      instructor: inst.name,
                      photo: parsed.photo,
                      photoPosition: parsed.photoPosition || "center 2%",
                      category: parsed.category || "",
                    });
                  }
                }
              } catch { /* ignore */ }
            }

            // 수강생 수 복원
            for (const c of allCohorts(inst)) {
              try {
                const v = localStorage.getItem(`total-students-${p.name}-${inst.name}-${c.label}`);
                if (v && /^\d+$/.test(v)) c.totalStudents = parseInt(v, 10);
              } catch { /* ignore */ }
            }

            // 기수 순서 localStorage 복원
            for (const course of inst.courses) {
              const keySuffix = course.name ? `:${course.name}` : "";
              const orderKey = `cohort_order:${p.name}:${inst.name}${keySuffix}`;
              const labels = cohortOrders[orderKey];
              if (Array.isArray(labels) && labels.length > 0) {
                try {
                  const localKey = course.name
                    ? `cohort-order-${p.name}-${inst.name}-${course.name}`
                    : `cohort-order-${p.name}-${inst.name}`;
                  localStorage.setItem(localKey, JSON.stringify(labels));
                } catch { /* ignore */ }
              }
            }
            const legacyKey = `cohort_order:${p.name}:${inst.name}`;
            const legacyLabels = cohortOrders[legacyKey];
            if (Array.isArray(legacyLabels) && legacyLabels.length > 0) {
              try { localStorage.setItem(`cohort-order-${p.name}-${inst.name}`, JSON.stringify(legacyLabels)); } catch { /* ignore */ }
            }
          }
        }
      }

      dispatch({ type: "HYDRATE", platforms });

      // ★ localStorage에만 있는 사진을 백그라운드로 서버에 병렬 동기화
      if (photosToSync.length > 0) {
        Promise.all(
          photosToSync.map((item) =>
            fetch("/api/app-settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "instructor_photo",
                platform: item.platform,
                instructor: item.instructor,
                photo: item.photo,
                photoPosition: item.photoPosition,
                category: item.category,
              }),
            }).catch(() => { /* 백그라운드 동기화 실패 무시 */ })
          )
        );
        console.info(`[사진 동기화] localStorage → 서버: ${photosToSync.map((s) => s.instructor).join(", ")}`);
      }
    } catch (err) {
      console.error("[ClassInsight] Hierarchy load error:", err);
      dispatch({ type: "HYDRATE", platforms: DEFAULT_PLATFORMS });
    }
  }, []);

  // 단건 조회 (하위 호환)
  const loadCohortData = useCallback(async (platformName: string, instructorName: string, courseName: string, cohortLabel: string) => {
    const key = cohortKey(platformName, instructorName, courseName, cohortLabel);
    const existing = inFlightRef.current.get(key);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const params = new URLSearchParams({ platform: platformName, instructor: instructorName, course: courseName, cohort: cohortLabel });
        const res = await fetch(`/api/responses?${params}`);
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.warn(`responses fetch failed (${res.status}): ${platformName}/${instructorName}/${courseName}/${cohortLabel}`, body);
          return;
        }
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
        console.warn("Cohort data load error:", err);
      } finally {
        inFlightRef.current.delete(key);
      }
    })();
    inFlightRef.current.set(key, promise);
    return promise;
  }, []);

  // 일괄 조회 (한 번의 API 호출로 여러 기수 데이터 로딩)
  const loadBatchCohortData = useCallback(async (platformName: string, instructorName: string, cohorts: { course: string; cohort: string }[]) => {
    if (cohorts.length === 0) return;

    // 이미 in-flight인 항목 분리
    const pending: { course: string; cohort: string }[] = [];
    const alreadyInFlight: Promise<void>[] = [];
    for (const c of cohorts) {
      const key = cohortKey(platformName, instructorName, c.course, c.cohort);
      const existing = inFlightRef.current.get(key);
      if (existing) {
        alreadyInFlight.push(existing);
      } else {
        pending.push(c);
      }
    }

    if (pending.length === 0) {
      await Promise.all(alreadyInFlight);
      return;
    }

    // 남은 것이 단건이면 GET 위임 (loadCohortData가 dedup 처리)
    if (pending.length === 1) {
      await Promise.all([
        loadCohortData(platformName, instructorName, pending[0].course, pending[0].cohort),
        ...alreadyInFlight,
      ]);
      return;
    }

    // 배치 POST
    const batchPromise = (async () => {
      try {
        const res = await fetch("/api/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: platformName, instructor: instructorName, cohorts: pending }),
        });
        if (!res.ok) {
          console.warn(`batch responses fetch failed (${res.status})`);
          return;
        }
        const data = await res.json();
        for (const item of data.results || []) {
          dispatch({
            type: "LOAD_COHORT_DATA",
            platformName,
            instructorName,
            courseName: item.course,
            cohortLabel: item.cohort,
            preResponses: item.preResponses || [],
            postResponses: item.postResponses || [],
          });
        }
      } catch (err) {
        console.warn("Batch cohort data load error:", err);
      }
    })();

    // pending 각 항목을 in-flight로 등록
    for (const c of pending) {
      inFlightRef.current.set(cohortKey(platformName, instructorName, c.course, c.cohort), batchPromise);
    }

    try {
      await Promise.all([batchPromise, ...alreadyInFlight]);
    } finally {
      for (const c of pending) {
        const key = cohortKey(platformName, instructorName, c.course, c.cohort);
        if (inFlightRef.current.get(key) === batchPromise) {
          inFlightRef.current.delete(key);
        }
      }
    }
  }, [loadCohortData]);

  useEffect(() => {
    refreshHierarchy();
  }, [refreshHierarchy]);

  return React.createElement(
    AppContext.Provider,
    { value: { state, dispatch, loadCohortData, loadBatchCohortData, refreshHierarchy } },
    children
  );
}
