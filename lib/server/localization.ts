import generation76Backfill from '../../content/catalog-backfill-gen76.json' with {type:'json'};
import approvedCopy from '../../content/approved-eight/copy.json' with {type:'json'};
import {catalogDictionary,translateCatalog,type TranslationMap} from '../i18n/catalog';
import type {Locale} from '../i18n/core';
import type {Tour} from '../public/types';
import type {LocaleReadiness,CatalogLocalizationReadiness} from '../public/catalog-localization';
/** Additive exact-source gen76 backfill; prior approved seeds and published DB
 * overrides remain authoritative. This is not an automatic translation engine.
 * Admin readiness and public reads must use this same effective dictionary. */
export function translationSeed(locale:Locale):TranslationMap{return locale==='ru'?{}:{...generation76Backfill[locale],...catalogDictionary(locale,approvedCopy[locale])};}
export async function publishedTranslations(db:D1Database,locale:Locale):Promise<TranslationMap>{if(locale==='ru')return {};try{const rows=await db.prepare("SELECT source_text,published_text AS translated_text FROM catalog_localizations WHERE locale=? AND published_text IS NOT NULL").bind(locale).all<{source_text:string;translated_text:string}>();return {...translationSeed(locale),...Object.fromEntries(rows.results.map(x=>[x.source_text,x.translated_text]))};}catch(error){if(!/no such table.*catalog_localizations/i.test(String(error)))throw error;return translationSeed(locale);}}

/** The same full-DTO completeness rule controls the public catalog and editor.
 * Do not substitute Russian copy or copy translations across unequal sources. */
export function translationReadiness(value:unknown,dictionaries:Record<'en'|'th',TranslationMap>):LocaleReadiness{
 return Object.fromEntries((['en','th'] as const).map(locale=>{
  const missing=translateCatalog(value,locale,dictionaries[locale]).missing;
  return [locale,{ready:missing.length===0,missing}];
 })) as LocaleReadiness;
}
export function catalogTranslationStatus(source:{tours:Tour[]},dictionaries:Record<'en'|'th',TranslationMap>,releaseId:string,generation:number):CatalogLocalizationReadiness{
 const tours=source.tours.map(tour=>({id:tour.id,title:tour.title,locales:translationReadiness(tour,dictionaries)}));
 const all=translationReadiness(source,dictionaries);
 return {releaseId,generation,mode:'manual-review',providerConfigured:false,tours,locales:Object.fromEntries((['en','th'] as const).map(locale=>[locale,{total:tours.length,ready:tours.filter(tour=>tour.locales[locale].ready).length,missing:all[locale].missing}])) as CatalogLocalizationReadiness['locales']};
}
