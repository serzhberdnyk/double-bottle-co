import {sourceHash} from './translation-source-hash';
import {publicTextSources,translateCatalog,type TranslationMap} from '../i18n/catalog';
type Copy={title:string;description:string};
export type SplitLocaleDrafts={sourceHash:{title:string;description:string};en:Copy;th:Copy;provenance:{method:'assistant_literal_translation';sourceReferences:string[];review:string}};
export async function validateSplitLocales(ru:Copy,input:unknown):Promise<SplitLocaleDrafts>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('SPLIT_LOCALES_REQUIRED');const p=input as SplitLocaleDrafts;
 if(Object.keys(p).sort().join(',')!=='en,provenance,sourceHash,th'||!p.sourceHash||Object.keys(p.sourceHash).sort().join(',')!=='description,title'||p.sourceHash.title!==await sourceHash(ru.title)||p.sourceHash.description!==await sourceHash(ru.description))throw Error('SPLIT_LOCALE_SOURCE_CONFLICT');
 for(const locale of ['en','th'] as const){const c=p[locale];if(!c||Object.keys(c).sort().join(',')!=='description,title'||[c.title,c.description].some(s=>typeof s!=='string'||!s.trim()||s.length>10000||/[А-Яа-яЁё]/.test(s)))throw Error('INVALID_SPLIT_LOCALE_TEXT');}
 const v=p.provenance;if(!v||Object.keys(v).sort().join(',')!=='method,review,sourceReferences'||v.method!=='assistant_literal_translation'||typeof v.review!=='string'||!v.review.trim()||v.review.length>2000||!Array.isArray(v.sourceReferences)||!v.sourceReferences.length||v.sourceReferences.length>20||v.sourceReferences.some(s=>typeof s!=='string'||!s.trim()||s.length>2000))throw Error('SPLIT_LOCALE_PROVENANCE_REQUIRED');return p;
}
export async function splitLocalePublication(db:D1Database,summary:Record<string,any>,candidate:unknown,dictionaries:Record<'en'|'th',TranslationMap>,releaseId:string,generation:number,actor:string){
 const ru=summary.sourceCopy as Copy,drafts=await validateSplitLocales(ru,summary.localeDrafts);
 const targets=(['en','th'] as const).flatMap(locale=>(['title','description'] as const).map(field=>({locale,source:ru[field],text:drafts[locale][field]})));
 const view=candidate as {id:string;title:string;description:string;imageAlt:string};
 if(view.title!==ru.title||view.description!==ru.description||view.id!==summary.vipProductId)throw Error('SPLIT_LOCALE_SOURCE_CONFLICT');
 const sources=JSON.stringify(publicTextSources(candidate));
 const snapshotSql="SELECT json_group_array(json_object('locale',locale,'source_text',source_text,'translated_text',translated_text,'published_text',published_text,'revision',revision,'updated_at',updated_at,'updated_by',updated_by)) FROM (SELECT * FROM catalog_localizations WHERE locale IN ('en','th') AND source_text IN (SELECT value FROM json_each(?)) ORDER BY locale,source_text)";
 const row=await db.prepare(snapshotSql).bind(sources).first<Record<string,string>>();const snapshot=row?Object.values(row)[0]:'[]';
 const existing=JSON.parse(snapshot) as {locale:'en'|'th';source_text:string;translated_text:string;published_text:string|null}[];
 // Existing manual rows are either exact published matches or a hard conflict.
 for(const r of targets){const old=existing.find(x=>x.locale===r.locale&&x.source_text===r.source);if(old&&(old.translated_text!==r.text||old.published_text!==r.text))throw Error('SPLIT_MANUAL_TRANSLATION_CONFLICT');}
 // Readiness and transaction guard use the same captured translation rows.
 for(const locale of ['en','th'] as const){const dict={...dictionaries[locale],...Object.fromEntries(existing.filter(r=>r.locale===locale&&r.published_text!==null).map(r=>[r.source_text,r.published_text!])),...Object.fromEntries(targets.filter(t=>t.locale===locale).map(t=>[t.source,t.text]))};if(translateCatalog(candidate,locale,dict).missing.length)throw Error('SPLIT_LOCALES_NOT_READY:'+locale);}
 const stateGuard='EXISTS(SELECT 1 FROM catalog_state WHERE id=1 AND release_id=? AND generation=?)',stamp=new Date().toISOString();
 // Executed after state CAS in same transaction: conflict rolls back catalog switch too.
 const statements=[db.prepare(`INSERT INTO internal_events(id,type,actor,created_at,data_json) SELECT ?,'split_locale_publish',?,?,CASE WHEN (${snapshotSql})=? AND EXISTS(SELECT 1 FROM catalog_release_products WHERE release_id=? AND product_id=? AND title=? AND description=? AND image_alt=?) THEN ? ELSE NULL END WHERE ${stateGuard}`).bind('locale_'+releaseId,actor,stamp,sources,snapshot,releaseId,view.id,ru.title,ru.description,view.imageAlt,JSON.stringify({releaseId,sourceHash:drafts.sourceHash,provenance:drafts.provenance}),releaseId,generation+1)];
 for(const r of targets)statements.push(db.prepare(`INSERT INTO catalog_localizations(locale,source_text,translated_text,published_text,revision,updated_at,updated_by) SELECT ?,?,?,?,1,?,? WHERE ${stateGuard} ON CONFLICT(locale,source_text) DO NOTHING`).bind(r.locale,r.source,r.text,r.text,stamp,actor,releaseId,generation+1));
 return statements;
}
