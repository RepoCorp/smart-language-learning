export type ManageSection = "topics" | "words" | "phrases" | "patterns";

export function isManageSection(value: string | null): value is ManageSection {
  return value === "topics" || value === "words" || value === "phrases" || value === "patterns";
}
