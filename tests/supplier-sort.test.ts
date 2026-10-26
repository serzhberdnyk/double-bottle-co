import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sortAdminServices,companyNames,adminCompanyChoices,filterAdminServices} from '../lib/public/admin-service-sort';
import {adminServiceCompanies,adminServiceCompanyRefs} from '../lib/server/admin-service-companies';
import {testDatabase} from './d1-adapter';
import {stageImport,publishRelease,type ImportPacket} from '../lib/server/management';
import {editorState} from '../lib/server/catalog-editor';
import {catalog} from '../lib/server/catalog';

test('default order, stable company ties, unknown last and input identity are preserved',()=>{
 const services=[{id:'unknown'},{id:'b'},{id:'a2'},{id:'blank'},{id:'a1'}];
 const companies={b:['Beta'],a1:['Alpha'],a2:['alpha'],blank:['  ']};
 const before=JSON.stringify({services,companies});
 assert.deepEqual(sortAdminServices(services,companies,'default'),services);
 const sorted=sortAdminServices(services,companies,'supplier');
 assert.deepEqual(sorted.map(x=>x.id),['a2','a1','b','unknown','blank']);
 assert.equal(sorted[0],services[2]);
 assert.equal(JSON.stringify({services,companies}),before);
 assert.deepEqual(companyNames([' Beta ','Alpha','Beta','','  ']),['Alpha','Beta']);
 assert.deepEqual(sortAdminServices([],{},'supplier'),[]);
});

test('Russian names, numeric names and multiple companies sort consistently',()=>{
 const services=['z','b','a','n10','n2','multi'].map(id=>({id}));
 const companies={z:['Яхты'],b:['Бета'],a:['Альфа'],n10:['Boat 10'],n2:['Boat 2'],multi:['Яхты','Альфа','Яхты']};
 const sorted=sortAdminServices(services,companies,'supplier').map(x=>x.id);
 assert(sorted.indexOf('a')<sorted.indexOf('b'));assert(sorted.indexOf('b')<sorted.indexOf('z'));
 assert(sorted.indexOf('n2')<sorted.indexOf('n10'));assert(sorted.indexOf('multi')<sorted.indexOf('b'));
});

test('company labels follow existing bindings, survive content revisions and never mutate/publicly expose suppliers',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());
 const packet=JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket;
 const staged=await stageImport(db,packet,'test');await publishRelease(db,staged.id,0,'test');
 const publicBefore=JSON.stringify(await catalog(db,{limit:48}));
 const bindingsBefore=JSON.stringify(db.sqlite.prepare('SELECT * FROM internal_supply_bindings ORDER BY id').all());
 const state=await editorState(db);
 const imported=packet.products[0];
 assert(state.serviceCompanies[imported.id].includes(imported.supplier.name.trim()));
 assert(state.serviceCompanyRefs[imported.id].some(c=>c.id===imported.supplier.id&&c.name===imported.supplier.name.trim()));
 assert(state.serviceCompanyRefs[imported.id].every(c=>Object.keys(c).sort().join(',')==='id,name'));
 assert(!('serviceCompanyRefs' in JSON.parse(publicBefore)));
 assert(!('suppliers' in state));assert(!('serviceCompanies' in JSON.parse(publicBefore)));
 const variant=db.sqlite.prepare('SELECT rv.* FROM catalog_release_variants rv JOIN catalog_variants v ON v.id=rv.variant_id WHERE v.product_id=? LIMIT 1').get(imported.id) as any;
 db.sqlite.prepare('INSERT INTO catalog_variant_revisions SELECT ?,variant_id,hash||?,name,duration,days,transport,format,terms_json FROM catalog_variant_revisions WHERE id=?').run('test-content-revision','-edit',variant.revision_id);
 db.sqlite.prepare('UPDATE catalog_release_variants SET revision_id=? WHERE release_id=? AND variant_id=?').run('test-content-revision',variant.release_id,variant.variant_id);
 const labels=await adminServiceCompanies(db,state.state.release_id);
 assert.deepEqual(labels,state.serviceCompanies);
 assert.deepEqual(await adminServiceCompanyRefs(db,state.state.release_id),state.serviceCompanyRefs);
 db.sqlite.prepare('UPDATE catalog_release_variants SET revision_id=? WHERE release_id=? AND variant_id=?').run(variant.revision_id,variant.release_id,variant.variant_id);
 assert.equal(JSON.stringify(await catalog(db,{limit:48})),publicBefore);
 assert.equal(JSON.stringify(db.sqlite.prepare('SELECT * FROM internal_supply_bindings ORDER BY id').all()),bindingsBefore);
 db.sqlite.prepare('DELETE FROM internal_supply_bindings WHERE revision_id IN (SELECT id FROM catalog_variant_revisions WHERE variant_id IN (SELECT id FROM catalog_variants WHERE product_id=?))').run(imported.id);
 assert.equal((await adminServiceCompanies(db,state.state.release_id))[imported.id],undefined);
});

test('company filtering uses stable IDs, keeps original order and retains unknown companies in All',()=>{
 const services=[{id:'unknown'},{id:'multi',hidden:true},{id:'same-name'},{id:'a'}];
 const companies={multi:[{id:'a',name:'Острова'},{id:'b',name:'Яхты'},{id:'a',name:'Острова'}],a:[{id:'a',name:'Острова'}],'same-name':[{id:'c',name:'Острова'}]};
 const before=JSON.stringify({services,companies});
 assert.deepEqual(filterAdminServices(services,companies),services);
 assert.deepEqual(filterAdminServices(services,companies,'a'),[services[1],services[3]]);
 assert.deepEqual(filterAdminServices(services,companies,'b'),[services[1]]);
 assert.deepEqual(filterAdminServices(services,companies,'c'),[services[2]]);
 assert.deepEqual(filterAdminServices(services,companies,'missing'),[]);
 assert.deepEqual(adminCompanyChoices(services,companies).map(c=>c.id),['a','c','b']);
 assert.deepEqual(adminCompanyChoices([{id:'unknown'}],companies),[]);
 assert.equal(JSON.stringify({services,companies}),before);
});
