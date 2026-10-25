export type ServiceSort = 'default' | 'supplier';
export type ServiceCompanies = Record<string, string[]>;
const collator = new Intl.Collator('ru', {sensitivity:'base', numeric:true});
export function companyNames(names: string[]) {
 return [...new Set(names.map(name=>name.trim()).filter(Boolean))].sort((a,b)=>collator.compare(a,b)||a.localeCompare(b));
}
export function sortAdminServices<T extends {id:string}>(services: readonly T[], companies: ServiceCompanies, sort: ServiceSort): T[] {
 if(sort==='default')return [...services];
 return services.map((service,index)=>({service,index,key:companyNames(companies[service.id]||[]).join(' / ')}))
  .sort((a,b)=>Number(!a.key)-Number(!b.key)||collator.compare(a.key,b.key)||a.index-b.index).map(row=>row.service);
}
