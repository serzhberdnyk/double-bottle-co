export type ServiceSort = 'default' | 'supplier';
export type ServiceCompanies = Record<string, string[]>;
export type ServiceCompany = {id:string;name:string};
export type ServiceCompanyRefs = Record<string, ServiceCompany[]>;
const collator = new Intl.Collator('ru', {sensitivity:'base', numeric:true});
export function adminCompanyChoices(services:readonly {id:string}[],companies:ServiceCompanyRefs):ServiceCompany[]{
 const choices=new Map<string,ServiceCompany>();
 for(const service of services)for(const company of companies[service.id]||[])choices.set(company.id,company);
 return [...choices.values()].sort((a,b)=>collator.compare(a.name,b.name)||a.id.localeCompare(b.id));
}
export function filterAdminServices<T extends {id:string}>(services:readonly T[],companies:ServiceCompanyRefs,companyId=''):T[]{
 return services.filter(service=>!companyId||(companies[service.id]||[]).some(company=>company.id===companyId));
}
export function companyNames(names: string[]) {
 return [...new Set(names.map(name=>name.trim()).filter(Boolean))].sort((a,b)=>collator.compare(a,b)||a.localeCompare(b));
}
export function sortAdminServices<T extends {id:string}>(services: readonly T[], companies: ServiceCompanies, sort: ServiceSort): T[] {
 if(sort==='default')return [...services];
 return services.map((service,index)=>({service,index,key:companyNames(companies[service.id]||[]).join(' / ')}))
  .sort((a,b)=>Number(!a.key)-Number(!b.key)||collator.compare(a.key,b.key)||a.index-b.index).map(row=>row.service);
}
