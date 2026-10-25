import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {businessContacts} from '../lib/public/business-contacts';

test('Inquiry alternatives contain only supplied business destinations, without guest data or prefilled messages',()=>{
  assert.deepEqual(businessContacts,[
    {service:'telegram',label:'Telegram',href:'https://t.me/islandino'},
    {service:'whatsapp',label:'WhatsApp',href:'https://wa.me/66935871190'},
  ]);
  for(const contact of businessContacts){const url=new URL(contact.href);assert.equal(url.protocol,'https:');assert.equal(url.search,'');assert.equal(url.hash,'');assert.equal(url.username,'');}
  const component=readFileSync('app/components/InquiryDialogHeader.tsx','utf8');
  assert(component.includes('href={contact.href}'));assert(component.includes('rel="noopener noreferrer"'));
  assert(!/FormData|fetch\(|onClick|window\.open/.test(component));
  const host=readFileSync('app/components/CatalogUI.tsx','utf8');
  assert.equal(host.match(/<InquiryDialogHeader\/>/g)?.length,2);
  assert.equal(host.match(/<InquiryForm tour=\{tour\} variant=\{v\} releaseId=\{releaseId\}/g)?.length,2);
});

test('Footer badge uses the supplied emblem viewport and the corrected owner-provided number',()=>{
  const badge=readFileSync('app/components/LicenseBadge.tsx','utf8');
  assert(badge.includes('32/02104'));assert(!badge.includes('34/01750'));
  assert(badge.includes('TAT LICENSE'));assert(badge.includes('/media/reference/tat-badge-user-reference.png'));
  assert(!/<svg|<path|verified|valid until/i.test(badge));
  assert(readFileSync('app/components/SiteChrome.tsx','utf8').includes('<LicenseBadge/>'));
  assert(readFileSync('app/reference-preview/ReferenceHome.tsx','utf8').includes('<LicenseBadge/>'));
});
