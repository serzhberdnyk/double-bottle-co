import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {referenceCopy} from '../app/reference-preview/reference-copy';
import {translateUi} from '../lib/i18n/ui-copy';
test('hero contact CTA uses requested text in RU and existing contact terminology in EN/TH',()=>{
 assert.equal(referenceCopy.primaryAction,'Связаться с нами');
 assert.equal(translateUi(referenceCopy.primaryAction,'en'),'Contact us');
 assert.equal(translateUi(referenceCopy.primaryAction,'th'),'ติดต่อเรา');
 const source=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
 assert(source.includes('<ContactModal className={styles.primaryAction}>{tr(copy.primaryAction)}</ContactModal>'));
 assert(readFileSync('app/components/CatalogUI.tsx','utf8').includes('{tr("Выбрать экскурсию")}'));
});
