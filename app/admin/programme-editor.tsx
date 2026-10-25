'use client';
import {useId} from 'react';
import {MAX_PROGRAMME_ITEMS,MAX_PROGRAMME_ITEM_LENGTH,moveProgrammeItem} from '@/lib/public/programme-items';

export function ProgrammeEditor({items,onChange,disabled=false,variantName}:{items:string[];onChange:(items:string[])=>void;disabled?:boolean;variantName:string}){
 const id=useId();
 return <fieldset disabled={disabled} aria-describedby={id+'-help'}><legend>Программа · {variantName}</legend>
  <p id={id+'-help'}>Пункты раздела «Программа» только для этого варианта. Порядок здесь — порядок карточек на сайте. Изменения появятся после сохранения черновика и публикации. Переводы нового текста добавьте в редакторе переводов.</p>
  {items.map((item,index)=><div key={index}>
   <label htmlFor={id+'-'+index}>Пункт {String(index+1).padStart(2,'0')}<textarea id={id+'-'+index} value={item} rows={2} maxLength={MAX_PROGRAMME_ITEM_LENGTH} aria-invalid={!item.trim()} onChange={e=>onChange(items.map((value,i)=>i===index?e.target.value:value))}/></label>
   {!item.trim()&&<small role="status">Заполните пункт или удалите его.</small>}
   <button type="button" disabled={disabled||index===0} aria-label={'Поднять пункт '+(index+1)} onClick={()=>onChange(moveProgrammeItem(items,index,-1))}>↑ Выше</button>{' '}
   <button type="button" disabled={disabled||index===items.length-1} aria-label={'Опустить пункт '+(index+1)} onClick={()=>onChange(moveProgrammeItem(items,index,1))}>↓ Ниже</button>{' '}
   <button type="button" disabled={disabled} aria-label={'Удалить пункт '+(index+1)} onClick={()=>onChange(items.filter((_,i)=>i!==index))}>Удалить пункт</button>
  </div>)}
  {!items.length&&<p role="status">Добавьте хотя бы один пункт программы.</p>}
  <button type="button" disabled={disabled||items.length>=MAX_PROGRAMME_ITEMS} onClick={()=>onChange([...items,''])}>Добавить пункт программы</button>
  <small> {items.length} / {MAX_PROGRAMME_ITEMS} · до {MAX_PROGRAMME_ITEM_LENGTH} символов в пункте</small>
 </fieldset>;
}
