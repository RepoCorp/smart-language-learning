import { API_BASE, apiFetch } from "../../../../apiCore";

export interface BankWord {
  id: number;
  text: string;
  translation: string;
}

export interface BankWordPage {
  words: BankWord[];
  next_offset: number | null;
}

export async function fetchBankWords(definitionKey: string, strategyId: string, sourceLanguage: string,
  offset: number, signal: AbortSignal): Promise<BankWordPage> {
  const query = new URLSearchParams({ source_language: sourceLanguage, offset: String(offset) });
  const response = await apiFetch(`${API_BASE}/learning-content/${encodeURIComponent(definitionKey)}`
    + `/strategies/${encodeURIComponent(strategyId)}/words?${query}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Could not load bank words");
  const page = await response.json();
  if (!page || !Array.isArray(page.words) || !page.words.every((word: BankWord) => word
    && Number.isSafeInteger(word.id) && word.id > 0 && typeof word.text === "string"
    && typeof word.translation === "string")
    || !(page.next_offset === null || (Number.isSafeInteger(page.next_offset) && page.next_offset > offset))) {
    throw new Error("Invalid bank words response");
  }
  return page;
}
