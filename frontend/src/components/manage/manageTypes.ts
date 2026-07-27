export type ManageSection = "topics" | "words" | "phrases";
export type ManageReviewState = "all" | "new";

export function isManageSection(value: string | null): value is ManageSection {
  return value === "topics" || value === "words" || value === "phrases";
}

export function isManageReviewState(value: string | null): value is ManageReviewState {
  return value === "all" || value === "new";
}
