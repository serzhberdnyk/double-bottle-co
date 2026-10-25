import test from 'node:test';
import assert from 'node:assert/strict';
test('split UI endpoint retains owner-only reads and same-origin writes',async()=>{
 globalThis.__visibilityEnv={ADMIN_EMAILS:'owner@example.invalid',CATALOG_EDITOR_EMAILS:'editor@example.invalid'};
 const route=await import('../app/api/admin/khaosok-split/route.ts');
 for(const email of [null,'editor@example.invalid','stranger@example.invalid']){
  const headers=email?{'oai-authenticated-user-email':email,'oai-authenticated-user-id':'synthetic'}:{};
  assert.equal((await route.GET(new Request('https://example.invalid/api/admin/khaosok-split?draft=rel_split_abc',{headers}))).status,403);
 }
 const owner={'oai-authenticated-user-email':'owner@example.invalid','oai-authenticated-user-id':'synthetic-owner','content-type':'application/json'};
 for(const origin of [null,'https://other.invalid'])assert.equal((await route.POST(new Request('https://example.invalid/api/admin/khaosok-split',{method:'POST',headers:{...owner,...(origin?{origin}:{})},body:'{}'}))).status,403);
});
