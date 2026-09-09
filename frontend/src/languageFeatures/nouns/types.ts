export type NounGender = "masculine" | "feminine" | "neuter";

export type NounLanguageFeature = {
  articles: string[];
  determiners: string[];
  genderForText: (targetText: string) => NounGender | null;
};
