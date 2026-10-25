import sqlite3, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Ownership(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:'); self.db.execute('PRAGMA foreign_keys=ON')
  for f in sorted((ROOT/'drizzle').glob('*.sql')):
   if f.name.startswith('0013'): continue
   self.db.executescript(f.read_text())
  for r in ['old','new']:
   self.db.execute("INSERT INTO catalog_releases VALUES (?,?,'published',NULL,'2026-10-23','test','{}')",(r,r))
  for p in ['standard','vip']: self.db.execute('INSERT INTO catalog_products VALUES (?,?)',(p,p))
  for r,p in [('old','standard'),('new','standard'),('new','vip')]:
   self.db.execute("INSERT INTO catalog_release_products (release_id,product_id,title,description,category,image_alt,sale_status,publication_status) VALUES (?,?,'title','description','tour','','available','published')",(r,p))
  for v in ['std','fan','ac']:
   self.db.execute("INSERT INTO catalog_variants VALUES (?,'standard')",(v,))
   self.db.execute("INSERT INTO catalog_variant_revisions VALUES (?,?,?,'name','2 days',2,'bus','group','{}')",('rev_'+v,v,v))
   for r in ['old','new']: self.db.execute("INSERT INTO catalog_release_variants (release_id,variant_id,revision_id,sale_status) VALUES (?,?,?,'available')",(r,v,'rev_'+v))
  self.before_migration=list(self.db.execute('SELECT * FROM catalog_release_variants'))
  self.before_triggers=list(self.db.execute("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name"))
  self.before_changes=self.db.total_changes
  self.db.executescript((ROOT/'drizzle/0013_release_variant_ownership.sql').read_text())
 def test_schema_only_no_backfill_or_triggers(self):
  self.assertEqual(self.db.total_changes,self.before_changes)
  self.assertEqual(self.db.execute('SELECT count(*) FROM catalog_release_variants WHERE product_id IS NULL').fetchone()[0],6)
  self.assertEqual([r[:-1] for r in self.db.execute('SELECT * FROM catalog_release_variants')],self.before_migration)
  self.assertEqual(list(self.db.execute("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name")),self.before_triggers)
  sql=(ROOT/'drizzle/0013_release_variant_ownership.sql').read_text()
  statements=[s.strip() for s in '\n'.join(line for line in sql.splitlines() if not line.startswith('--')).split(';') if s.strip()]
  self.assertEqual(len(statements),2)
  self.assertTrue(statements[0].startswith('ALTER TABLE'))
  self.assertTrue(statements[1].startswith('CREATE INDEX'))
 def test_release_local_split_preserves_history_and_identity(self):
  before=list(self.db.execute('SELECT * FROM catalog_variant_revisions'))
  self.db.execute("UPDATE catalog_release_variants SET product_id='vip' WHERE release_id='new' AND variant_id IN ('fan','ac')")
  self.assertEqual(self.db.execute("SELECT count(*) FROM catalog_release_variants rv JOIN catalog_variants v ON v.id=rv.variant_id WHERE release_id='old' AND COALESCE(rv.product_id,v.product_id)='standard'").fetchone()[0],3)
  self.assertEqual(self.db.execute("SELECT count(*) FROM catalog_release_variants WHERE release_id='new' AND product_id='vip'").fetchone()[0],2)
  self.assertEqual(self.db.execute("SELECT count(*) FROM catalog_variants WHERE product_id='standard'").fetchone()[0],3)
  self.assertEqual(before,list(self.db.execute('SELECT * FROM catalog_variant_revisions')))
 def test_unknown_product_rejected_by_additive_foreign_key(self):
  with self.assertRaisesRegex(sqlite3.IntegrityError,'FOREIGN KEY'): self.db.execute("UPDATE catalog_release_variants SET product_id='absent' WHERE release_id='old'")
 def test_null_owner_retains_immutable_origin(self):
  self.db.execute("UPDATE catalog_release_variants SET product_id=NULL WHERE release_id='old'")
  self.assertEqual(self.db.execute("SELECT count(*) FROM catalog_release_variants rv JOIN catalog_variants v ON v.id=rv.variant_id WHERE release_id='old' AND COALESCE(rv.product_id,v.product_id)='standard'").fetchone()[0],3)
 def test_legacy_insert_remains_null_without_data_rewrite(self):
  self.db.execute("INSERT INTO catalog_releases VALUES ('legacy','legacy','draft',NULL,'2026-10-23','test','{}')")
  self.db.execute("INSERT INTO catalog_release_products (release_id,product_id,title,description,category,image_alt,sale_status,publication_status) SELECT 'legacy',product_id,title,description,category,image_alt,sale_status,publication_status FROM catalog_release_products WHERE release_id='old'")
  self.db.execute("INSERT INTO catalog_release_variants (release_id,variant_id,revision_id,sale_status) VALUES ('legacy','fan','rev_fan','available')")
  self.assertIsNone(self.db.execute("SELECT product_id FROM catalog_release_variants WHERE release_id='legacy'").fetchone()[0])
 def test_nullable_schema_matches_runtime(self):
  info=next(row for row in self.db.execute('PRAGMA table_info(catalog_release_variants)') if row[1]=='product_id')
  self.assertEqual(info[3],0)
  self.assertIn("productId:text('product_id').references(()=>products.id)",(ROOT/'db/schema.ts').read_text())
 def test_clone_preserves_release_owner(self):
  self.db.execute("UPDATE catalog_release_variants SET product_id='vip' WHERE release_id='new' AND variant_id='fan'")
  cols=[r[1] for r in self.db.execute('PRAGMA table_info(catalog_release_variants)')]
  self.assertIn('product_id',cols)
  # The runtime clone copies every PRAGMA-discovered field, including ownership.
  copy=(ROOT/'lib/server/catalog-release-copy.ts').read_text()
  self.assertIn('PRAGMA table_info',copy);self.assertIn("return '\"'+c+'\"'",copy)
 def test_no_historical_identity_mutation(self):
  source='\n'.join(p.read_text() for p in (ROOT/'lib/server').glob('*.ts'))
  self.assertNotIn('UPDATE catalog_variants SET product_id',source)
if __name__=='__main__': unittest.main(verbosity=2)
