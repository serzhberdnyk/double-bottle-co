import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const css=readFileSync('app/reference-preview/reference.module.css','utf8');
const theme=css.slice(css.indexOf('/* COMIC HOME DRAFT:'),css.indexOf('/* Approved no-header composition:'));
test('Comic draft changes presentation only: canonical copy, markup, handlers and rates stay byte-identical to postrollback v42',()=>{
 const unchanged={
  'app/reference-preview/reference-copy.ts':'cb140100a30137b27e0d8639b8bce49e83521d030af0cd5c19bdc24c71735c36',
  'app/reference-preview/HomeCatalogFilters.tsx':'4623558c47dbe349f65cbc95b0c8b3d447cd4b77c5cb3638841668edc6581dda',
  'app/reference-preview/useReferenceCatalog.ts':'b594df3a219cdef03477b0f7c3203dd28413e2be64d2ee7193e97dfb556617cc',
  'app/reference-preview/reference-feed.ts':'46b547302579677189806893d6f298cbe9ba2325c50f34c361c2953a14e175a3',
  'app/reference-preview/reference-navigation.ts':'3fda5f831735458dfdbc6e3c4e7f71db8dfe1ef85a76ef81c73ad01d330a7e3a',
  'app/components/SiteChrome.tsx':'1b10b7dec9ab9934c56d0328a92cad03fd888c656d81135cdc3aa040b3fe8831',
  'app/components/CatalogUI.tsx':'f75ecb8d44eae17d19eaf7f573dacedcc1e1d339d0c6f4711687d796bbf76636',
  'lib/public/pricing.ts':'e39dac3a434d7f61f8dc4f73c531ff08870755a53f92de5546b603a88f61a586',
  'lib/public/tour-cover.ts':'2c7ec4e48889c48478f789a72cc7a3a5d9fd404a3269e977ceabebfa9171f6b4',
 };
 for(const [file,hash] of Object.entries(unchanged))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,file);
});
test('Comic theme reuses PhiPhi ink and paper without changing layout, hiding content or moving the map',()=>{
 for(const color of ['#153552','#fff2d3','#fff8e7','#ffca48'])assert(theme.includes(color),color);
 assert(!/(?:^|[;{])\s*(?:display|visibility|opacity|position|inset|top|left|right|bottom|z-index|width|height|min-width|max-width|min-height|max-height|aspect-ratio|grid-template[^:]*|order|padding[^:]*|margin[^:]*|gap|overflow[^:]*|transform|pointer-events)\s*:/m.test(theme));
 assert(!/\.(?:sourceMapScene|sourceArtPlane|sourceMapImage|cleanPlate)\s*[{,:]/.test(theme));
 assert(!/content\s*:|url\s*\(/.test(theme));
 assert(theme.includes('@media(max-width:760px)'));assert(theme.includes(':focus-visible'));
});

test('Approved home composition removes the header and eyebrow, keeps the brand link and one unchanged h1',()=>{
 const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
 assert(!home.includes('ArrowRight'));assert(!home.includes('<header'));assert(!home.includes('menuOpen'));
 assert(!home.includes('const navigation'));assert(!home.includes('copy.eyebrow'));
 assert(home.includes('<Link className={styles.heroBrand} href="/#selected" aria-label="Double Bottle Co’ — главная">Double Bottle Co’<span>PHUKET &amp; BEYOND</span></Link>'));
 assert(home.includes('<h1 id="reference-heading">{copy.headline.map(line => <span key={line}>{line}</span>)}</h1>'));
 assert(home.includes('className={styles.primaryAction} href="/#selected">{copy.primaryAction}</a>'));
 assert(home.includes('className={styles.skipLink} href="#main-content"'));assert(home.includes('<main id="main-content">'));
 assert(home.indexOf('className={styles.heroBrand}')<home.indexOf('<h1'));
 const spacing=css.slice(css.indexOf('/* Approved no-header composition:'));
 assert(spacing.includes('padding-top:24px'));assert(spacing.includes('justify-content:center;text-align:center'));
 assert(spacing.includes('padding-left:24px;padding-right:24px'));assert(spacing.includes('font:400 36px/.95 ReferenceDisplay'));
 assert(!/sourceArtPlane|sourceMapImage|cleanPlate/.test(spacing));
});
