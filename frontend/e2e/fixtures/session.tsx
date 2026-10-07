import { createRoot } from "react-dom/client";
import SessionPage from "../../src/components/SessionPage";
import { I18nProvider } from "../../src/i18n";
import "../../src/styles.css";
import "../../src/accessibility/modals.css";

createRoot(document.getElementById("root")!).render(<I18nProvider><SessionPage /></I18nProvider>);
