import { useEffect, useState, type ReactElement } from "react";
import { useI18n, type AppLanguage } from "../../../../i18n";
import type { LearningDefinition } from "../../definition";
import { locales } from "../../locales";
import { fetchBankWords, type BankWord } from "./api";
import "./BankWords.css";

interface Props {
  definition: LearningDefinition;
  strategyId: string;
  sourceLanguage: string;
  interfaceLanguage?: AppLanguage;
}

export default function BankWords(props: Props): ReactElement {
  return <BankWordList key={JSON.stringify([props.definition.key, props.strategyId, props.sourceLanguage])} {...props} />;
}

function BankWordList({ definition, strategyId, sourceLanguage, interfaceLanguage }: Props): ReactElement {
  const { language } = useI18n();
  const text = locales[interfaceLanguage ?? language];
  const [words, setWords] = useState<BankWord[]>([]);
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void fetchBankWords(definition.key, strategyId, sourceLanguage, offset, controller.signal).then(page => {
      if (controller.signal.aborted) return;
      setWords(previous => offset === 0 ? page.words : [...previous, ...page.words.filter(
        word => !previous.some(existing => existing.id === word.id))]);
      setNextOffset(page.next_offset);
      setStatus("ready");
    }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [definition.key, strategyId, sourceLanguage, offset, attempt]);

  return <section className="bank-words" aria-label={text.yourWords}>
    <h3>{text.yourWords}</h3>
    {words.length > 0 && <ul className="bank-words__list">
      {words.map(word => <li key={word.id}>
        <strong>{word.text}</strong>
        <span className="bank-words__translation">{word.translation}</span>
      </li>)}
    </ul>}
    {status === "loading" && <p role="status">{text.bankWordsLoading}</p>}
    {status === "error" && <>
      <p role="alert">{text.bankWordsError}</p>
      <button type="button" onClick={() => { setStatus("loading"); setAttempt(value => value + 1); }}>{text.tryAgain}</button>
    </>}
    {status === "ready" && words.length === 0 && <p>{text.bankWordsEmpty}</p>}
    {status === "ready" && nextOffset !== null && <button type="button"
      onClick={() => { setStatus("loading"); setOffset(nextOffset); }}>{text.showMoreWords}</button>}
  </section>;
}
