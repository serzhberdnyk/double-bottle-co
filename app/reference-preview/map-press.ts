/** Animate only the artwork, leaving the source-map anchor and native action alone. */
const active = new WeakMap<Element, Animation>();

export function animateMapPress(artwork: Element | null) {
  if (!artwork || typeof artwork.animate !== 'function') return;
  active.get(artwork)?.cancel();
  const preference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (preference?.matches) return;
  try {
    const animation = artwork.animate([
      {rotate:'0deg', scale:'1'},
      {rotate:'-3deg', scale:'1.04', offset:.3},
      {rotate:'2deg', scale:'1.02', offset:.65},
      {rotate:'0deg', scale:'1'},
    ], {duration:420, easing:'ease-out'});
    active.set(artwork, animation);
    const stopIfReduced = () => { if (preference?.matches) animation.cancel(); };
    const clean = () => {
      preference?.removeEventListener('change', stopIfReduced);
      if (active.get(artwork) === animation) active.delete(artwork);
    };
    preference?.addEventListener('change', stopIfReduced);
    animation.addEventListener('finish', clean, {once:true});
    animation.addEventListener('cancel', clean, {once:true});
  } catch {
    // An optional visual effect must never interrupt an existing click action.
  }
}

/** Native click covers pointer, touch, Enter and Space without duplicate key handlers. */
export function reactToMapPress(event: {currentTarget: HTMLElement}) {
  animateMapPress(event.currentTarget.querySelector('[data-map-press-art]') || event.currentTarget.querySelector('img,svg'));
}
