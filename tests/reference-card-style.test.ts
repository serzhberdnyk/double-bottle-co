import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
const css=readFileSync('app/reference-preview/reference.module.css','utf8');

test('Lower gallery loads more inline and its full-card links keep canonical detail navigation',()=>{
  const section=home.slice(home.indexOf('<section id="selected"'),home.indexOf('</main>'));
  assert(section.includes('onClick={handleLoadMore}'));assert(section.includes('{moreLabel}'));assert(home.includes("'Показать ещё'"));
  assert(!section.includes('href={catalogueHref}'));assert(!section.includes('href="/catalog"'));
  assert(home.includes('href={href} data-tour-link={tour.id}'));
  assert(home.includes('`/tour/${tour.slug}?variant=${encodeURIComponent(variant.id)}`'));
  assert(home.includes('ReferenceCard key={tour.id}'));assert(home.includes('firstAdded?.focus({preventScroll:true})'));
  assert(!home.includes('scrollIntoView'));assert(!home.includes('window.scrollTo'));
  assert(section.includes('aria-live="polite"'));assert(section.includes('lastAppend.addedCount'));
});

test('Palm photo-hover and flat-card treatment stay separate from tactile CTA depth',()=>{
  const styles=css.slice(css.indexOf('/* Palm card rhythm'));
  assert(styles.includes('transition:transform .45s ease'));assert(styles.includes('transform:scale(1.018)'));
  assert(styles.includes('box-shadow:none;transform:none'));assert(styles.includes('border-radius:5px'));
  assert(styles.includes('aspect-ratio:1.24'));assert(styles.includes('aspect-ratio:1.32'));
  assert(styles.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
  assert(styles.includes('@media(max-width:1050px)'));assert(styles.includes('@media(max-width:600px)'));
  assert(styles.includes('border-radius:11px;min-height:44px'));
  assert(styles.includes('transform .16s ease,box-shadow .16s ease'));
  assert(styles.includes('transform:translateY(-1px)'));assert(styles.includes('inset 0 2px 3px'));
  assert(styles.includes('.revealedCard {animation:revealExcursion .3s ease both}'));
  assert(styles.includes('prefers-reduced-motion:reduce'));
});

test('Card pricing reads published rates and initial/next pages share the same catalogue selection',()=>{
  assert(home.includes('priceLabel(variant.rates, today)'));assert(home.includes('todayInThailand'));
  assert(!home.includes('2800'));assert(!home.includes('2 800'));
  const page=readFileSync('app/page.tsx','utf8');
  assert(page.includes('catalog(database(), query)'));assert(!page.includes('featured: true'));
  assert(!page.includes('private-import'));
});

test('Unknown on-request format is omitted without changing the price label',()=>{
  assert(home.includes("format.toLowerCase()!=='по запросу'"));
  assert(home.includes("<CatalogPrice variant={{...variant,rates:tour.variants.flatMap(v=>displayRates(v))}}/>"));
  assert(css.includes(".cardLink {display:block;min-width:0;height:auto;"));
  assert(!css.includes(".cardBottom"));
});
