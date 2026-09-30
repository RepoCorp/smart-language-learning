import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../../src/i18n";
import GuidedTour from "../../src/guides/GuidedTour";
import { conversationGuideCopy } from "../../src/guides/conversationGuideCopy";
import { notifyGuidedTourAction } from "../../src/guides/guidedTourEvents";
import "../../src/styles.css";

const params = new URLSearchParams(location.search);
const stepId = params.get("step") || "conversation-goal";
const stepIndex = conversationGuideCopy("en").steps.findIndex(step => step.id === stepId);
const target = conversationGuideCopy("en").steps[stepIndex].target;

function Fixture() {
  const [actions, setActions] = useState(0);
  const [advanced, setAdvanced] = useState(0);
  return <I18nProvider><MemoryRouter initialEntries={["/conversation"]}>
    <div data-guide-target={target} style={{
      position: "fixed", top: params.has("tall") ? "5vh" : "40vh",
      left: "5vw", width: "90vw", height: params.has("tall") ? "90vh" : undefined,
    }}>
      <button onClick={() => {
        setActions(value => value + 1);
        notifyGuidedTourAction("conversation-goal-generated");
      }}>Generate goal</button>
    </div>
    <output data-testid="actions">{actions}</output>
    <output data-testid="advanced">{advanced}</output>
    <GuidedTour open guideId="conversation" stepIndex={stepIndex}
      onStepChange={() => setAdvanced(value => value + 1)}
      onFinish={() => setAdvanced(value => value + 1)} />
  </MemoryRouter></I18nProvider>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
