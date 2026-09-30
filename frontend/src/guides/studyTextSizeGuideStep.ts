import type { GuideLanguage, GuidedTourStep } from "./guidedTourCopy";

const copy = {
  en: {
    title: "Make tappable words easier to read",
    body: "Use Tappable text size to enlarge the words you can tap in dialogs. The preview shows the size; buttons and other interface text stay the same. Choose a comfortable size or keep Normal, then click Next. You can change it later in Configuration.",
  },
  es: {
    title: "Lee mejor las palabras que puedes tocar",
    body: "Usa Tamaño del texto que puedes tocar para ampliar las palabras que puedes pulsar en los diálogos. La vista previa muestra el tamaño; los botones y el resto de la interfaz no cambian. Elige un tamaño cómodo o deja Normal y pulsa Siguiente. Puedes cambiarlo después en Configuración.",
  },
};

export function studyTextSizeGuideStep(language: GuideLanguage): GuidedTourStep {
  return {
    id: "study-text-size",
    target: "study-text-size",
    route: "/configurations",
    ...copy[language],
  };
}
