"use client";

import {
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
  AnalysisResult,
  NoteData,
} from "@/lib/types";
import { generateId } from "@/lib/types";
import { DEFAULT_PLATFORMS } from "@/lib/constants";
import { loadPlatforms, savePlatforms } from "@/lib/storage";

// ---- State ----
export interface AppState {
  platforms: Platform[];
  selectedPlatformId: string | null;
  selectedInstructorId: string | null;
  selectedCohortId: string | null;
  activeTab: string;
  hydrated: boolean;
}

const initialState: AppState = {
  platforms: DEFAULT_PLATFORMS,
  selectedPlatformId: null,
  selectedInstructorId: null,
  selectedCohortId: null,
  activeTab: "overview",
  hydrated: false,
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
  | { type: "UPDATE_INSTRUCTOR"; instructor: Instructor }
  | { type: "DELETE_INSTRUCTOR"; id: string }
  | { type: "UPDATE_COHORT"; instructorId: string; cohort: Cohort }
  | { type: "DELETE_COHORT"; instructorId: string; cohortId: string }
  | { type: "SET_PLATFORMS"; platforms: Platform[] };

function findOrCreatePlatform(platforms: Platform[], name: string): Platform[] {
  if (platforms.find((p) => p.name === name)) return platforms;
  return [...platforms, { id: generateId(), name, instructors: [] }];
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, platforms: action.platforms, hydrated: true };

    case "SELECT_PLATFORM":
      return {
        ...state,
        selectedPlatformId: action.id,
        selectedInstructorId: null,
        selectedCohortId: null,
        activeTab: "overview",
      };

    case "SELECT_INSTRUCTOR":
      return {
        ...state,
        selectedInstructorId: action.id,
        selectedCohortId: null,
        activeTab: "overview",
      };

    case "SELECT_COHORT":
      return { ...state, selectedCohortId: action.id, activeTab: "overview" };

    case "SET_TAB":
      return { ...state, activeTab: action.tab };

    case "ADD_RESPONSES": {
      let platforms = [...state.platforms.map((p) => ({ ...p, instructors: [...p.instructors] }))];

      // Find or create platform
      platforms = findOrCreatePlatform(platforms, action.platformName);
      const platIdx = platforms.findIndex((p) => p.name === action.platformName);
      const plat = { ...platforms[platIdx], instructors: [...platforms[platIdx].instructors] };

      // Find or create instructor
      let instIdx = plat.instructors.findIndex((i) => i.name === action.instructorName);
      if (instIdx < 0) {
        plat.instructors.push({
          id: generateId(),
          name: action.instructorName,
          category: action.instructorCategory || "",
          photo: "",
          cohorts: [],
        });
        instIdx = plat.instructors.length - 1;
      }
      const inst = { ...plat.instructors[instIdx], cohorts: [...plat.instructors[instIdx].cohorts] };

      // Find or create cohort
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

      // Add responses
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

    default:
      return state;
  }
}

// ---- Context ----
const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<Action>;
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

// ---- Provider component (to be used in page.tsx) ----
import React from "react";

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const saved = loadPlatforms();
    if (saved && saved.length > 0) {
      dispatch({ type: "HYDRATE", platforms: saved });
    } else {
      dispatch({ type: "HYDRATE", platforms: DEFAULT_PLATFORMS });
    }
  }, []);

  useEffect(() => {
    if (state.hydrated) {
      const ok = savePlatforms(state.platforms);
      if (!ok) {
        console.warn("[ClassInsight] 데이터 저장 실패 - localStorage 용량 초과");
      }
    }
  }, [state.platforms, state.hydrated]);

  return React.createElement(
    AppContext.Provider,
    { value: { state, dispatch } },
    children
  );
}
