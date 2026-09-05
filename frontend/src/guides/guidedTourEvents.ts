export const GUIDED_TOUR_ACTION_EVENT = "guided-tour-action";
export const GUIDED_TOUR_OPEN_SECTION_EVENT = "guided-tour-open-section";
export const GUIDED_TOUR_START_EVENT = "guided-tour-start";

export type GuidedTourId = "basics" | "conversation";

export function notifyGuidedTourAction(action: string): void {
  window.dispatchEvent(new CustomEvent(GUIDED_TOUR_ACTION_EVENT, { detail: { action } }));
}

export function requestGuidedTourSection(section: string): void {
  window.dispatchEvent(new CustomEvent(GUIDED_TOUR_OPEN_SECTION_EVENT, { detail: { section } }));
}

export function startGuidedTour(guideId: GuidedTourId): void {
  window.dispatchEvent(new CustomEvent(GUIDED_TOUR_START_EVENT, { detail: { guideId } }));
}
