import { useEffect, useState } from "react";

import { useI18n } from "../../i18n";
import GrammarMethodologyFooter from "./GrammarMethodologyFooter";
import type { GermanGrammarNounExample, StudyLanguageCode } from "../../types";
import PhraseGrammarPanel from "./PhraseGrammarPanel";
import type { ItemStrategiesModalProps } from "./itemStrategyTypes";
import type { PhraseGrammarStrategy } from "./phraseGrammarTypes";
import StaticGrammarTable, { type StaticGrammarRow } from "./StaticGrammarTable";

type NounGender = "masculine" | "feminine" | "neuter";
const GENDERS: NounGender[] = ["masculine", "feminine", "neuter"];

const GENDER_BY_ARTICLE: Record<string, NounGender> = {
  der: "masculine",
  die: "feminine",
  das: "neuter",
};

const CASE_ARTICLES: Record<NounGender, [string, string, string, string]> = {
  masculine: ["der", "den", "dem", "des"],
  feminine: ["die", "die", "der", "der"],
  neuter: ["das", "das", "dem", "des"],
};

const PRONOUN_BY_GENDER: Record<NounGender, string> = {
  masculine: "er",
  feminine: "sie",
  neuter: "es",
};

const ADJECTIVE_BY_GENDER: Record<NounGender, { determiner: string; adjective: string }> = {
  masculine: { determiner: "ein", adjective: "guter" },
  feminine: { determiner: "eine", adjective: "gute" },
  neuter: { determiner: "ein", adjective: "gutes" },
};

function parseGermanNoun(targetText: string): { noun: string; gender: NounGender } | null {
  const [article = "", ...nounParts] = targetText.trim().split(/\s+/);
  const gender = GENDER_BY_ARTICLE[article.toLowerCase()];
  const noun = nounParts.join(" ");
  return gender && noun ? { noun, gender } : null;
}

