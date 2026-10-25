// Focused SSR/configuration regression checks; interactive dialog behavior requires browser QA.
const fs=require('fs'),path=require('path'),ts=require('typescript'),Module=require('module'),assert=require('assert/strict');
const root=process.cwd(),oldResolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...args){return oldResolve.call(this,name.startsWith('@/')?path.join(root,name.slice(2)):name,parent,...args)};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
Module._extensions['.css']=(module)=>{module.exports=new Proxy({},{get:(_,x)=>x==='__esModule'?false:String(x)})};
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {ContactModal}=require(root+'/app/components/ContactModal.tsx');
const {LocaleProvider}=require(root+'/lib/i18n/context.tsx');
const {translateUi}=require(root+'/lib/i18n/ui-copy.ts');
const {businessContacts}=require(root+'/lib/public/business-contacts.ts');
for(const locale of ['ru','en','th']){
 const label=translateUi('Выбрать экскурсию',locale);
 const html=renderToStaticMarkup(React.createElement(LocaleProvider,{locale},React.createElement(ContactModal,{className:'primaryAction'},label)));
 assert.match(html,/<button[^>]*type="button"[^>]*class="primaryAction"/);
 assert(html.includes('aria-haspopup="dialog"'));
 assert(html.includes('aria-expanded="false"'));
 assert(html.includes(label));
 assert(!html.includes('href='));
 for(const key of ['Напишите нам','Выберите удобный способ связи.','Закрыть','Написать Double Bottle Co’ в {0} (откроется в новой вкладке)']){
  assert(translateUi(key,locale));
  if(locale!=='ru')assert(!/[А-Яа-яЁё]/.test(translateUi(key,locale)),locale+': '+key);
 }
}
assert.deepEqual(businessContacts.map(x=>x.href),['https://t.me/islandino','https://wa.me/66935871190']);
for(const contact of businessContacts){assert.equal(new URL(contact.href).search,'');assert.equal(new URL(contact.href).protocol,'https:');}
const component=fs.readFileSync('app/components/ContactModal.tsx','utf8');
for(const token of ['<Dialog.Root modal>','<Dialog.Trigger asChild>','<Dialog.Overlay','<Dialog.Content','<Dialog.Title','<Dialog.Description','<Dialog.Close','href={contact.href}','rel="noopener noreferrer"','lang={locale}'])assert(component.includes(token),token);
assert(!/fetch\(|FormData|<form|window\.open/.test(component));
const home=fs.readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
assert(home.includes('<ContactModal className={styles.primaryAction}>{tr(copy.primaryAction)}</ContactModal>'));
assert(home.includes('className={styles.cardLink} href={localHref(href)}'));
console.log('Contact modal: RU/EN/TH SSR trigger, copy, approved destinations, no-send behavior and narrow CTA wiring passed.');
