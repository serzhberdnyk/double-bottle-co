const fs=require('fs'),path=require('path'),ts=require(process.cwd()+'/node_modules/typescript'),Module=require('module'),assert=require('assert/strict');
const root=process.cwd(),oldResolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...args){return oldResolve.call(this,name.startsWith('@/')?path.join(root,name.slice(2)):name,parent,...args)};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
Module._extensions['.css']=(module)=>{module.exports=new Proxy({},{get:(_,x)=>x==='__esModule'?false:String(x)})};
const React=require(root+'/node_modules/react'),{renderToStaticMarkup}=require(root+'/node_modules/react-dom/server');
const {LocaleProvider}=require(root+'/lib/i18n/context.tsx'),{uiCopy}=require(root+'/lib/i18n/ui-copy.ts'),{ReferenceHome}=require(root+'/app/reference-preview/ReferenceHome.tsx');
const data={releaseId:'release-test',generation:1,items:[],total:0,page:1,pages:0,destinations:[],facets:{categories:[],durations:[],transports:[],formats:[]},count:0};
let checks=0;
for(const locale of ['ru','en','th']){
 const html=renderToStaticMarkup(React.createElement(LocaleProvider,{locale},React.createElement(ReferenceHome,{data,initialQuery:{}})));
 fs.writeFileSync(path.join(require('os').tmpdir(),'doublebottle-home-'+locale+'.html'),html);
 const footer=html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0];assert(footer);checks++;
 assert.equal((footer.match(/<nav\b/g)||[]).length,1,locale+' footer keeps only service navigation');checks++;
 assert(footer.includes('TAT LICENSE')&&footer.includes('32/02104'),locale+' TAT retained');checks++;
 const prefix=locale==='ru'?'':'/'+locale;
 assert.deepEqual([...footer.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(x=>x[1]).sort(),[prefix+(locale==='ru'?'/#selected':'#selected'),...['/guide','/privacy','/credits'].map(x=>prefix+x)].sort(),locale+' footer keeps brand/legal links only');checks++;
 assert.equal((html.match(/<nav\b[^>]*aria-label="(?:Язык сайта|Website language|ภาษาเว็บไซต์)"/g)||[]).length,1,locale+' top language switcher retained');checks++;

 assert(html.includes(locale==='ru'?'Куда или что хочется?':uiCopy[locale]['Куда или что хочется?']));checks++;
 assert(html.includes('action="'+(locale==='ru'?'/':'/'+locale)+'#selected"'));checks++;
 if(locale!=='ru'){const remnants=html.replaceAll('Русский','').match(/[А-Яа-яЁё][^<>]*/g)||[];assert.deepEqual(remnants,[],locale+' Russian remnants');checks++;assert(html.includes('href="/'+locale+'/guide"'));checks++;}
}
const {InquiryForm,Filters,TourCard}=require(root+'/app/components/CatalogUI.tsx');
const variant={id:'v1',revisionId:'r1',name:'Island day',description:'A sea trip',duration:'1 day',days:1,transport:'Boat',format:'Group',status:'on_request',stops:[],itinerary:[],includes:[],extras:[],conditions:[],rates:[],earliestDate:null};
const tour={id:'fixture',slug:'fixture',title:'Island escape',description:'A sea trip',category:'sea',image:null,imageAlt:'',status:'on_request',featuredRank:0,variants:[variant]};
for(const locale of ['en','th']){
 for(const element of [React.createElement(InquiryForm,{tour,variant,releaseId:'release-test',onClose:()=>{}}),React.createElement(TourCard,{tour}),React.createElement(Filters,{data:{...data,facets:{categories:[],durations:[1,2],transports:['Катамаран'],formats:['Групповая']}},filters:{},onChange:()=>{}})]){
  const html=renderToStaticMarkup(React.createElement(LocaleProvider,{locale},element));
  const visible=html.replace(/value="[^"]*"/g,'');
  assert(!/[А-Яа-яЁё]/.test(visible),locale+' localized inquiry/card/filter');checks++;
 }
}
const {localizedPriceText,localizedPriceUnit}=require(root+'/app/components/localized-price.ts');
const price={text:'от 2 500 ฿',unit:'с 01.12.2026 · за человека',rate:{amountMinor:250000,currency:'THB'}};
assert.equal(localizedPriceText(price,'en'),'from 2,500 ฿');checks++;
assert(!/[А-Яа-я]/.test(localizedPriceUnit(price.unit,'th')));checks++;
console.log(checks+' localized component SSR/price checks passed');
const {createReferenceCatalogController}=require(root+'/app/reference-preview/reference-feed.ts');
const {createReferenceNavigation}=require(root+'/app/reference-preview/reference-navigation.ts');
const {localePath}=require(root+'/lib/i18n/core.ts');
(async()=>{
 for(const locale of ['ru','en','th']){
  let url='https://example.test'+localePath('/?q=old#selected',locale),state=null,pop;
  const controller=createReferenceCatalogController(data,async(query)=>({...data,page:query.page||1}),{q:'old'});
  const navigation=createReferenceNavigation(controller,{url:()=>url,state:()=>state,push:(s,u)=>{state=s;url=new URL(u,url).href},replace:(s,u)=>{state=s;url=new URL(u,url).href},onPop:cb=>{pop=cb;return()=>{}}},false,p=>localePath(p,locale));
  const stop=navigation.start();await navigation.navigate({q:'new'});
  assert.equal(new URL(url).pathname,locale==='ru'?'/':'/'+locale);checks++;
  assert.equal(state.elysiamCatalog.key,new URL(url).pathname+new URL(url).search);checks++;
  assert.equal(new URL(url).searchParams.get('q'),'new');checks++;
  pop();assert.equal(controller.getSnapshot().filters.q,'new');checks++;
  stop();
 }
 console.log(checks+' total component SSR/price/history checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
