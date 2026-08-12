import { useEffect, useState } from "react";

import { useI18n } from "../../i18n";
import type { GermanGrammarNounExample, StudyLanguageCode } from "../../types";

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
}: {
  wordType: string;
  targetLanguage: StudyLanguageCode;
  targetText: string;
  pluralGerman: string;
  examples: Partial<Record<NounGender, GermanGrammarNounExample>>;
  isLoadingExamples: boolean;
}): JSX.Element {
  const { t } = useI18n();
  const noun = wordType.trim().toLowerCase() === "noun" && targetLanguage === "german"
    ? parseGermanNoun(targetText)
    : null;
  const [selectedGender, setSelectedGender] = useState<NounGender>(noun?.gender || "masculine");
  useEffect(() => {
    if (noun) {
      setSelectedGender(noun.gender);
    }
  }, [noun?.gender]);

  if (!noun) {
    return (
      <div className="word-strategies-placeholder-card grammar-strategy-panel">
        <p className="word-strategies-placeholder-title"><strong>{t("strategies.grammar.title")}</strong></p>
        <p>{t("strategies.grammar.description")}</p>
        <p className="hint grammar-strategy-footnote">{t("strategies.grammar.footnote")}</p>
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
        <p className="grammar-strategy-intro">{t("strategies.grammar.description")}</p>
        <GenderTabs selectedGender={selectedGender} sourceGender={noun.gender} availableExamples={availableExamples} onSelect={setSelectedGender} />
        <p className="hint">{isLoadingExamples ? t("dialogs.loading") : t("strategies.grammar.genderUnavailable")}</p>
        <p className="hint grammar-strategy-footnote">{t("strategies.grammar.footnote")}</p>
      </div>
    );
  }

  const articles = CASE_ARTICLES[selectedNoun.gender];
  const genderLabel = t(`strategies.grammar.gender.${selectedNoun.gender}`);
  const adjective = ADJECTIVE_BY_GENDER[selectedNoun.gender];
  const pronoun = PRONOUN_BY_GENDER[selectedNoun.gender];

  return (
    <div className="grammar-strategy-panel">
      <p className="grammar-strategy-intro">{t("strategies.grammar.description")}</p>
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
      <p className="hint grammar-strategy-footnote">{t("strategies.grammar.footnote")}</p>
    </div>
  );
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
