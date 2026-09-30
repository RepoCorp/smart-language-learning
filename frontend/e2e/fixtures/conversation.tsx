import { createRoot } from "react-dom/client";
import ConversationPage from "../../src/features/conversation/ConversationPage";
import { I18nProvider } from "../../src/i18n";
import "../../src/styles.css";
import "../../src/accessibility/modals.css";
import "../../src/accessibility/studyText.css";

createRoot(document.getElementById("root")!).render(<I18nProvider><ConversationPage /></I18nProvider>);
