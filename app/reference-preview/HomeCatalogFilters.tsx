'use client';
import {useI18n} from '@/lib/i18n/context';


import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Search, X, ChevronDown} from 'lucide-react';
import type {CatalogQuery, CatalogResponse} from '@/lib/public/types';
import {catalogFilterOptions} from './catalog-filter-options';
import styles from './reference.module.css';

type Props = {
  data: CatalogResponse | null;
  query: CatalogQuery;
  onlyFavorites: boolean;
  focusSearch?: boolean;
  onChange: (query: CatalogQuery, mode?: 'push' | 'replace') => void;
  onReset: () => void;
};

/** One tactile search form; the submit button and Enter flush live selection. Native GET remains the no-JavaScript fallback. */
export function HomeCatalogFilters({data, query, onlyFavorites, focusSearch, onChange, onReset}: Props) {
 const {t:tr,href:localHref}=useI18n();

  const [search, setSearch] = useState(query.q || '');
  const queryKey = JSON.stringify([query.q, query.category, query.destination]);
  const [syncedQuery, setSyncedQuery] = useState(queryKey);
  if (queryKey !== syncedQuery) { setSyncedQuery(queryKey); setSearch(query.q || ''); }
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editing = useRef(false);
  const composing = useRef(false);
  const options = catalogFilterOptions(data?.facets);
  const active = !!(search.trim() || query.category);
  function cancel() { if (timer.current) clearTimeout(timer.current); timer.current = null; }
  useEffect(() => { cancel(); }, [query.q, query.category, query.destination]);
  useEffect(() => () => cancel(), []);
  useEffect(() => {
    const restore = () => { cancel(); editing.current = false; setSearch(query.q || ''); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [query.q]);
  useEffect(() => { if (focusSearch) input.current?.focus({preventScroll: true}); }, [focusSearch]);
  function apply(value: string, category = query.category, mode: 'push' | 'replace' = editing.current ? 'replace' : 'push') {
    cancel();
    onChange({q: value.trim() || undefined, category: category || undefined}, mode);
    editing.current = true;
  }
  function changeSearch(value: string) {
    setSearch(value); cancel();
    if (!composing.current) timer.current = setTimeout(() => apply(value), 250);
  }
  function clearSearch() { setSearch(''); apply('', query.category, 'push'); input.current?.focus(); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); apply(search); }
  function reset() { cancel(); setSearch(''); editing.current = false; onReset(); input.current?.focus(); }
  return <div className={`${styles.catalogFilters} ${active ? styles.catalogFiltersActive : ''}`}><form method="get" action={localHref("/#selected")} role="search" aria-label={tr("Подобрать экскурсию")} className={styles.catalogFilterForm} onSubmit={submit}>
    {(['destination', 'days', 'transport', 'format', 'sort'] as const).map(name => query[name] ? <input key={name} type="hidden" name={name} value={query[name]}/> : null)}
    {onlyFavorites && <input type="hidden" name="favorites" value="1"/>}
    <div className={styles.catalogSearch}>
      <Search size={21} strokeWidth={1.4} aria-hidden="true"/>
      <div className={styles.catalogField}>
        <label className={styles.visuallyHidden} htmlFor="tour-search">{tr("Куда или что хочется?")}</label>
        <input ref={input} id="tour-search" name="q" type="search" value={search} maxLength={100} autoComplete="off" placeholder={tr("Куда или что хочется?")} aria-controls="excursion-cards"
          onChange={event => changeSearch(event.target.value)}
          onBlur={() => { if (timer.current) apply(search); editing.current = false; }}
          onCompositionStart={() => { composing.current = true; cancel(); }}
          onCompositionEnd={event => { composing.current = false; changeSearch(event.currentTarget.value); }}
          onKeyDown={event => { if (event.key === 'Escape' && search) { event.preventDefault(); clearSearch(); } }}/>
      </div>
      {search && <button type="button" className={styles.clearSearch} onClick={clearSearch} aria-label={tr("Очистить поиск")}><X size={18} aria-hidden="true"/></button>}
    </div>
    <div className={styles.catalogCategory}>
      <label className={styles.visuallyHidden} htmlFor="tour-category">{tr("Категория экскурсий")}</label>
      <div className={styles.catalogSelect}>
        <select id="tour-category" name="category" value={query.category || ''} aria-controls="excursion-cards" onChange={event => { apply(search, event.target.value, 'push'); editing.current = false; }}>
          <option value="">{tr("Все экскурсии")}</option>
          {options.map(item => <option key={item.id} value={item.id}>{tr(item.name)}</option>)}
          {query.category && !options.some(item => item.id === query.category) && <option value={query.category}>{tr("Категория из ссылки")}</option>}
        </select>
        <ChevronDown size={17} strokeWidth={1.5} aria-hidden="true"/>
      </div>
    </div>
    <button type="submit" className={styles.catalogSubmit}><span>{tr("Найти")}</span><Search size={20} strokeWidth={1.7} aria-hidden="true"/></button>
  </form>{active && <button type="button" className={styles.catalogReset} onClick={reset}>{tr("Сбросить")}</button>}</div>;
}
