export function isTouchBlockPointer(pointerType = ""): boolean {
  return pointerType === "touch" || pointerType === "pen"
    || Boolean(window.matchMedia?.("(pointer: coarse)").matches);
}

export function blockDragStart(rect: DOMRect, clientX: number, clientY: number, pointerType = "") {
  const isTouch = isTouchBlockPointer(pointerType);
  // Keep letters above the pointer, with extra clearance for a fingertip.
  const offset = { x: clientX - rect.left, y: rect.height - 5 + (isTouch ? 28 : 0) };
  return {
    offset,
    isTouch,
    position: isTouch
      ? { left: clientX - offset.x, top: clientY - offset.y }
      : { left: rect.left, top: rect.top },
  };
}

export function isPointerOverBlockTarget(rect: DOMRect, clientX: number, clientY: number, isTouch: boolean): boolean {
  const padding = isTouch ? 32 : 0;
  return clientX >= rect.left - padding && clientX <= rect.right + padding
    && clientY >= rect.top - padding && clientY <= rect.bottom + padding;
}
