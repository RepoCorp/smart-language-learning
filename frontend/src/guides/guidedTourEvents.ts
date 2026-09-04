export const GUIDED_TOUR_ACTION_EVENT = "guided-tour-action";
export const GUIDED_TOUR_OPEN_SECTION_EVENT = "guided-tour-open-section";

export function notifyGuidedTourAction(action: string): void {
  window.dispatchEvent(new CustomEvent(GUIDED_TOUR_ACTION_EVENT, { detail: { action } }));
}

export function requestGuidedTourSection(section: string): void {
  window.dispatchEvent(new CustomEvent(GUIDED_TOUR_OPEN_SECTION_EVENT, { detail: { section } }));
}
