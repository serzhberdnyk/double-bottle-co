export type TranslationReadiness={ready:boolean;missing:string[]};
export type LocaleReadiness=Record<'en'|'th',TranslationReadiness>;
export type CatalogLocalizationReadiness={
 releaseId:string;generation:number;mode:'manual-review';providerConfigured:false;
 locales:Record<'en'|'th',{ready:number;total:number;missing:string[]}>;
 tours:{id:string;title:string;locales:LocaleReadiness}[];
};
/** Reflect only a confirmed publication. Saving a draft must never unlock a card. */
export function withPublishedTranslation(status:CatalogLocalizationReadiness,locale:'en'|'th',source:string):CatalogLocalizationReadiness{
 const tours=status.tours.map(tour=>{const missing=tour.locales[locale].missing.filter(text=>text!==source);return {...tour,locales:{...tour.locales,[locale]:{ready:missing.length===0,missing}}};});
 return {...status,tours,locales:{...status.locales,[locale]:{...status.locales[locale],ready:tours.filter(tour=>tour.locales[locale].ready).length,missing:status.locales[locale].missing.filter(text=>text!==source)}}};
}
