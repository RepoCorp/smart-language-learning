type GrammarDistractorFamily = {
  id: string;
  forms: string[];
};

const GERMAN_FAMILIES: GrammarDistractorFamily[] = [
  { id: "noun_gender", forms: ["der", "die", "das"] },
  { id: "masculine_case", forms: ["der", "den", "dem", "des"] },
  { id: "feminine_case", forms: ["die", "der"] },
  { id: "neuter_case", forms: ["das", "dem", "des"] },
  { id: "indefinite_masculine", forms: ["ein", "einen", "einem"] },
  { id: "negative_article", forms: ["kein", "keine", "keinen", "keinem", "keiner", "keines"] },
  { id: "possessive_article", forms: ["mein", "meine", "meinen"] },
  { id: "location_direction_in", forms: ["in", "im", "ins"] },
  { id: "location_direction_an", forms: ["an", "am", "ans"] },
  { id: "location_direction_auf", forms: ["auf", "aufs"] },
  { id: "location_direction_zu", forms: ["zu", "zum", "zur"] },
  { id: "location_direction_bei", forms: ["bei", "beim"] },
  { id: "location_direction_von", forms: ["von", "vom"] },
  { id: "sein_conjugation", forms: ["bin", "bist", "ist", "sind", "seid"] },
  { id: "haben_conjugation", forms: ["habe", "hast", "hat", "haben", "habt"] },
  { id: "werden_conjugation", forms: ["werde", "wirst", "wird", "werden", "werdet"] },
  { id: "question_case", forms: ["wer", "wen", "wem"] },
  { id: "spatial_question", forms: ["wo", "wohin", "woher"] },
  { id: "negation", forms: ["nicht", "kein", "keine", "keinen", "keinem", "keiner", "keines"] },
  { id: "reflexive_pronoun", forms: ["mich", "dich", "sich", "uns", "euch"] },
  { id: "temporal_connector", forms: ["als", "wenn", "wann"] },
  { id: "subordinating_connector", forms: ["weil", "dass", "wenn"] },
  { id: "first_person_pronoun", forms: ["ich", "mich", "mir"] },
  { id: "second_person_pronoun", forms: ["du", "dich", "dir"] },
  { id: "masculine_pronoun", forms: ["er", "ihn", "ihm"] },
  { id: "feminine_pronoun", forms: ["sie", "ihr"] },
  { id: "neuter_pronoun", forms: ["es", "ihm"] },
  { id: "possessive_or_pronoun", forms: ["ihr", "ihre", "sie"] },
  { id: "logical_conjunction", forms: ["und", "aber", "oder"] },
  { id: "cause_or_result", forms: ["weil", "denn", "deshalb"] },
  { id: "addition_or_contrast", forms: ["auch", "aber", "noch"] },
];

const FAMILIES_BY_LANGUAGE: Record<string, GrammarDistractorFamily[]> = {
  german: GERMAN_FAMILIES,
};

function normalizedForm(value: string): string {
  return value.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").toLocaleLowerCase();
}

export function grammarDistractorsForBlock(targetBlock: string, targetLanguage: string): string[] {
  const target = normalizedForm(targetBlock);
  const matchingFamilies = (FAMILIES_BY_LANGUAGE[targetLanguage] || []).filter((family) =>
    family.forms.some((form) => normalizedForm(form) === target),
  );
  return [...new Set(matchingFamilies.flatMap((family) => family.forms))]
    .filter((form) => normalizedForm(form) !== target);
}

export function sameGrammarForm(left: string, right: string): boolean {
  return normalizedForm(left) === normalizedForm(right);
}
