export const locales = ['ru', 'en', 'th'] as const;
export type Locale = typeof locales[number];
export function isLocale(value: unknown): value is Locale { return typeof value === 'string' && (locales as readonly string[]).includes(value); }
export function localePath(path: string, locale: Locale): string {
  if (!path.startsWith('/') || path.startsWith('//') || /^\/(api|admin|assets|_next|favicon)(\/|\.|$)/.test(path)) return path;
  const stripped = path.replace(/^\/(en|th)(?=\/|[?#]|$)/, '') || '/';
  const clean = stripped.startsWith('?') || stripped.startsWith('#') ? '/' + stripped : stripped;
  return locale === 'ru' ? clean : '/' + locale + (clean === '/' ? '' : clean.startsWith('/?') || clean.startsWith('/#') ? clean.slice(1) : clean);
}
export function localeFromPath(path: string): Locale { const match = path.match(/^\/(en|th)(?:\/|$)/); return match ? match[1] as Locale : 'ru'; }
export const languageNames: Record<Locale,string> = {ru:'Русский',en:'English',th:'ไทย'};
