import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './d1-adapter.ts';
import {product} from '../lib/server/catalog.ts';

test('historical Standard cannot expose AC after its current VIP owner is archived; editor retains history',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const sql=db.sqlite;
 for(const release of ['old','current'])sql.prepare("INSERT INTO catalog_releases (id,hash,status,created_at,created_by,summary_json) VALUES (?,?,'published','2026-01-01','test','{}')").run(release,release);
 sql.exec("INSERT INTO catalog_products VALUES ('standard','standard'),('vip','vip'); INSERT INTO catalog_state VALUES (1,'current',1)");
 for(const release of ['old','current'])for(const owner of ['standard','vip'])sql.prepare("INSERT INTO catalog_release_products (release_id,product_id,slug,title,description,category,image,image_alt,sale_status,publication_status) VALUES (?,?,?,?,?,'tour','/media/test.webp','test','available','published')").run(release,owner,owner,owner,'Description');
 for(const [id,visible] of [['ac',1],['fan',0]]){
  sql.prepare("INSERT INTO catalog_variants VALUES (?,'standard')").run(id);
  sql.prepare("INSERT INTO catalog_variant_revisions VALUES (?,?,?,'Variant','2 days',2,'bus','group','{}')").run(id+'-rev',id,id+'-hash');
  for(const release of ['old','current'])sql.prepare("INSERT INTO catalog_release_variants (release_id,variant_id,revision_id,sale_status,visible,product_id) VALUES (?,?,?,'available',?,?)").run(release,id,id+'-rev',visible,release==='old'?null:'vip');
 }
 const before=sql.prepare('SELECT * FROM catalog_release_variants ORDER BY release_id,variant_id').all();
 assert.deepEqual((await product(db,'standard','old')).tour.variants.map(v=>v.id),['ac']);
 sql.exec("UPDATE catalog_release_products SET publication_status='archived' WHERE release_id='current' AND product_id='vip'");
 assert.equal(await product(db,'standard','old'),null);
 const editor=await product(db,'standard','old',true);assert.deepEqual(editor.tour.variants.map(v=>v.id).sort(),['ac','fan']);
 assert.deepEqual(sql.prepare('SELECT * FROM catalog_release_variants ORDER BY release_id,variant_id').all(),before);
 assert.equal(await product(db,'vip'),null);
});
