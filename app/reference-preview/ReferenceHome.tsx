'use client';
import {CardChildPrices} from '../components/CardChildPrices';
import {localizedPriceUnit} from '../components/localized-price';
import {useI18n} from '@/lib/i18n/context';

/* eslint-disable @next/next/no-html-link-for-pages -- Native catalogue links deliberately support full navigation and non-JavaScript pagination. */

import {useEffect, useRef, useState, type MouseEvent} from 'react';
import Link from 'next/link';
import {LanguageSwitcher} from '../components/LanguageSwitcher';
import {ContactModal} from '../components/ContactModal';
import {Clock, Heart, Users, X, Plus, Check} from 'lucide-react';
import type {CatalogQuery, CatalogResponse, Tour, Variant} from '@/lib/public/types';
import {categoryNames, priceLabel, programWord, completedProgramLabel} from '@/lib/public/types';
import {todayInThailand,displayRates} from '@/lib/public/pricing';
import {TourImage} from '../components/TourImage';
import {LicenseBadge} from '../components/LicenseBadge';
import {BrandMark} from '../components/BrandMark';
import {referenceCopy as copy} from './reference-copy';
import {useReferenceCatalog} from './useReferenceCatalog';
import {SupplementalArtPOIs} from './SupplementalArtPOIs';
import {MapBottle} from './MapBottle';
import {ThaiStamp} from './ThaiStamp';
import {HeroMapPreview} from './HeroMapPreview';
import {CheowLanMapLink} from './CheowLanMapLink';
import {PhiPhiDetail} from './PhiPhiDetail';
import {catalogHref} from '@/lib/public/catalog-navigation';
import {HomeCatalogFilters} from './HomeCatalogFilters';
import {BottlePrice} from '../components/BottlePrice';
import type {MapLayout,MapDocument} from '@/lib/public/map-layout';
import {MapLayoutProvider} from './MapLayoutContext';
import styles from './reference.module.css';

function CatalogPrice({variant,variants}: {variant: Variant;variants:Variant[]}) {
 const {locale,t:tr}=useI18n();

  const [today, setToday] = useState(todayInThailand());
  useEffect(() => { const timer = setInterval(() => setToday(todayInThailand()), 30000); return () => clearInterval(timer); }, []);
  const price = priceLabel(variant.rates, today);
  return <div className={styles.price} data-price-state={price.rate?'known':'request'}><div className={styles.adultPrice}><strong><BottlePrice price={price} layout="card"/></strong><small>{localizedPriceUnit(price.unit,locale)}</small></div><CardChildPrices variants={variants} adult={price} today={today} compact/>{variants.some(v=>v.rates.some(r=>r.id===price.rate?.id)&&v.conditions.includes('Цена из буклета. Срок действия не указан.'))&&<small className={styles.priceNote}>{tr('Цена из буклета. Срок действия не указан.')}</small>}</div>;
}

function ReferenceCard({tour, saved, onFavorite, busy, revealed}: {tour: Tour; saved: boolean; onFavorite: (id: string) => void; busy: boolean; revealed:boolean}) {
 const {t:tr,href:localHref}=useI18n();

  const variant = tour.variants[0];
  if (!variant) return null;
  const href = `/tour/${tour.slug}?variant=${encodeURIComponent(variant.id)}`;
  const format=variant.format.trim();
  return <article className={`${styles.card} ${revealed?styles.revealedCard:''}`} data-tour-id={tour.id}>
    <a className={styles.cardLink} href={localHref(href)} data-tour-link={tour.id}>
      <div className={styles.cardPhoto}><TourImage tour={tour} src={tour.image} alt={tour.imageAlt||''} sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 1050px) 50vw, 25vw" fallback={<div className={styles.photoFallback}><span>{tr(categoryNames[tour.category])}</span><i>Double Bottle Co’</i></div>}/></div>
      <div className={styles.cardContent}>
        <p className={styles.cardCategory}>{tr(categoryNames[tour.category])||tr("Экскурсия")}</p>
        <div className={styles.cardSummary}>
          <h3>{tour.title}</h3>
          <CatalogPrice variant={{...variant,rates:tour.variants.flatMap(v=>displayRates(v))}} variants={tour.variants}/>
        </div>
        <div className={styles.cardMeta}><span><Clock size={13}/><span>{variant.duration}</span></span>{format&&format.toLowerCase()!=='по запросу'&&<span><Users size={13}/><span>{format}</span></span>}</div>
        {(tour.status==='temporarily_unavailable'||variant.status==='temporarily_unavailable')&&<p className={styles.cardAvailability}>{tr("Доступность уточняется")}</p>}
      </div>
    </a>
    <button type="button" className={styles.favorite} aria-label={(saved ? tr("Убрать из избранного: ") : tr("В избранное: ")) + tour.title} aria-pressed={saved} disabled={busy} onClick={() => onFavorite(tour.id)}><Heart size={20} strokeWidth={1.4} fill={saved ? 'currentColor' : 'none'}/></button>
  </article>;
}

