import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { DebugToolsProvider } from "./debugTools";
import { I18nProvider } from "./i18n";
import { PromptPreferencesProvider } from "./promptPreferences";
import { StudyLanguagesProvider } from "./studyLanguages";
import "./styles.css";
import "./accessibility/modals.css";
import "./accessibility/studyText.css";
import { installVisualViewportSizing } from "./accessibility/visualViewport";
import { StudyTextSizeProvider } from "./accessibility/StudyTextSizeProvider";

const disposeViewportSizing = installVisualViewportSizing();
import.meta.hot?.dispose(disposeViewportSizing);

const routerFutureFlags = {
  v7_relativeSplatPath: true,
  v7_startTransition: true,
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <StudyLanguagesProvider>
        <PromptPreferencesProvider>
          <DebugToolsProvider>
            <BrowserRouter future={routerFutureFlags}>
              <StudyTextSizeProvider><App /></StudyTextSizeProvider>
            </BrowserRouter>
          </DebugToolsProvider>
        </PromptPreferencesProvider>
      </StudyLanguagesProvider>
    </I18nProvider>
  </React.StrictMode>
);
