 /**
  * PUBLIC_INTERFACE
  * getCssVar returns the computed value of a CSS variable from :root.
  */
export function getCssVar(name, fallback = '') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v?.trim() || fallback;
}
