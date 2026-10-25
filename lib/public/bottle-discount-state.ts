/** Browser-local discovery state, not proof of a confirmed booking discount.
 * No customer identity or expiry is inferred here: the existing 3% estimate and
 * manager-confirmation terms are unchanged. Change the version if terms change.
 */
export const BOTTLE_DISCOUNT_STORAGE_KEY = 'double-bottle:discount:3:v2';
const legacyKey = 'double-bottle:discount:3:v1';
const change = 'double-bottle:discount-change';
const record = JSON.stringify({version: 2, active: true});
let activated = false;

function persisted() {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(BOTTLE_DISCOUNT_STORAGE_KEY) || 'null');
    return typeof value === 'object' && value !== null &&
      'version' in value && value.version === 2 && 'active' in value && value.active === true;
  } catch {
    return false;
  }
}

function legacyActive() {
  try { return window.sessionStorage.getItem(legacyKey) === 'active'; }
  catch { return false; }
}

function persist() {
  try {
    window.localStorage.setItem(BOTTLE_DISCOUNT_STORAGE_KEY, record);
  } catch {
    // Restricted/private storage: preserve the previous tab-session fallback.
    try { window.sessionStorage.setItem(legacyKey, 'active'); } catch { /* Page-only fallback. */ }
    return;
  }
  // Do not let an obsolete session marker resurrect a cleared discovery later.
  try { window.sessionStorage.removeItem(legacyKey); } catch { /* Storage may be restricted. */ }
}

export function bottleDiscountSnapshot() {
  if (typeof window === 'undefined') return false;
  return activated || persisted() || legacyActive();
}

export function subscribeBottleDiscount(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  // Upgrade a discovery earned before this release without requiring a re-click.
  if (!persisted() && legacyActive()) persist();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== BOTTLE_DISCOUNT_STORAGE_KEY && event.key !== legacyKey) return;
    activated = false;
    listener();
  };
  window.addEventListener(change, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(change, listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function activateBottleDiscount() {
  if (typeof window === 'undefined') return;
  activated = true;
  persist();
  window.dispatchEvent(new Event(change));
}
