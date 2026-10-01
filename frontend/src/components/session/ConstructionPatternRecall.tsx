import { useI18n } from "../../i18n";
import type { SessionItem } from "../../types";

const QUESTIONS = {
  en: "Do you know this pattern?",
  es: "¿Conoces este patrón?",
};

export default function ConstructionPatternRecall({ item, revealed }: { item: SessionItem; revealed: boolean }): JSX.Element {
  const { language } = useI18n();
  const recognition = item.direction === "de_to_es";
  return <>
    <p>{QUESTIONS[language]}</p>
    <p className="word-formation-match">{recognition ? item.german_text : item.notes}</p>
    {revealed && <>
      <p>{recognition ? item.notes : item.german_text}</p>
      <p>{item.example_sentence}</p>
    </>}
  </>;
}
