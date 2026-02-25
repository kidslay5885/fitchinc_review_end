import type { Cohort } from "./types";

const KEY = (platform: string, instructor: string, courseName: string = "") =>
  `cohort-order-${platform}-${instructor}${courseName ? `-${courseName}` : ""}`;

export function getCohortOrder(platformName: string, instructorName: string, courseName: string = ""): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY(platformName, instructorName, courseName));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) && arr.every((x) => typeof x === "string") ? arr : [];
  } catch {
    return [];
  }
}

export function setCohortOrder(
  platformName: string,
  instructorName: string,
  courseName: string = "",
  labels: string[]
): void {
  try {
    localStorage.setItem(KEY(platformName, instructorName, courseName), JSON.stringify(labels));
  } catch {
    // ignore
  }
}

export function getOrderedCohorts(
  platformName: string,
  instructorName: string,
  courseName: string = "",
  cohorts: Cohort[]
): Cohort[] {
  const order = getCohortOrder(platformName, instructorName, courseName);
  if (order.length === 0) return [...cohorts];
  const byLabel = new Map(cohorts.map((c) => [c.label, c]));
  const result: Cohort[] = [];
  for (const label of order) {
    const c = byLabel.get(label);
    if (c) {
      result.push(c);
      byLabel.delete(label);
    }
  }
  byLabel.forEach((c) => result.push(c));
  return result;
}
