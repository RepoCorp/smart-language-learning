import type { ExercisePhraseSection, StudyLanguageCode } from "../../types";
import type { NounGender } from "./useGrammarExamples";

type DeterminerFamily = "definite" | "indefinite" | "negative" | "possessive" | "demonstrative";
type NounCase = "nominative" | "accusative" | "dative" | "genitive";

type ReferenceNoun = {
  gender: NounGender;
  target: string;
  plural: string;
  noun: string;
  genitiveNoun: string;
  dativeTarget: (determiner: string) => string;
  spanish: Record<DeterminerFamily, string>;
  english: Record<DeterminerFamily, string>;
};

const FAMILIES: DeterminerFamily[] = ["definite", "indefinite", "negative", "possessive", "demonstrative"];

const ARTICLES: Record<NounGender, Record<NounCase, Record<DeterminerFamily, string>>> = {
  masculine: {
    nominative: { definite: "der", indefinite: "ein", negative: "kein", possessive: "mein", demonstrative: "dieser" },
    accusative: { definite: "den", indefinite: "einen", negative: "keinen", possessive: "meinen", demonstrative: "diesen" },
    dative: { definite: "dem", indefinite: "einem", negative: "keinem", possessive: "meinem", demonstrative: "diesem" },
    genitive: { definite: "des", indefinite: "eines", negative: "keines", possessive: "meines", demonstrative: "dieses" },
  },
  feminine: {
    nominative: { definite: "die", indefinite: "eine", negative: "keine", possessive: "meine", demonstrative: "diese" },
    accusative: { definite: "die", indefinite: "eine", negative: "keine", possessive: "meine", demonstrative: "diese" },
    dative: { definite: "der", indefinite: "einer", negative: "keiner", possessive: "meiner", demonstrative: "dieser" },
    genitive: { definite: "der", indefinite: "einer", negative: "keiner", possessive: "meiner", demonstrative: "dieser" },
  },
  neuter: {
    nominative: { definite: "das", indefinite: "ein", negative: "kein", possessive: "mein", demonstrative: "dieses" },
    accusative: { definite: "das", indefinite: "ein", negative: "kein", possessive: "mein", demonstrative: "dieses" },
    dative: { definite: "dem", indefinite: "einem", negative: "keinem", possessive: "meinem", demonstrative: "diesem" },
    genitive: { definite: "des", indefinite: "eines", negative: "keines", possessive: "meines", demonstrative: "dieses" },
  },
};

const REFERENCE_NOUNS: ReferenceNoun[] = [
  {
    gender: "masculine",
    target: "der Hund",
    plural: "die Hunde",
    noun: "Hund",
    genitiveNoun: "Hundes",
    dativeTarget: (determiner) => `Ich folge ${determiner} Hund.`,
    spanish: { definite: "el perro", indefinite: "un perro", negative: "ningún perro", possessive: "mi perro", demonstrative: "este perro" },
    english: { definite: "the dog", indefinite: "a dog", negative: "no dog", possessive: "my dog", demonstrative: "this dog" },
  },
  {
    gender: "feminine",
    target: "die Katze",
    plural: "die Katzen",
    noun: "Katze",
    genitiveNoun: "Katze",
    dativeTarget: (determiner) => `Ich folge ${determiner} Katze.`,
    spanish: { definite: "la gata", indefinite: "una gata", negative: "ninguna gata", possessive: "mi gata", demonstrative: "esta gata" },
    english: { definite: "the cat", indefinite: "a cat", negative: "no cat", possessive: "my cat", demonstrative: "this cat" },
  },
  {
    gender: "neuter",
    target: "das Kind",
    plural: "die Kinder",
    noun: "Kind",
    genitiveNoun: "Kindes",
    dativeTarget: (determiner) => `Ich gebe ${determiner} Kind Brot.`,
    spanish: { definite: "el niño", indefinite: "un niño", negative: "ningún niño", possessive: "mi niño", demonstrative: "este niño" },
    english: { definite: "the child", indefinite: "a child", negative: "no child", possessive: "my child", demonstrative: "this child" },
  },
];

