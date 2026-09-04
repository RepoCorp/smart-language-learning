import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useI18n } from "../i18n";
import { guidedTourCopy } from "./guidedTourCopy";
import { GUIDED_TOUR_ACTION_EVENT, requestGuidedTourSection } from "./guidedTourEvents";
import "./guidedTour.css";

interface GuidedTourProps {
  open: boolean;
  onFinish: () => void;
  stepIndex: number;
  onStepChange: (stepIndex: number) => void;
}

type TargetRect = Pick<DOMRect, "top" | "left" | "width" | "height" | "bottom">;

function findTarget(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-guide-target="${target}"]`);
}

export default function GuidedTour({ open, onFinish, stepIndex, onStepChange }: GuidedTourProps): JSX.Element | null {
  const { language } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const copy = guidedTourCopy(language);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [targetReady, setTargetReady] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [nextUnlocked, setNextUnlocked] = useState(false);
  const currentStep = copy.steps[stepIndex];

  useEffect(() => {
    if (!open) {
      return;
    }
    navigate(currentStep.route);
  }, [currentStep.route, navigate, open]);

  useEffect(() => {
    if (open && currentStep.advanceWhenRoute === location.pathname) {
      onStepChange(Math.min(stepIndex + 1, copy.steps.length - 1));
    }
  }, [copy.steps.length, currentStep.advanceWhenRoute, location.pathname, onStepChange, open, stepIndex]);

  useEffect(() => {
    if (!open || (!currentStep.advanceOnAction && !currentStep.collapseOnAction && !currentStep.expandOnAction && !currentStep.showNextOnAction)) return;
    const onAction = (event: Event): void => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (action === currentStep.collapseOnAction) {
        setCollapsed(true);
      }
      if (action === currentStep.expandOnAction) {
        setCollapsed(false);
      }
      if (action === currentStep.showNextOnAction) {
        setNextUnlocked(true);
      }
      if (action === currentStep.advanceOnAction) {
        onStepChange(Math.min(stepIndex + 1, copy.steps.length - 1));
      }
    };
    window.addEventListener(GUIDED_TOUR_ACTION_EVENT, onAction);
    return () => window.removeEventListener(GUIDED_TOUR_ACTION_EVENT, onAction);
  }, [copy.steps.length, currentStep.advanceOnAction, currentStep.collapseOnAction, currentStep.expandOnAction, currentStep.showNextOnAction, onStepChange, open, stepIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setShowComplete(false);
  }, [open]);

  useEffect(() => {
    setShowMoreInfo(false);
    setCollapsed(false);
    setNextUnlocked(false);
  }, [stepIndex]);

  useEffect(() => {
    if (!open || showComplete) {
      setTargetRect(null);
      setTargetReady(false);
      return;
    }

    let frameId = 0;
    let retryTimer = 0;
    const measureTarget = (): void => {
      const target = findTarget(currentStep.target);
      if (!target) {
        setTargetReady(false);
        if (currentStep.openSection) {
          requestGuidedTourSection(currentStep.openSection);
        }
        retryTimer = window.setTimeout(measureTarget, 80);
        return;
      }
      setTargetReady(!currentStep.requiredTargetAttribute || target.getAttribute(currentStep.requiredTargetAttribute) === "true");
      frameId = window.requestAnimationFrame(() => setTargetRect(target.getBoundingClientRect()));
    };
    const target = findTarget(currentStep.target);
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    measureTarget();
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    const observer = new MutationObserver(measureTarget);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(retryTimer);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
      observer.disconnect();
    };
  }, [currentStep.openSection, currentStep.requiredTargetAttribute, currentStep.target, open, showComplete]);

  useEffect(() => {
    if (!open || !["open-menu", "open-session"].includes(currentStep.id)) {
      return;
    }
    const target = findTarget(currentStep.target);
    target?.classList.add("guided-tour-source-highlight");
    return () => target?.classList.remove("guided-tour-source-highlight");
  }, [currentStep.id, currentStep.target, open]);

  if (!open) {
    return null;
  }

  const finish = (): void => {
    setShowComplete(true);
    setTargetRect(null);
  };
  const next = (): void => {
    if (stepIndex === copy.steps.length - 1) {
      finish();
      return;
    }
    onStepChange(stepIndex + 1);
  };
  const keepPopoverClearOfSaveActions = ["save-dialog", "save-word", "save-phrase"].includes(currentStep.id);
  const popoverStyle = targetRect
    ? {
      top: keepPopoverClearOfSaveActions
        ? 16
        : Math.min(targetRect.bottom + 14, window.innerHeight - 228),
      left: keepPopoverClearOfSaveActions
        ? 16
        : Math.max(16, Math.min(targetRect.left, window.innerWidth - 336)),
    }
    : undefined;
  const highlightPadding = currentStep.highlightPadding || 6;
  const highlightWidth = targetRect ? Math.max(targetRect.width + highlightPadding * 2, currentStep.minHighlightWidth || 0) : 0;
  const highlightHeight = targetRect ? Math.max(targetRect.height + highlightPadding * 2, currentStep.minHighlightHeight || 0) : 0;
  const targetReadyForStep = !currentStep.requiredTargetAttribute || targetReady;
  const canAdvance = targetReadyForStep
    && (!currentStep.showNextOnAction || nextUnlocked);
  const body = nextUnlocked && currentStep.completedBody
    ? currentStep.completedBody
    : (targetRect && targetReadyForStep ? currentStep.body : (currentStep.waitingBody || currentStep.body));

  return (
    <div className="guided-tour-overlay" role="dialog" aria-modal="true" aria-label={copy.title}>
      {targetRect ? (
        <div
          className="guided-tour-target"
          style={{
            top: targetRect.top - highlightPadding - (highlightHeight - targetRect.height - highlightPadding * 2) / 2,
            left: targetRect.left - highlightPadding - (highlightWidth - targetRect.width - highlightPadding * 2) / 2,
            width: highlightWidth,
            height: highlightHeight,
          }}
          aria-hidden="true"
        />
      ) : null}
      {collapsed ? (
        <button
          type="button"
          className="guided-tour-collapsed-card"
          onClick={() => setCollapsed(false)}
          aria-label={currentStep.title}
          title={currentStep.title}
        >
          <span aria-hidden="true">i</span>
        </button>
      ) : <section
        className={`guided-tour-popover${targetRect ? "" : " guided-tour-popover-centered"}${keepPopoverClearOfSaveActions ? " guided-tour-popover-save-dialog" : ""}${showComplete ? " guided-tour-popover-complete" : ""}`}
        style={popoverStyle}
      >
        {showComplete ? (
          <>
            <h2>{copy.completeTitle}</h2>
            <p className="guided-tour-complete-body">{copy.completeBody}</p>
            <button type="button" className="primary-button" onClick={onFinish}>{copy.finish}</button>
          </>
        ) : (
          <>
            <h2>{currentStep.title}</h2>
            <p>{body}</p>
            {currentStep.moreInfo ? (
              <>
                <button
                  type="button"
                  className="guided-tour-more-info-button"
                  onClick={() => setShowMoreInfo((visible) => !visible)}
                  aria-expanded={showMoreInfo}
                  aria-label={currentStep.moreInfoLabel}
                  title={currentStep.moreInfoLabel}
                >
                  <span aria-hidden="true">i</span>
                </button>
                {showMoreInfo ? <p className="guided-tour-more-info">{currentStep.moreInfo}</p> : null}
              </>
            ) : null}
            {!currentStep.hideNext && (!currentStep.showNextOnAction || nextUnlocked) ? (
              <div className="guided-tour-actions">
                <button type="button" className="primary-button" onClick={next} disabled={!canAdvance}>
                  {stepIndex === copy.steps.length - 1 ? copy.finish : (currentStep.nextLabel || copy.next)}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>}
    </div>
  );
}
