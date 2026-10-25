import {z} from 'zod';

export const MAX_PROGRAMME_ITEMS=200;
export const MAX_PROGRAMME_ITEM_LENGTH=500;
export const programmeItemsSchema=z.array(z.string().trim().min(1,'Заполните пункт программы или удалите его.').max(MAX_PROGRAMME_ITEM_LENGTH)).min(1,'Добавьте хотя бы один пункт программы.').max(MAX_PROGRAMME_ITEMS);

export function moveProgrammeItem(items:string[],index:number,direction:-1|1):string[]{
 const next=index+direction;
 if(index<0||index>=items.length||next<0||next>=items.length)return items;
 const result=[...items];[result[index],result[next]]=[result[next],result[index]];return result;
}
