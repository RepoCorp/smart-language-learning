import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { DebugToolsProvider } from "./debugTools";
import { I18nProvider } from "./i18n";
import { PromptPreferencesProvider } from "./promptPreferences";
import { StudyLanguagesProvider } from "./studyLanguages";
import "./styles.css";

type ZoomResetWindow = Window & { __sllInputZoomResetInstalled?: boolean };

function isFormField(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function resetViewportToFitWidth(): void {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    return;
  }
  const baseContent = "width=device-width, initial-scale=1.0";
  viewport.setAttribute("content", `${baseContent}, maximum-scale=1.0`);
  window.setTimeout(() => {
    viewport.setAttribute("content", baseContent);
  }, 0);
}

function installMobileInputZoomReset(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const state = window as ZoomResetWindow;
  if (state.__sllInputZoomResetInstalled) {
    return;
  }
  state.__sllInputZoomResetInstalled = true;

  if (!window.matchMedia("(pointer: coarse)").matches) {
    return;
  }

  document.addEventListener(
    "focusout",
    (event) => {
      if (!isFormField(event.target)) {
        return;
      }
      const scale = window.visualViewport?.scale ?? 1;
      if (scale > 1.01) {
        resetViewportToFitWidth();
      }
    },
    true,
  );
}

installMobileInputZoomReset();

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <StudyLanguagesProvider>
        <PromptPreferencesProvider>
          <DebugToolsProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </DebugToolsProvider>
        </PromptPreferencesProvider>
      </StudyLanguagesProvider>
    </I18nProvider>
  </React.StrictMode>
);
