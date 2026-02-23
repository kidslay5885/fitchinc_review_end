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
  Cohort,
  SurveyResponse,
} from "@/lib/types";
import { generateId } from "@/lib/types";
import { DEFAULT_PLATFORMS } from "@/lib/constants";

// ---- State ----
export interface AppState {
  platforms: Platform[];
  selectedPlatformId: string | null;
  selectedInstructorId: string | null;
  selectedCohortId: string | null;
  activeTab: string;
  hydrated: boolean;
  loading: boolean;
}

const initialState: AppState = {
  platforms: DEFAULT_PLATFORMS,
  selectedPlatformId: null,
  selectedInstructorId: null,
  selectedCohortId: null,
  activeTab: "feedback",
  hydrated: false,
  loading: true,
};

// ---- Actions ----
type Action =
  | { type: "HYDRATE"; platforms: Platform[] }
  | { type: "SELECT_PLATFORM"; id: string | null }
  | { type: "SELECT_INSTRUCTOR"; id: string | null }
  | { type: "SELECT_COHORT"; id: string | null }
  | { type: "SET_TAB"; tab: string }
  | {
      type: "ADD_RESPONSES";
      platformName: string;
      instructorName: string;
      cohortLabel: string;
      surveyType: "사전" | "후기";
      responses: SurveyResponse[];
      instructorCategory?: string;
    }
  | { type: "LOAD_COHORT_DATA"; platformName: string; instructorName: string; cohortLabel: string; preResponses: SurveyResponse[]; postResponses: SurveyResponse[] }
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
        selectedCohortId: null,
        activeTab: "feedback",
      };

    case "SELECT_INSTRUCTOR":
      return {
        ...state,
        selectedInstructorId: action.id,
        selectedCohortId: null,
        activeTab: "feedback",
      };

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
          photoPosition: "center center",
          cohorts: [],
        });
        instIdx = plat.instructors.length - 1;
      }
      const inst = { ...plat.instructors[instIdx], cohorts: [...plat.instructors[instIdx].cohorts] };

      let coIdx = inst.cohorts.findIndex((c) => c.label === action.cohortLabel);
      if (coIdx < 0) {
        inst.cohorts.push({
          id: generateId(),
          label: action.cohortLabel,
          pm: "",
          date: "",
          endDate: "",
          totalStudents: 0,
          preResponses: [],
          postResponses: [],
        });
        coIdx = inst.cohorts.length - 1;
      }
      const cohort = { ...inst.cohorts[coIdx] };

      if (action.surveyType === "사전") {
        cohort.preResponses = [...cohort.preResponses, ...action.responses];
      } else {
        cohort.postResponses = [...cohort.postResponses, ...action.responses];
      }

      inst.cohorts[coIdx] = cohort;
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
              cohorts: i.cohorts.map((c) => {
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
                cohorts: i.cohorts.map((c) =>
                  c.id === action.cohort.id ? action.cohort : c
                ),
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
            ? { ...i, cohorts: i.cohorts.filter((c) => c.id !== action.cohortId) }
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
  loadCohortData: (platformName: string, instructorName: string, cohortLabel: string) => Promise<void>;
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

export function useSelectedCohort() {
  const inst = useSelectedInstructor();
  const { state } = useAppStore();
  if (!inst || !state.selectedCohortId) return null;
  return inst.cohorts.find((c) => c.id === state.selectedCohortId) || null;
}

// ---- Provider component ----

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refreshHierarchy = useCallback(async () => {
    try {
      const res = await fetch("/api/hierarchy");
      if (!res.ok) throw new Error("hierarchy fetch failed");
      const data = await res.json();

      // hierarchy API 데이터를 Platform[] 형태로 변환
      const platforms: Platform[] = DEFAULT_PLATFORMS.map((dp) => {
        const apiPlat = data.find((p: { name: string }) => p.name === dp.name);
        if (!apiPlat) return { ...dp, instructors: [] };

        return {
          ...dp,
          instructors: apiPlat.instructors.map((ai: { name: string; cohorts: { label: string; pm: string; preCount: number; postCount: number; startDate: string; endDate: string; totalStudents: number }[] }) => ({
            id: generateId(),
            name: ai.name,
            category: "",
            photo: "",
            photoPosition: "center center",
            cohorts: ai.cohorts.map((ac: { label: string; pm: string; preCount: number; postCount: number; startDate: string; endDate: string; totalStudents: number }) => ({
              id: generateId(),
              label: ac.label,
              pm: ac.pm || "",
              date: ac.startDate || "",
              endDate: ac.endDate || "",
              totalStudents: ac.totalStudents || 0,
              preResponses: Array(ac.preCount || 0).fill(null).map(() => ({ id: generateId(), name: "", gender: "", age: "", job: "", hours: "", channel: "", computer: 0, goal: "", hopePlatform: "", hopeInstructor: "", ps1: 0, ps2: 0, pSat: "", pFmt: "", pFree: "", pRec: "", rawData: {} })),
              postResponses: Array(ac.postCount || 0).fill(null).map(() => ({ id: generateId(), name: "", gender: "", age: "", job: "", hours: "", channel: "", computer: 0, goal: "", hopePlatform: "", hopeInstructor: "", ps1: 0, ps2: 0, pSat: "", pFmt: "", pFree: "", pRec: "", rawData: {} })),
            })),
          })),
        };
      });

      // API에서 온 플랫폼 중 DEFAULT에 없는 것 추가
      for (const apiPlat of data) {
        if (!platforms.find((p) => p.name === apiPlat.name)) {
          platforms.push({
            id: generateId(),
            name: apiPlat.name,
            instructors: apiPlat.instructors.map((ai: { name: string; cohorts: { label: string; pm: string; preCount: number; postCount: number; startDate: string; endDate: string; totalStudents: number }[] }) => ({
              id: generateId(),
              name: ai.name,
              category: "",
              photo: "",
              photoPosition: "center center",
              cohorts: ai.cohorts.map((ac: { label: string; pm: string; preCount: number; postCount: number; startDate: string; endDate: string; totalStudents: number }) => ({
                id: generateId(),
                label: ac.label,
                pm: ac.pm || "",
                date: ac.startDate || "",
                endDate: ac.endDate || "",
                totalStudents: ac.totalStudents || 0,
                preResponses: Array(ac.preCount || 0).fill(null).map(() => ({ id: generateId(), name: "", gender: "", age: "", job: "", hours: "", channel: "", computer: 0, goal: "", hopePlatform: "", hopeInstructor: "", ps1: 0, ps2: 0, pSat: "", pFmt: "", pFree: "", pRec: "", rawData: {} })),
                postResponses: Array(ac.postCount || 0).fill(null).map(() => ({ id: generateId(), name: "", gender: "", age: "", job: "", hours: "", channel: "", computer: 0, goal: "", hopePlatform: "", hopeInstructor: "", ps1: 0, ps2: 0, pSat: "", pFmt: "", pFree: "", pRec: "", rawData: {} })),
              })),
            })),
          });
        }
      }

      dispatch({ type: "HYDRATE", platforms });
    } catch (err) {
      console.error("Hierarchy load error:", err);
      dispatch({ type: "HYDRATE", platforms: DEFAULT_PLATFORMS });
    }
  }, []);

  const loadCohortData = useCallback(async (platformName: string, instructorName: string, cohortLabel: string) => {
    try {
      const params = new URLSearchParams({ platform: platformName, instructor: instructorName, cohort: cohortLabel });
      const res = await fetch(`/api/responses?${params}`);
      if (!res.ok) throw new Error("responses fetch failed");
      const data = await res.json();

      dispatch({
        type: "LOAD_COHORT_DATA",
        platformName,
        instructorName,
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
