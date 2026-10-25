import {reviewQueueCover} from './approved-review-queue';
import type {Tour} from './types';

/** Approved presentation artwork only. Published facts and source photos stay intact. */
export function approvedTourCover(tour:Pick<Tour,'id'|'slug'>&{image?:string|null}) {
  if(tour.image?.startsWith('/api/catalog-media/'))return null;
  const queued=reviewQueueCover(tour);if(queued)return queued;
  if(tour.id==='p_26d3b3eb87f65341b3af9fcc'&&tour.slug==='phi-phi-racha-party')return {
    src:'/media/covers/phi-phi-racha-party-approved-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: закатная вечеринка на катамаране в море у Майтона, без высадки на остров',
    kind:'illustration' as const,
  };
  if(tour.id==='p_3667f6d249165a538cd50188'&&tour.slug==='phi-phi-fishing')return {
    src:'/media/covers/phi-phi-fishing-approved-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: белый пляж острова Бамбу, бирюзовое море и отдельная панель с удочкой; рыбалка по погоде',
    kind:'illustration' as const,
  };
  if(tour.id==='p_40cbe5f22267527c94bc5a8b'&&tour.slug==='phi-phi-sunrise')return {
    src:'/media/covers/phi-phi-sunrise-approved-v2-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: Майя Бэй на Пхи-Пхи, целые силуэты известняковых скал, бирюзовое море и символ рассвета',
    kind:'illustration' as const,
  };
  if(tour.id==='p_0344572d0f9b559aa69f76a3'&&tour.slug==='krabi-sunset')return {
    src:'/media/covers/krabi-sunset-approved-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: бухта Лао Ладинг среди известняковых скал и песчаная коса Ко Пэ на закате в Краби',
    kind:'illustration' as const,
  };
  if(tour.id==='p_9a4bfa93f43f5a378632d1ff'&&tour.slug==='eleven-islands')return {
    src:'/media/covers/eleven-islands-approved-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: три морских направления — скала Ко Тапу в Пханг Нга, остров Хонг в Краби и лагуна Пхи-Пхи',
    kind:'illustration' as const,
  };

  if(tour.id==='p_584a6bc1fa8c52f38ed26287'&&tour.slug==='rafting-atv')return {
    src:'/media/covers/rafting-atv-approved-v2-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: рафтинг на реке, участники в шлемах и спасательных жилетах, поездка на квадроцикле среди пальм',
    kind:'illustration' as const,
  };
  if(tour.id==='p_bb216414a1755c4f8b80c6b3'&&tour.slug==='jet-ski-south')return {
    src:'/media/covers/jet-ski-south-approved-v2-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: поездка на гидроцикле вокруг Пхукета, участник в спасательном жилете и мангровый берег с корнями у воды',
    kind:'illustration' as const,
  };
  if(tour.id==='p_f60658ace81d54048d0d6a8a'&&tour.slug==='khao-sok')return {
    src:'/media/covers/khao-sok-approved-v2-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: озеро Чео Лан в Као Сок, известняковые скалы и плавучие бунгало на бирюзовой воде',
    kind:'illustration' as const,
  };
  if(tour.id==='p_dd70e1051d36596481a18438'&&tour.slug==='similan-early')return {
    src:'/media/covers/similan-early-approved-v2-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: пляжи Симиланских островов, гранитные скалы и пловец со снаряжением для снорклинга в бирюзовом море',
    kind:'illustration' as const,
  };
  if(tour.id==='p_da928396eab85462af9e1007'&&tour.slug==='racha-coral')return {
    src:'/media/covers/racha-coral-approved-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: острова Рача и Корал, пальма, маска для снорклинга и бирюзовое море',
    kind:'illustration' as const,
  };
  if(tour.id==='p_94abb867f3935f649b93980e'&&tour.slug==='james-bond-catamaran')return {
    src:'/media/covers/james-bond-catamaran-approved-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: катамаран в заливе Пханг Нга, скала Ко Тапу и жёлтое солнце',
    kind:'illustration' as const,
  };
  if(tour.id!=='p_7cbe8b01189d5eaca6d50242'||tour.slug!=='phi-phi-paradise')return null;
  return {
    src:'/media/covers/phi-phi-catamaran-approved-1600.webp',
    alt:'Иллюстрация Double Bottle Co’: двухпалубный катамаран у островов Пхи-Пхи, бирюзовое море и жёлтое солнце',
    kind:'illustration' as const,
  };
}

/** Other tour covers use the same honest placeholder; this does not run image generation. */
export function tourCover(tour:Pick<Tour,'id'|'slug'>&{image?:string|null;imageAlt?:string}) {
  if(tour.image?.startsWith('/api/catalog-media/'))return {src:tour.image,alt:tour.imageAlt||'Фотография экскурсии',kind:'photo' as const};
  return approvedTourCover(tour)||{
    src:'/media/covers/illustration-coming-soon-1600.webp',
    alt:'Иллюстрация экскурсии готовится. Временная обложка Double Bottle Co’ с солнцем и геометрическими линиями',
    kind:'illustration' as const,
  };
}
