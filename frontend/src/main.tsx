import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { I18nProvider } from "./i18n";
import { StudyLanguagesProvider } from "./studyLanguages";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <StudyLanguagesProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StudyLanguagesProvider>
    </I18nProvider>
  </React.StrictMode>
);
