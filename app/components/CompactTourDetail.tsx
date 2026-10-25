'use client';
import {ApprovedBrochures} from './ApprovedBrochures';
import {PublishedTourRoutes} from './PublishedRouteMap';
import {mapRouteCopy} from './map-route-copy';
import {routesForTour} from '@/lib/public/map-route-display';
import type {MapRoute} from '@/lib/public/map-layout';
import {useI18n} from '@/lib/i18n/context';


import type {ReactNode} from 'react';
import {ArrowRight, Check, Heart, Plus} from 'lucide-react';
import {isApprovedReviewTour} from '@/lib/public/approved-review-queue';
import {compactTourModel} from '@/lib/public/compact-tour';
import {approvedTourCover} from '@/lib/public/tour-cover';
import {categoryNames, visitNames, type Tour, type Variant} from '@/lib/public/types';
import {Header, Footer} from './SiteChrome';
import {VariantTourImage} from './VariantTourImage';
import {variantImageTour} from '@/lib/public/variant-image';
import styles from './CompactTourDetail.module.css';

export interface CompactTourDetailProps {
  tour: Tour;
  mapRoutes?: MapRoute[];
  variant: Variant;
  price: ReactNode;
  childPrices?: ReactNode;
  variantSelector?: ReactNode;
  inquiryDialog: ReactNode;
  onRequest: (trigger:HTMLButtonElement) => void;
  onFavorite: () => void;
  saved: boolean;
  favoriteError?: string;
}