export default function GrammarStrategyPanel({
  wordType,
  targetLanguage,
  targetText,
  pluralGerman,
  examples,
  isLoadingExamples,
  itemType,
  phraseGrammar,
  onAskAboutPhraseGrammarRule,
  onOpenPhraseGrammarExample,
  phraseGrammarLoop,
}: {
  wordType: string;
  targetLanguage: StudyLanguageCode;
  targetText: string;
  pluralGerman: string;
  examples: Partial<Record<NounGender, GermanGrammarNounExample>>;
  isLoadingExamples: boolean;
  itemType: "word" | "phrase";
  phraseGrammar: PhraseGrammarStrategy;
  onAskAboutPhraseGrammarRule: (question: string, grammarFeatureKey: string) => void;
  onOpenPhraseGrammarExample: (itemId: number) => void;
  phraseGrammarLoop: ItemStrategiesModalProps["phraseGrammarLoop"];
}): JSX.Element {
  const { t } = useI18n();
  const noun = wordType.trim().toLowerCase() === "noun" && targetLanguage === "german"
    ? parseGermanNoun(targetText)
    : null;
  const isGermanVerb = wordType.trim().toLowerCase() === "verb" && targetLanguage === "german";
  const isGermanAdjective = wordType.trim().toLowerCase() === "adjective" && targetLanguage === "german";
  const isGermanAdverb = wordType.trim().toLowerCase() === "adverb" && targetLanguage === "german";
  const [selectedGender, setSelectedGender] = useState<NounGender>(noun?.gender || "masculine");
  useEffect(() => {
    if (noun) {
      setSelectedGender(noun.gender);
    }
  }, [noun?.gender]);

  if (itemType === "phrase") {
    return <PhraseGrammarPanel targetLanguage={targetLanguage} targetText={targetText} phraseGrammar={phraseGrammar} onAskAboutRule={onAskAboutPhraseGrammarRule} onOpenItem={onOpenPhraseGrammarExample} loop={phraseGrammarLoop} />;
  }

  if (isGermanVerb) {
    return <VerbGrammarTable />;
  }
  if (isGermanAdjective) {
    return <AdjectiveGrammarTable />;
  }
  if (isGermanAdverb) {
    return <AdverbGrammarTable />;
  }

  if (!noun) {
    return (
      <div className="word-strategies-placeholder-card grammar-strategy-panel">
        <p className="word-strategies-placeholder-title"><strong>{t("strategies.grammar.title")}</strong></p>
        <GrammarMethodologyFooter />
      </div>
    );
  }

  const currentExample: GermanGrammarNounExample = {
    target_text: targetText,
    source_text: "",
    plural_german: pluralGerman,
  };
  const availableExamples = { ...examples, [noun.gender]: currentExample };
  const selectedExample = availableExamples[selectedGender];
  const selectedNoun = selectedExample ? parseGermanNoun(selectedExample.target_text) : null;

  if (!selectedExample || !selectedNoun) {
    return (
      <div className="grammar-strategy-panel">
        <GenderTabs selectedGender={selectedGender} sourceGender={noun.gender} availableExamples={availableExamples} onSelect={setSelectedGender} />
        <p className="hint">{isLoadingExamples ? t("dialogs.loading") : t("strategies.grammar.genderUnavailable")}</p>
        <GrammarMethodologyFooter />
      </div>
    );
  }

  const articles = CASE_ARTICLES[selectedNoun.gender];
  const genderLabel = t(`strategies.grammar.gender.${selectedNoun.gender}`);
  const adjective = ADJECTIVE_BY_GENDER[selectedNoun.gender];
  const pronoun = PRONOUN_BY_GENDER[selectedNoun.gender];

  return (
    <div className="grammar-strategy-panel">
      <GenderTabs selectedGender={selectedGender} sourceGender={noun.gender} availableExamples={availableExamples} onSelect={setSelectedGender} />
      <div className="grammar-strategy-table-wrap">
        <table className="grammar-strategy-table">
          <thead>
            <tr>
              <th>{t("strategies.grammar.topic")}</th>
              <th>{t("strategies.grammar.example")}</th>
              <th>{t("strategies.grammar.note")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>{t("strategies.grammar.gender")}</th>
              <td><strong>{genderLabel}</strong></td>
              <td>{t("strategies.grammar.genderNote", { noun: selectedExample.target_text })}</td>
            </tr>
            <tr>
              <th>{t("strategies.grammar.article")}</th>
              <td><strong>{selectedExample.target_text}</strong></td>
              <td>{t("strategies.grammar.genderArticlesNote")}</td>
            </tr>
            <tr>
              <th>{t("strategies.grammar.plural")}</th>
              <td><strong>{selectedExample.plural_german || t("strategies.grammar.unavailable")}</strong></td>
              <td>{t("strategies.grammar.pluralNote")}</td>
            </tr>
            <tr>
              <th>{t("strategies.grammar.pronoun")}</th>
              <td><strong>{pronoun}</strong> ist gut</td>
              <td>{t("strategies.grammar.pronounNote", { pronoun })}</td>
            </tr>
            <tr>
              <th>{t("strategies.grammar.cases")}</th>
              <td>
                <strong>{t("strategies.grammar.nominative")}:</strong> {articles[0]} {selectedNoun.noun}<br />
                <strong>{t("strategies.grammar.accusative")}:</strong> {articles[1]} {selectedNoun.noun}<br />
                <strong>{t("strategies.grammar.dative")}:</strong> {articles[2]} {selectedNoun.noun}<br />
                <strong>{t("strategies.grammar.genitive")}:</strong> {articles[3]} {selectedNoun.noun}
              </td>
              <td>{t("strategies.grammar.casesNote")}</td>
            </tr>
            <tr>
              <th>{t("strategies.grammar.withAdjective")}</th>
              <td>{adjective.determiner} <strong>{adjective.adjective}</strong> {selectedNoun.noun}</td>
              <td>{t("strategies.grammar.adjectiveNote")}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <GrammarMethodologyFooter />
    </div>
  );
}

function VerbGrammarTable(): JSX.Element {
  const { t } = useI18n();
  const rows: StaticGrammarRow[] = [
    { topic: t("strategies.grammar.verbInfinitive"), example: <>spiel<strong>en</strong></>, note: t("strategies.grammar.verbInfinitiveNote") },
    { topic: t("strategies.grammar.verbStem"), example: <strong>spiel-</strong>, note: t("strategies.grammar.verbStemNote") },
    { topic: t("strategies.grammar.verbPresent"), example: "spiel- + ending", note: t("strategies.grammar.verbPresentNote") },
    { topic: t("strategies.grammar.verbPerfect"), example: <>haben + <strong>gespielt</strong></>, note: t("strategies.grammar.verbPerfectNote") },
    { topic: t("strategies.grammar.verbSimplePast"), example: <>spiel- + <strong>te</strong></>, note: t("strategies.grammar.verbSimplePastNote") },
    { topic: t("strategies.grammar.verbFuture"), example: <>werden + <strong>spielen</strong></>, note: t("strategies.grammar.verbFutureNote") },
  ];
  return <StaticGrammarTable rows={rows} />;
}

function AdjectiveGrammarTable(): JSX.Element {
  const { t } = useI18n();
  const rows: StaticGrammarRow[] = [
    { topic: t("strategies.grammar.adjectiveWhatItDoes"), example: <>ein <strong>guter</strong> Hund</>, note: t("strategies.grammar.adjectiveWhatItDoesNote") },
    { topic: t("strategies.grammar.adjectiveAfterVerb"), example: <>Der Hund ist <strong>gut</strong>.</>, note: t("strategies.grammar.adjectiveAfterVerbNote") },
    { topic: t("strategies.grammar.adjectiveBeforeNoun"), example: <>ein <strong>guter</strong> Hund</>, note: t("strategies.grammar.adjectiveBeforeNounNote") },
  ];
  return <StaticGrammarTable rows={rows} />;
}

function AdverbGrammarTable(): JSX.Element {
  const { t } = useI18n();
  const rows: StaticGrammarRow[] = [
    { topic: t("strategies.grammar.adverbWhatItDoes"), example: <>Er läuft <strong>schnell</strong>.</>, note: t("strategies.grammar.adverbWhatItDoesNote") },
    { topic: t("strategies.grammar.adverbForm"), example: <strong>schnell</strong>, note: t("strategies.grammar.adverbFormNote") },
  ];
  return <StaticGrammarTable rows={rows} />;
}

function GenderTabs({
  selectedGender,
  sourceGender,
  availableExamples,
  onSelect,
}: {
  selectedGender: NounGender;
  sourceGender: NounGender;
  availableExamples: Partial<Record<NounGender, GermanGrammarNounExample>>;
  onSelect: (gender: NounGender) => void;
}): JSX.Element {
  const { t } = useI18n();
  const genders = [sourceGender, ...GENDERS.filter((gender) => gender !== sourceGender)];
  return (
    <div className="grammar-strategy-tabs" role="tablist" aria-label={t("strategies.grammar.gender")}> 
      {genders.map((gender) => (
        <button key={gender} type="button" role="tab" className={`grammar-strategy-tab ${selectedGender === gender ? "grammar-strategy-tab-active" : ""} ${sourceGender === gender ? "grammar-strategy-tab-origin" : ""} ${!availableExamples[gender] ? "grammar-strategy-tab-unavailable" : ""}`} aria-selected={selectedGender === gender} onClick={() => onSelect(gender)}>
          {t(`strategies.grammar.gender.${gender}`)}
        </button>
      ))}
    </div>
  );
}
