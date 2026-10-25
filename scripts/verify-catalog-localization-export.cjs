/** Offline verification against an authorized public-catalog export. No network
 * or writes to the catalog. Usage: node scripts/verify-catalog-localization-export.cjs
 * <public-export.json> <published-locale-rows.json> [readiness-output.json] */
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {translationSeed,catalogTranslationStatus}=require('../lib/server/localization.ts');
const {catalogDictionary,translateCatalog,publicTextSources}=require('../lib/i18n/catalog.ts');
const approved=require('../content/approved-eight/copy.json'),backfill=require('../content/catalog-backfill-gen76.json');
if(!process.argv[2]||!process.argv[3])throw Error('Provide the authorized public export and published locale rows.');
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),rows=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
assert.equal(input.locale,'ru');assert.equal(input.program_count,input.details.length);assert.equal(input.catalog.items.length,input.details.length);
assert.ok(input.details.every(detail=>detail.response.releaseId===input.release_id));
const source={tours:input.details.map(detail=>detail.response.tour),destinations:input.catalog.destinations,facets:input.catalog.facets},original=structuredClone(source);
const before={en:catalogDictionary('en',approved.en),th:catalogDictionary('th',approved.th)},after={en:translationSeed('en'),th:translationSeed('th')};
for(const row of rows)if(row.published_text){before[row.locale][row.source_text]=row.published_text;after[row.locale][row.source_text]=row.published_text;}
const statusBefore=catalogTranslationStatus(source,before,input.release_id,input.generation),statusAfter=catalogTranslationStatus(source,after,input.release_id,input.generation);
const textFields=new Set(['title','description','imageAlt','name','duration','transport','format','note','unit','region','label','conditions','supplements','itinerary','includes','extras','ageRule']);
function facts(value){if(Array.isArray(value))return value.map(facts);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!textFields.has(key)).map(([key,v])=>[key,facts(v)]));return value;}
for(const locale of ['en','th']){
 assert.equal(statusAfter.locales[locale].ready,source.tours.length);assert.deepEqual(statusAfter.locales[locale].missing,[]);
 const translated=translateCatalog(source,locale,after[locale]);assert.deepEqual(translated.missing,[]);assert.deepEqual(publicTextSources(translated.value),[]);
 assert.deepEqual(facts(translated.value),facts(source),'IDs, commercial facts, images, visibility, bindings and map coordinates must not change');
 for(const [key,value] of Object.entries(before[locale]))assert.equal(after[locale][key],value,'Existing published translations must remain authoritative');
 assert.equal(Object.keys(backfill[locale]).length,67);for(const [key,value] of Object.entries(backfill[locale])){assert.ok(!before[locale][key],'Backfill must be additive only');assert.ok(statusBefore.locales[locale].missing.includes(key),'Backfill must match a missing current public source');assert.ok(value.trim());assert.ok(!/[А-Яа-яЁё]/.test(value));assert.deepEqual(key.match(/\d+/g)||[],value.match(/\d+/g)||[],'Numbers/times must not change');}
}
assert.deepEqual(source,original,'Original Russian public DTO must remain unchanged');
if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(statusAfter,null,2));
console.log(JSON.stringify({generation:input.generation,releaseId:input.release_id,programs:source.tours.length,before:{en:statusBefore.locales.en.ready,th:statusBefore.locales.th.ready},after:{en:statusAfter.locales.en.ready,th:statusAfter.locales.th.ready},missingAfter:{en:statusAfter.locales.en.missing.length,th:statusAfter.locales.th.missing.length},addedPhrasesPerLocale:67,preservedPublishedRows:rows.filter(row=>row.published_text).length,commercialFactsUnchanged:true,russianSourceUnchanged:true},null,2));