function sourcePhrases(reference: ReferenceNoun, language: "spanish" | "english", family: DeterminerFamily): Record<NounCase, string> {
  const noun = reference[language][family];
  if (language === "spanish") {
    const withA = family === "negative"
      ? noun
      : noun.startsWith("el ")
        ? `al ${noun.slice(3)}`
        : `a ${noun}`;
    const withDe = noun.startsWith("el ") ? `del ${noun.slice(3)}` : `de ${noun}`;
    return {
      nominative: `${noun[0].toUpperCase()}${noun.slice(1)} está aquí.`,
      accusative: family === "negative" ? `No veo ${noun}.` : `Veo ${withA}.`,
      dative: reference.gender === "neuter" ? `Le doy pan ${withA}.` : `Sigo ${withA}.`,
      genitive: `El juguete ${withDe} está aquí.`,
    };
  }
  return {
    nominative: `${noun[0].toUpperCase()}${noun.slice(1)} is here.`,
    accusative: `I see ${noun}.`,
    dative: reference.gender === "neuter" ? `I give ${noun} bread.` : `I follow ${noun}.`,
    genitive: `The toy of ${noun} is here.`,
  };
}

function targetPhrase(reference: ReferenceNoun, caseKey: NounCase, family: DeterminerFamily): string {
  const article = ARTICLES[reference.gender][caseKey][family];
  if (caseKey === "nominative") return `${article[0].toUpperCase()}${article.slice(1)} ${reference.noun} ist da.`;
  if (caseKey === "accusative") return `Ich sehe ${article} ${reference.noun}.`;
  if (caseKey === "dative") return reference.dativeTarget(article);
  return `Das Spielzeug ${article} ${reference.genitiveNoun} ist da.`;
}

function questions(language: "spanish" | "english"): Record<NounCase, { target: string; source: string }> {
  if (language === "spanish") {
    return {
      nominative: { target: "Wer? / Was?", source: "¿Quién? / ¿Qué?" },
      accusative: { target: "Wen? / Was?", source: "¿A quién? / ¿Qué?" },
      dative: { target: "Wem?", source: "¿A quién?" },
      genitive: { target: "Wessen?", source: "¿De quién?" },
    };
  }
  return {
    nominative: { target: "Wer? / Was?", source: "Who? / What?" },
    accusative: { target: "Wen? / Was?", source: "Whom? / What?" },
    dative: { target: "Wem?", source: "To whom?" },
    genitive: { target: "Wessen?", source: "Whose?" },
  };
}

export type GermanNounFormsReference = {
  targetText: string;
  sourceText: string;
  pluralGerman: string;
  sections: ExercisePhraseSection[];
};

export function germanNounFormsReferences(sourceLanguage: StudyLanguageCode): Partial<Record<NounGender, GermanNounFormsReference>> {
  if (sourceLanguage !== "spanish" && sourceLanguage !== "english") {
    return {};
  }
  const questionByCase = questions(sourceLanguage);
  return Object.fromEntries(REFERENCE_NOUNS.map((reference) => {
    const sections = (Object.keys(questionByCase) as NounCase[]).map((caseKey) => ({
      key: caseKey,
      question_target_text: questionByCase[caseKey].target,
      question_source_text: questionByCase[caseKey].source,
      phrases: FAMILIES.map((family) => ({
        label: `${caseKey}-${family}`,
        target_text: targetPhrase(reference, caseKey, family),
        source_text: sourcePhrases(reference, sourceLanguage, family)[caseKey],
      })),
    }));
    return [reference.gender, {
      targetText: reference.target,
      sourceText: reference[sourceLanguage].definite,
      pluralGerman: reference.plural,
      sections,
    }];
  })) as Partial<Record<NounGender, GermanNounFormsReference>>;
}
