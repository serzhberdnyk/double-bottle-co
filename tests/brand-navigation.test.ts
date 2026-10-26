import test from 'node:test';
import assert from 'node:assert/strict';
import {brandCatalogHref} from '../lib/public/catalog-navigation';

test('brand return drops selected program and price while retaining catalogue filters',()=>{
 const href=brandCatalogHref('?variant=vip&priceOption=adult&category=sea&q=Рача&days=1&transport=boat&format=group&sort=title&page=2&favorites=1&search=1');
 const url=new URL(href,'https://example.invalid');
 assert.equal(url.pathname,'/');assert.equal(url.hash,'#selected');
 assert.deepEqual(Object.fromEntries(url.searchParams),{category:'sea',q:'Рача',days:'1',transport:'boat',format:'group',sort:'title',page:'2',favorites:'1',search:'1'});
 assert.equal(brandCatalogHref(url.search),href);
});

test('brand return is safe for an empty selection and never accepts an external destination',()=>{
 assert.equal(brandCatalogHref(''),'/#selected');
 assert.equal(brandCatalogHref('?variant=missing&priceOption=x&redirect=https://other.invalid&favorites=0'),'/#selected');
 assert.equal(brandCatalogHref('?q=a%26b%23c&variant=v1'),'/?q=a%26b%23c#selected');
});
