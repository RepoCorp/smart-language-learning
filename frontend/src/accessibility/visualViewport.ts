// Fixed overlays normally follow the layout viewport, which can be much larger
// than the visible area after pinch zoom or when the keyboard opens.
export function installVisualViewportSizing(): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  const style = document.documentElement.style;
  const properties = ["--visible-top", "--visible-left", "--visible-width", "--visible-height"];
  const previous = properties.map(name => style.getPropertyValue(name));
  const update = () => {
    const values = [viewport.offsetTop, viewport.offsetLeft, viewport.width, viewport.height];
    properties.forEach((name, index) => style.setProperty(name, `${values[index]}px`));
  };
  update();
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  return () => {
    viewport.removeEventListener("resize", update);
    viewport.removeEventListener("scroll", update);
    properties.forEach((name, index) => {
      if (previous[index]) style.setProperty(name, previous[index]);
      else style.removeProperty(name);
    });
  };
}
