export type DialogSaveOptionsCopy = {
  saveLabel: string;
  fullLineTitle: string;
  fullLineDescription: string;
  partialLineTitle: string;
  partialLineDescription: string;
};

const COPY: Record<"en" | "es", DialogSaveOptionsCopy> = {
  en: {
    saveLabel: "Save a phrase",
    fullLineTitle: "Full line",
    fullLineDescription: "Study this entire line together.",
    partialLineTitle: "Short expression",
    partialLineDescription: "Choose two or more words from the line.",
  },
  es: {
    saveLabel: "Guardar una frase",
    fullLineTitle: "Línea completa",
    fullLineDescription: "Estudia toda esta línea junta.",
    partialLineTitle: "Expresión corta",
    partialLineDescription: "Elige dos o más palabras de la línea.",
  },
};

export function dialogSaveOptionsCopy(language: string): DialogSaveOptionsCopy {
  return COPY[language === "es" ? "es" : "en"];
}