export function ReferenceHome({data:initial,initialQuery,onlyFavorites=false,searchOpen=false,mapLayout,mapDocument}: {mapLayout?:MapLayout;mapDocument?:MapDocument;data: CatalogResponse | null;initialQuery:CatalogQuery;onlyFavorites?:boolean;searchOpen?:boolean}) {
 const {t:tr,href:localHref,locale}=useI18n();

  const {data,firstPage,filters,appliedFilters,updateFilters,resetFilters,restoreFavorites,retry,busy:catalogBusy,loadingMore,error:catalogError,moreError,hasMore,loadMore,lastAppend}=useReferenceCatalog(initial,initialQuery,onlyFavorites);
  const cardsRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!lastAppend?.firstNewId)return;
    const firstAdded=Array.from(cardsRef.current?.querySelectorAll<HTMLAnchorElement>('[data-tour-link]')||[]).find(link=>link.dataset.tourLink===lastAppend.firstNewId);
    firstAdded?.focus({preventScroll:true});
  },[lastAppend]);
  const selected=(data?.destinations.find(destination=>destination.id===appliedFilters.destination)||initial?.destinations.find(destination=>destination.id===appliedFilters.destination));
  const legacySelection=!!(filters.days||filters.transport||filters.format||filters.sort);
  const selectionTitle=onlyFavorites?tr("Ваше избранное"):selected?.name || (appliedFilters.category ? tr(categoryNames[appliedFilters.category]) : null);
  const shown=data?.items.length||0;
  const moreLabel=loadingMore?tr("Загружаем…"):catalogBusy?tr("Обновляем подборку…"):catalogError?tr("Обновите подборку"):moreError?tr("Повторить загрузку"):tr("Показать ещё");
  const progressLabel=data?tr("Показано: {0}. Всего: {1} {2}.").replace("{0}", String(shown)).replace("{1}", String(data.total)).replace("{2}", String(tr(programWord(data.total)))):'';
  const [favorites, setFavorites] = useState<string[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [favoritesReady,setFavoritesReady]=useState(!onlyFavorites);

  const nextHref=catalogHref({...appliedFilters,page:(data?.page||1)+1},{favorites:onlyFavorites});
  function handleLoadMore(event:MouseEvent<HTMLAnchorElement>){
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    if(!catalogBusy&&!loadingMore&&!catalogError&&hasMore)void loadMore();
  }
  useEffect(() => {
    let active = true;
    fetch('/api/session', {credentials: 'same-origin'}).then(res => {
      if (!res.ok) throw new Error();
      return fetch('/api/favorites', {credentials: 'same-origin'});
    }).then(res => res.ok ? res.json() as Promise<{ids: string[]}> : Promise.reject()).then((value: {ids: string[]}) => { if (active) {setFavorites(value.ids);setFavoritesReady(true);if(onlyFavorites)void restoreFavorites(value.ids);} }).catch(() => {if(active){setFavoritesReady(true);setError(tr("Не удалось загрузить избранное. Обновите страницу и попробуйте ещё раз."));}});
    return () => { active = false; };
  }, [onlyFavorites,restoreFavorites]);
  async function toggleFavorite(id: string) {
    if (pending.includes(id)) return;
    setPending(ids => [...ids, id]);
    try {
      const response = await fetch('/api/favorites', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, save: !favorites.includes(id)})});
      const value = await response.json() as {ids: string[]; error?: string};
      if (!response.ok) throw new Error(value.error || tr("Не удалось сохранить экскурсию"));
      setFavorites(value.ids); setError('');
      if(onlyFavorites)void restoreFavorites(value.ids);
    } catch (failure) { setError(failure instanceof Error ? failure.message : tr("Не удалось сохранить экскурсию")); }
    finally { setPending(ids => ids.filter(value => value !== id)); }
  }
  return <MapLayoutProvider layout={mapLayout} document={mapDocument}><div className={styles.page}>
    <a className={styles.skipLink} href="#main-content">{tr("Перейти к содержанию")}</a>
    <main id="main-content"><div className={styles.languageControls}><LanguageSwitcher/></div>
      <section className={styles.hero} aria-labelledby="reference-heading">
        <ThaiStamp/>
        <div className={styles.artLayer} aria-hidden="true"><picture>
          <source media="(max-width: 760px)" srcSet="/media/reference/doublebottle-mobile-bottle.webp" width={720} height={1280}/>
          <source media="(min-width: 761px)" srcSet="/media/reference/doublebottle-mobile-bottle.webp" width={720} height={1280}/>
          <img className={styles.cleanPlate} src="/media/reference/andaman-clean-plate.webp" alt="" width={1448} height={1086} fetchPriority="high"/>
        </picture></div>
        <div id="andaman-map" className={styles.sourceMapScene} data-map-mode="illustration">

          <div className={styles.sourceArtPlane}><CheowLanMapLink/>
            <img className={styles.sourceMapImage} src="/media/reference/andaman-user-map.png" alt="" aria-hidden="true" width={1280} height={1083} fetchPriority="high"/>
            <SupplementalArtPOIs/>
            <PhiPhiDetail/>
          </div>
          <MapBottle/>
          <p className={styles.mapDevelopmentNotice} data-map-development-notice>{tr("Экскурсии уже можно выбрать в каталоге. Интерактивная карта и другие возможности сайта ещё в разработке")}</p>
        </div>
        <div className={styles.readabilityMask} aria-hidden="true"/>
        <div className={styles.editorial}>
          <Link className={styles.heroBrand} href={localHref("/#selected")} aria-label={tr("Double Bottle Co’ — главная")}><BrandMark/><div>Double Bottle Co’<span>PHUKET &amp; BEYOND</span></div></Link>
          <div className={styles.mobileHeadingRow}>
            <h1 id="reference-heading">{copy.headline.map(line => <span key={line}>{tr(line)}</span>)}</h1>
            <HeroMapPreview/>
          </div>
          <p>{tr(copy.introduction)}</p>
          <ContactModal className={styles.primaryAction}>{tr(copy.primaryAction)}</ContactModal>
          <dl className={styles.stats}><div><dt>{initial?.count ?? '—'}</dt><dd>{data ? tr(programWord(data.count)) : tr("каталог")}</dd></div><div><dt>{initial?.destinations.length ?? '—'}</dt><dd>{tr("направлений")}</dd></div><div><dt>{tr("Таиланд")}</dt><dd>{tr("настоящие впечатления")}</dd></div></dl>
        </div>
      </section>
      <section id="selected" className={styles.selection} aria-labelledby="selection-heading">
        <h2 id="selection-heading" className={styles.visuallyHidden}>{selectionTitle || tr("Экскурсии")}</h2>
        <HomeCatalogFilters data={data||initial} query={filters} onlyFavorites={onlyFavorites} focusSearch={searchOpen} onChange={updateFilters} onReset={resetFilters}/>
        {(onlyFavorites||selected||legacySelection)&&<p className={styles.catalogContext}>{onlyFavorites?tr("Ваше избранное"):selected?.name||tr("Подборка по ссылке")} · <a href={localHref("/#selected")}>{tr("Все экскурсии")}</a></p>}
        {catalogError&&<div className={styles.feedError} role="alert"><p>{tr(catalogError)} {shown>0?tr("Сохранили предыдущую подборку."):''}</p><button type="button" className={styles.subtleButton} onClick={retry}>{tr("Повторить")}</button></div>}
        <div id="excursion-cards" ref={cardsRef} className={styles.cards} aria-busy={catalogBusy||loadingMore}>
          {data?.items.length ? data.items.map((tour,index)=><ReferenceCard key={tour.id} tour={tour} saved={favorites.includes(tour.id)} onFavorite={toggleFavorite} busy={pending.includes(tour.id)} revealed={!!lastAppend&&index>=shown-lastAppend.addedCount}/>) : !catalogBusy&&!catalogError ? <div className={styles.catalogUnavailable}><p>{!favoritesReady?tr("Загружаем избранное…"):onlyFavorites&&!favorites.length?tr("Пока нет сохранённых экскурсий. Нажмите сердечко у понравившейся программы."):data ? tr("Ничего не нашли. Попробуйте другое название или категорию.") : tr("Каталог временно недоступен.")}</p>{data?(filters.q||filters.category?<button type="button" onClick={resetFilters}>{tr("Сбросить поиск и категорию")}</button>:onlyFavorites?<a href={localHref("/#selected")}>{tr("Все экскурсии")}</a>:null):<button type="button" onClick={retry}>{tr("Повторить загрузку")}</button>}</div> : null}
        </div>
        <div className={styles.selectionBottom}>
          <p className={styles.selectionClosing}>{copy.closingLine.map(tr).join(' ')}</p>
          {hasMore?<a className={styles.showMore} href={localHref(nextHref)} rel="next" onClick={handleLoadMore} aria-disabled={catalogBusy||loadingMore||!!catalogError} aria-controls="excursion-cards" aria-busy={loadingMore} aria-label={`${moreLabel}. ${progressLabel}`}>
            <span>{moreLabel}</span>
            {data&&<span className={styles.progressBadge} aria-hidden="true">{shown} / {data.total}</span>}
            {!catalogBusy&&!loadingMore&&<Plus size={17} aria-hidden="true"/>}
          </a>:<button type="button" className={styles.showMore} disabled><span>{!favoritesReady?tr("Загружаем избранное…"):!data?tr("Подборка недоступна"):firstPage>1&&shown<data.total?tr("Больше экскурсий нет"):(locale === 'ru' ? completedProgramLabel(data.total) : tr("Все экскурсии показаны") + " · " + String(data.total))}</span>{data&&data.total>0&&<Check size={17} aria-hidden="true"/>}</button>}
        </div>
        {firstPage>1&&<nav className={styles.pageNavigation} aria-label={tr("Страницы экскурсий")}><a href={localHref(catalogHref({...appliedFilters,page:firstPage-1},{favorites:onlyFavorites}))} rel="prev">{tr("Предыдущие экскурсии")}</a><a href={localHref(catalogHref({...appliedFilters,page:1},{favorites:onlyFavorites}))}>{tr("К началу подборки")}</a></nav>}
        {moreError&&<p className={styles.feedError} role="alert">{tr(moreError)} {tr("Уже показанные экскурсии сохранены.")}</p>}
        <span className={styles.visuallyHidden} role="status" aria-live="polite" aria-atomic="true">{catalogBusy?tr("Обновляем подборку"):loadingMore?tr("Загружаем ещё экскурсии"):lastAppend?tr("Добавлено: {0}. {1}").replace("{0}", String(lastAppend.addedCount)).replace("{1}", String(progressLabel)):progressLabel}</span>
      </section>
    </main>
    <footer className={styles.footer}><Link className={styles.footerBrand} href={localHref("/#selected")}><BrandMark/><div>Double Bottle Co’<span>PHUKET &amp; BEYOND</span></div></Link><p>{tr(copy.footerLine)}</p><nav aria-label={tr("Служебная навигация")}><a href={localHref("/guide")}>{tr("Как забронировать")}</a><a href={localHref("/privacy")}>{tr("Конфиденциальность")}</a><a href={localHref("/credits")}>{tr("Источники")}</a></nav><LicenseBadge/></footer>
    {error && <div className={styles.error} role="alert"><span>{tr(error)}</span><button aria-label={tr("Закрыть уведомление")} onClick={() => setError('')}><X size={18}/></button></div>}
  </div></MapLayoutProvider>;
}
