export type TranslationRow={locale:'en'|'th';source_text:string;translated_text:string;published_text:string|null;revision:number};
export type TranslationChange={locale:'en'|'th';source:string;translation:string;revision:number};
/** Reviewable import template: retain approved public text and include only
 * phrases missing at least one locale. Never publish, guess or overwrite here. */
export function translationBatchTemplate(sources:string[],rows:TranslationRow[],seed:Record<'en'|'th',Record<string,string>>){
 const published=(source:string,locale:'en'|'th')=>rows.find(row=>row.locale===locale&&row.source_text===source)?.published_text||seed[locale][source]||'';
 return {rows:sources.filter(source=>!published(source,'en')||!published(source,'th')).slice(0,100).map(source=>({source,en:published(source,'en'),th:published(source,'th')}))};
}
export function prepareTranslationBatch(input:unknown,sources:string[],rows:TranslationRow[]):TranslationChange[]{
 const value=input as {rows?:unknown};if(!value||!Array.isArray(value.rows)||value.rows.length<1||value.rows.length>100)throw Error('Нужен JSON с rows: от 1 до 100 фраз.');
 const seen=new Set<string>(),allowed=new Set(sources),changes:TranslationChange[]=[];
 for(const raw of value.rows){if(!raw||typeof raw!=='object')throw Error('Некорректная строка.');const row=raw as Record<string,unknown>;if(typeof row.source!=='string'||!allowed.has(row.source))throw Error('Исходная фраза отсутствует в текущем опубликованном каталоге.');if(seen.has(row.source))throw Error('Повтор исходной фразы.');seen.add(row.source);
  for(const locale of ['en','th'] as const){const translation=row[locale];if(typeof translation!=='string'||!translation.trim()||translation.length>16000||/[А-Яа-яЁё]/.test(translation))throw Error('Нужны непустые EN и TH переводы без русского текста.');const current=rows.find(r=>r.locale===locale&&r.source_text===row.source);if(current?.published_text===translation)continue;changes.push({locale,source:row.source,translation,revision:current?.revision||0});}
 }return changes;
}
export async function publishTranslationBatch(changes:TranslationChange[],send:(change:TranslationChange)=>Promise<{revision:number;published:boolean}>,done:(change:TranslationChange,revision:number)=>void){
 let completed=0;for(const change of changes){try{const result=await send(change);if(result.revision!==change.revision+1||result.published!==true)throw Error('Ответ не подтверждает публикацию.');done(change,result.revision);completed++;}catch(error){throw Error(`Подтверждено ${completed} из ${changes.length}. Остановлено без повтора. Обновите список и сверьте результат перед продолжением. ${String(error)}`);}}return completed;
}