/** Presentation only: published content and availability come from the public model. */
export function CompactTourDetail({
  tour, variant, price, childPrices, variantSelector, inquiryDialog,
  onRequest, onFavorite, saved, favoriteError, mapRoutes=[],
}: CompactTourDetailProps) {
 const {locale,t:tr,href:localHref}=useI18n();
 const linkedRoutes=routesForTour(mapRoutes,tour.id);
 const mapCopy=mapRouteCopy[locale];

  const model = compactTourModel(tour, variant);
  const cover = approvedTourCover(variantImageTour(tour,variant));

  const requestButton = (
    <button className={styles.requestButton} type="button" onClick={event=>onRequest(event.currentTarget)} disabled={model.unavailable}>
      <span>{model.unavailable ? tr("Временно недоступно") : tr("Запросить дату")}</span>
      <ArrowRight size={27} strokeWidth={1.25} aria-hidden="true" />
    </button>
  );

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label={tr("Хлебные крошки")}>
          <a href={localHref("/#selected")}>{tr("Экскурсии")}</a>
          {tr(categoryNames[tour.category]) && <><span aria-hidden="true">/</span><a href={localHref('/?category=' + encodeURIComponent(tour.category) + '#selected')}>{tr(categoryNames[tour.category])}</a></>}
        </nav>

        <div className={styles.titleRow}>
          <h1>{tour.title}</h1>
          <button
            className={styles.favorite}
            type="button"
            onClick={onFavorite}
            aria-label={saved ? tr("Убрать из избранного") : tr("Сохранить в избранное")}
            aria-pressed={saved}
            title={saved ? tr("Сохранено в избранном") : tr("Сохранить в избранное")}
          >
            <Heart size={24} strokeWidth={1.4} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        </div>
        {favoriteError && <p className={styles.error} role="alert">{tr(favoriteError)}</p>}

        <section className={styles.hero} aria-label={tr("Коротко о поездке")}>
          <div className={styles.heroNarrative}>
          <figure className={styles.photo}>
            <VariantTourImage
              tour={tour}
              variant={variant}
              className={`${styles.photoImage} ${cover ? styles.illustrationImage : ''}`}
              sizes="(max-width: 760px) 90vw, (max-width: 1440px) 52vw, 736px"
              eager
              arrival
              fallback={<div className={styles.photoFallback} role="img" aria-label={tr("Фотография пока недоступна")}>Double Bottle Co’</div>}
            />
            <figcaption className={styles.photoMap}>
              <details className={styles.regionalMap} open={linkedRoutes.length>0?true:undefined}>
                <summary><span>{linkedRoutes.length?mapCopy.tourMap:mapCopy.region}</span><Plus size={18} strokeWidth={1.5} aria-hidden="true" /></summary>
                {linkedRoutes.length?<PublishedTourRoutes routes={linkedRoutes}/>:<>
                <p>{mapCopy.regionNotice}</p>
                <figure>
                  {/* Unassigned tours keep the existing honest regional overview. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/media/reference/andaman-user-map.png" alt={mapCopy.regionAlt} loading="lazy" decoding="async" />
                  <figcaption>{mapCopy.regionCaption}</figcaption>
                </figure></>}
              </details>
            </figcaption>
          </figure>
          <ApprovedBrochures productId={tour.id}/>

          <section className={styles.program} aria-labelledby="compact-program-title">
            <h2 id="compact-program-title">{tr("Программа")}</h2>
            {model.itinerary.length > 0 ? (
              <ol className={styles.itinerary}>
                {model.itinerary.map((line, index) => <li key={index}><span className={styles.stepNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{tr(line)}</span></li>)}
              </ol>
            ) : <p className={styles.emptyNote}>{tr("Подробную программу уточним перед подтверждением поездки.")}</p>}
            {model.routeNotes.length > 0 && <div className={styles.routeNotes}>{model.routeNotes.map((line, index) => <p key={index}>{tr(line)}</p>)}</div>}
            {(isApprovedReviewTour(tour) || (tour.id==='p_40cbe5f22267527c94bc5a8b' && tour.slug==='phi-phi-sunrise') || (tour.id==='p_3667f6d249165a538cd50188' && tour.slug==='phi-phi-fishing') || (tour.id==='p_26d3b3eb87f65341b3af9fcc' && tour.slug==='phi-phi-racha-party')) && variant.stops.length > 0 && <div className="stop-tags">{variant.stops.map(stop => <a key={stop.sequence} href={localHref('/?destination=' + encodeURIComponent(stop.destinationId) + '#selected')}><span>{stop.name}<small>{tr(visitNames[stop.visitType])}</small></span></a>)}</div>}
          </section>
          </div>

          <aside className={styles.summaryCard}>
            <span className={styles.eyebrow}>{tr("Коротко о поездке")}</span>
            {model.facts.length > 0 && <p className={styles.facts}>{model.facts.map(tr).join(' · ')}</p>}
            {model.overview && <p className={styles.overview}>{model.overview}</p>}
            {model.description && model.description !== model.overview && <p className={styles.description}>{model.description}</p>}
            {variantSelector && <div className={styles.variantSelector}>{variantSelector}</div>}
            {model.schedule.length > 0 && <div className={styles.schedule}>{model.schedule.map((line, index) => <p key={index}>{tr(line)}</p>)}</div>}
            <div className={styles.priceBlock}>
              <span className={styles.priceLabel}>{tr("Стоимость")}</span>
              {price}
              {childPrices && <div className={styles.childPrices}>{childPrices}</div>}
            </div>
            {requestButton}
            {model.unavailable ? (
              <a className={styles.catalogLink} href={localHref("/#selected")}>{tr("Посмотреть другие программы")}<ArrowRight size={18} aria-hidden="true" /></a>
            ) : (
              <p className={styles.bookingNote}>{tr("Наличие и итоговую стоимость подтвердим на вашу дату. Без оплаты на сайте.")}</p>
            )}
          </aside>
        </section>

        <div className={styles.detailsGrid}>


          <section className={styles.inclusions} aria-labelledby="compact-conditions-title">
            <h2 id="compact-conditions-title">{tr("Включено и условия")}</h2>
            <div className={styles.conditionsCard}>
              <section className={styles.conditionGroup}>
                <h3>{tr("Уже включено")}</h3>
                {model.includes.length > 0 ? <ul className={styles.includedList}>{model.includes.map((line, index) => <li key={index}><Check size={18} strokeWidth={1.6} aria-hidden="true" /><span>{tr(line)}</span></li>)}</ul> : <p>{tr("Состав услуг уточним для выбранного варианта.")}</p>}
              </section>
              {(model.extras.length > 0 || model.conditions.length > 0) && <section className={styles.conditionGroup}>
                <h3>{tr("Согласуем до оплаты")}</h3>
                <ul className={styles.conditionsList}>{[...model.extras,...model.conditions].map((line, index) => <li key={index}>{tr(line)}</li>)}</ul>
              </section>}

            </div>
          </section>
        </div>


      </main>
      {inquiryDialog}
      <Footer />
    </div>
  );
}
