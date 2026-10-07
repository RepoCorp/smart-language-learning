import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../../src/i18n";
import LearningContentPlayground from "../../src/features/learningContent/playground/LearningContentPlayground";
import "../../src/styles.css";

createRoot(document.getElementById("root")!).render(
  <MemoryRouter><I18nProvider><LearningContentPlayground /></I18nProvider></MemoryRouter>,
);
