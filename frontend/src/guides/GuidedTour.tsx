import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useI18n } from "../i18n";
import conversationPanelGuideEn from "./conversation-panel-guide-en.svg";
import conversationPanelGuideEs from "./conversation-panel-guide-es.svg";
import { guidedTourCopy } from "./guidedTourCopy";
import { conversationGuideCopy } from "./conversationGuideCopy";
import { GUIDED_TOUR_ACTION_EVENT, requestGuidedTourSection, type GuidedTourId } from "./guidedTourEvents";
import "./guidedTour.css";
import { compactGuidePosition, guidePopoverPosition, type GuideTargetRect } from "./guidedTourPosition";
import { useGuideViewport } from "./useGuideViewport";

interface GuidedTourProps {
  open: boolean;
  onFinish: () => void;
  stepIndex: number;
  onStepChange: (stepIndex: number) => void;
  guideId: GuidedTourId;
}

function findTarget(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-guide-target="${target}"]`);
}

export default function GuidedTour({ open, onFinish, stepIndex, onStepChange, guideId }: GuidedTourProps): JSX.Element | null {
  const { language } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const copy = guideId === "conversation" ? conversationGuideCopy(language) : guidedTourCopy(language);
  const [targetRect, setTargetRect] = useState<GuideTargetRect | null>(null);
  const [targetReady, setTargetReady] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const [nextUnlocked, setNextUnlocked] = useState(false);
  const [popoverHeight, setPopoverHeight] = useState(0);
  const focusedAppLanguageRef = useRef(false);
  const scrolledTargetRef = useRef("");
  const popoverRef = useRef<HTMLElement | null>(null);
  const currentStep = copy.steps[stepIndex];
  const viewport = useGuideViewport(open);
  const compactLayout = viewport.width <= 640 || (viewport.width <= 900 && viewport.height <= 480);
  const compactPosition = compactGuidePosition(targetRect, viewport);
  const cardCollapsed = collapsed || (compactLayout && compactPosition.compact && !compactExpanded);
  const minimizeLabel = language === "es" ? "Minimizar guía" : "Minimize guide";
  const showLabel = language === "es" ? "Mostrar guía" : "Show guide";

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
        if (stepIndex === copy.steps.length - 1) {
          onFinish();
        } else {
          onStepChange(stepIndex + 1);
        }
      }
    };
    window.addEventListener(GUIDED_TOUR_ACTION_EVENT, onAction);
    return () => window.removeEventListener(GUIDED_TOUR_ACTION_EVENT, onAction);
  }, [copy.steps.length, currentStep.advanceOnAction, currentStep.collapseOnAction, currentStep.expandOnAction, currentStep.showNextOnAction, onFinish, onStepChange, open, stepIndex]);

  useEffect(() => {
    setShowMoreInfo(false);
    setCollapsed(false);
    setCompactExpanded(false);
    setNextUnlocked(false);
  }, [stepIndex, guideId]);

  useEffect(() => {
    if (!open) {
      setTargetRect(null);
      setTargetReady(false);
      return;
    }

    let frameId = 0;
    let retryTimer = 0;
    const measureTarget = (): void => {
      if (currentStep.openSection) {
        requestGuidedTourSection(currentStep.openSection);
      }
      const target = findTarget(currentStep.target);
      if (!target) {
        setTargetReady(false);
        retryTimer = window.setTimeout(measureTarget, 80);
        return;
      }
      const targetKey = `${stepIndex}:${currentStep.target}`;
      if (scrolledTargetRef.current !== targetKey) {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        scrolledTargetRef.current = targetKey;
      }
      setTargetReady(!currentStep.requiredTargetAttribute || target.getAttribute(currentStep.requiredTargetAttribute) === "true");
      frameId = window.requestAnimationFrame(() => setTargetRect(target.getBoundingClientRect()));
      if (currentStep.id === "app-language" && !focusedAppLanguageRef.current) {
        target.querySelector<HTMLSelectElement>("select")?.focus({ preventScroll: true });
        focusedAppLanguageRef.current = true;
      }
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
  }, [currentStep.openSection, currentStep.requiredTargetAttribute, currentStep.target, open]);

  useEffect(() => {
    if (!open) {
      focusedAppLanguageRef.current = false;
      scrolledTargetRef.current = "";
    }
  }, [open]);

  useEffect(() => {
    if (!open || !["open-menu", "open-session", "conversation-open-menu"].includes(currentStep.id)) {
      return;
    }
    const target = findTarget(currentStep.target);
    target?.classList.add("guided-tour-source-highlight");
    return () => {
      target?.classList.remove("guided-tour-source-highlight");
    };
  }, [currentStep.id, currentStep.target, open]);

  useEffect(() => {
    const popover = popoverRef.current;
    if (!open || cardCollapsed || !popover) {
      setPopoverHeight(0);
      return;
    }

    const measure = (): void => setPopoverHeight(Math.ceil(popover.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(popover);
    return () => observer.disconnect();
  }, [cardCollapsed, currentStep.id, open, showMoreInfo]);

  if (!open) {
    return null;
  }

  const next = (): void => {
    if (stepIndex === copy.steps.length - 1) {
      onFinish();
      return;
    }
    onStepChange(stepIndex + 1);
  };
  const { style: popoverStyle, clearTarget: keepPopoverClearOfTarget, menu: isMenuNavigationStep } = guidePopoverPosition({
    target: targetRect, stepId: currentStep.id, height: popoverHeight,
    viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
  });
  const highlightPadding = currentStep.highlightPadding || 6;
  const highlightWidth = targetRect ? Math.max(targetRect.width + highlightPadding * 2, currentStep.minHighlightWidth || 0) : 0;
  const highlightHeight = targetRect ? Math.max(targetRect.height + highlightPadding * 2, currentStep.minHighlightHeight || 0) : 0;
  const targetReadyForStep = !currentStep.requiredTargetAttribute || targetReady;
  const canAdvance = targetReadyForStep
    && (!currentStep.showNextOnAction || nextUnlocked);
  const body = nextUnlocked && currentStep.completedBody
    ? currentStep.completedBody
    : (targetRect && targetReadyForStep ? currentStep.body : (currentStep.waitingBody || currentStep.body));
  const popoverTop = typeof popoverStyle?.top === "number" ? popoverStyle.top : 16;
  const guideScrollHeight = Math.max(window.innerHeight, popoverTop + popoverHeight + 16);

  return (
    <div className={`guided-tour-overlay${compactLayout ? " guided-tour-compact-layout" : ""}`} role="dialog" aria-label={copy.title}>
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
      <div className="guided-tour-scroll-content" style={{ minHeight: guideScrollHeight }}>
        {cardCollapsed ? (
          <button
            type="button"
            className="guided-tour-collapsed-card"
            style={compactLayout ? compactPosition.toggleStyle : undefined}
            onClick={() => { setCollapsed(false); setCompactExpanded(true); }}
            aria-label={`${showLabel}: ${currentStep.title}`}
            aria-expanded={false}
            title={currentStep.title}
          >
            <span aria-hidden="true">i</span>
          </button>
        ) : <section
          ref={popoverRef}
          className={`guided-tour-popover${targetRect ? "" : " guided-tour-popover-centered"}${keepPopoverClearOfTarget ? " guided-tour-popover-clear-target" : ""}${isMenuNavigationStep ? " guided-tour-popover-menu" : ""}`}
          style={compactLayout ? compactPosition.style : popoverStyle}
        >
          <header className="guided-tour-card-header">
            <h2>{currentStep.title}</h2>
            <button type="button" className="guided-tour-minimize" aria-label={minimizeLabel}
              title={minimizeLabel} aria-expanded={true}
              onClick={() => { setCollapsed(true); setCompactExpanded(false); }}>
              <span aria-hidden="true">−</span>
            </button>
          </header>
          <div className="guided-tour-card-body" tabIndex={0} role="region" aria-label={currentStep.title}>
          <p>{body}</p>
          {currentStep.image === "conversation-panel" ? (
            <img
              className="guided-tour-conversation-image"
              src={language === "es" ? conversationPanelGuideEs : conversationPanelGuideEn}
              alt={language === "es" ? "Panel de conversación con controles anotados" : "Conversation panel with annotated controls"}
            />
          ) : null}
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
                {currentStep.nextLabel || (stepIndex === copy.steps.length - 1 ? copy.finish : copy.next)}
              </button>
            </div>
          ) : null}
          </div>
        </section>}
      </div>
    </div>
  );
}
