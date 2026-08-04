/** Set the URL hash and ensure `hashchange` listeners run (Next Link / replaceState often skip it). */
export function setLocationHash(frag: string) {
  if (typeof window === "undefined") return;
  const next = frag.startsWith("#") ? frag : `#${frag}`;
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = next.slice(1);
}
