"""One-way reviewed migration of the prior editorial catalogue; raw sources stay private.
Inputs are explicit files. No network access and no mutation of TOURS MASTER.
Future edits use the stable IDs in the emitted import packet, not source row numbers.
"""
import json, hashlib, re, sys, uuid, argparse
from pathlib import Path
from PIL import Image
from fontTools import subset

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--legacy',required=True,type=Path,help='Reviewed legacy window.ATLAS source file')
parser.add_argument('--assets',required=True,type=Path,help='Licensed source images and verified geography directory')
parser.add_argument('--font-license',required=True,type=Path)
args=parser.parse_args()
OLD=args.legacy
ASSETS=args.assets
CHECKED='2026-10-04'
def stable(kind,key): return kind+'_'+uuid.uuid5(uuid.NAMESPACE_URL,'elysiam:catalog:'+kind+':'+key).hex[:24]
def digest(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
old=json.loads(OLD.read_text()[len('window.ATLAS = '):].strip().rstrip(';'))
prov=json.loads((ASSETS/'provenance.json').read_text())
for d in ['public/media','public/map','public/fonts','content','docs','private-import']:(ROOT/d).mkdir(parents=True,exist_ok=True)
media=[]
for slug,m in zip(['phi-phi','phang-nga','racha','cheow-lan'],prov['photos']):
 im=Image.open(ASSETS/m['file']).convert('RGB');im.thumbnail((1800,1400));target=ROOT/'public/media'/f'{slug}.webp';temp=target.with_suffix('.tmp');im.save(temp,'WEBP',quality=86);temp.replace(target)
 media.append({'id':'media_'+slug,'path':f'/media/{slug}.webp','license':m['license'],'attribution':m['credit'],'sourceUrl':m['source_page'],'licenseUrl':m['license_url'],'modifications':'Уменьшение размера, WebP; кадрирование при отображении.','title':m['destination']})
(ROOT/'public/map/andaman.geojson').write_bytes((ASSETS/'southwest-thailand-land-osm.geojson').read_bytes())
(ROOT/'public/map/README.txt').write_text('Derived from OpenStreetMap coastline data. © OpenStreetMap contributors.\nODbL 1.0 https://www.openstreetmap.org/copyright\nSource snapshot: 2026-10-04T08:41:36Z\nClipped and simplified with Shapely; no invented coastlines.\nInland water is not represented.\n')
(ROOT/'content/media-credits.json').write_text(json.dumps(media,ensure_ascii=False,indent=2))
options=subset.Options();options.flavor='woff'
for source,name in [('NimbusSans-Regular.otf','nimbus-sans-regular.woff'),('NimbusRoman-Regular.otf','atlas-serif.woff')]:
 font=subset.load_font('/usr/share/fonts/opentype/urw-base35/'+source,options)
 sub=subset.Subsetter(options=options);sub.populate(unicodes=list(range(32,127))+list(range(0x400,0x530))+list(range(0x2000,0x2070))+[0x0E3F]);sub.subset(font);subset.save_font(font,str(ROOT/'public/fonts'/name),options)
(ROOT/'public/fonts/LICENSE.txt').write_bytes(args.font_license.read_bytes())
points=json.loads((ASSETS/'destination-points.geojson').read_text())['features']
names={'phuket':('Пхукет','Главный остров и начало большинства поездок.'),'coral':('Корал','Небольшой остров к югу от Пхукета. Пляжи и отдых у моря.'),'racha-yai':('Рача Яй','Остров с песчаными бухтами к югу от Пхукета.'),'phi-phi-don':('Пхи-Пхи Дон','Обитаемый остров архипелага. В программах есть обед, прогулки или ночёвка.'),'phi-phi-leh':('Пхи-Пхи Ле','Майя Бэй, лагуна Пиле и известняковые скалы. Характер посещения зависит от программы.'),'maiton':('Майтон','Снорклинг и отдых на воде рядом с островом. Высадка заявлена не во всех программах.'),'khai-nok':('Кхай','Острова к востоку от Пхукета. Конкретный остров группы уточняется для программы.'),'cheow-lan':('Озеро Чео Лан','Пресноводное озеро на материке, среди лесов и известняковых скал.'),'phang-nga-bay':('Залив Пханг Нга','Мангры и известняковые острова. Маркер обозначает залив, не место высадки.'),'james-bond':('Джеймс Бонд','Кхао Пхинг Кан и соседняя скала Ко Тапу в заливе Пханг Нга.')}
dests=[]
for f in points:
 key=f['properties']['id'];lng,lat=f['geometry']['coordinates'];name,description=names[key]
 if key=='phuket':continue # A departure island is not automatically an itinerary stop.
 # The sources say Khai without always identifying Nok/Nai. Do not claim precise commercial coordinates.
 if key=='khai-nok':continue
 image='phi-phi' if key in ['phi-phi-don','phi-phi-leh'] else 'racha' if key=='racha-yai' else 'phang-nga' if key=='phang-nga-bay' else 'cheow-lan' if key=='cheow-lan' else None
 dests.append({'id':key,'slug':key,'name':name,'lat':lat,'lng':lng,'region':'mainland' if key=='cheow-lan' else 'andaman','description':description,'image':f'/media/{image}.webp' if image else None})
additional=json.loads((ASSETS/'additional-destination-points.json').read_text())['destinations']
for d in additional:
 label={'singapore':'Сингапур','kuala-lumpur':'Куала-Лумпур','bangkok':'Бангкок','similan':'Симилан, остров № 8','samet-nangshe':'Самет Нангше'}[d['id']]
 dests.append({'id':d['id'],'slug':d['id'],'name':label,'lat':d['coordinates'][1],'lng':d['coordinates'][0],'region':'beyond' if d['kind']=='city' else 'andaman','description':{'singapore':'Городская поездка с перелётом из Пхукета.','kuala-lumpur':'Столица Малайзии. Программа и перелёты согласуются на дату.','bangkok':'Столица Таиланда. Есть однодневный и двухдневный варианты.','similan':'Остров № 8 с пляжем и скалой Парус. Сезон и доступность уточняются.','samet-nangshe':'Смотровая площадка на материке с видом на залив Пханг Нга.'}[d['id']],'image':None})
def clean(s):
 for a,b in [('Phi Phi Paradise Early','Ранний выезд на катамаране'),('SeaStar',''),('A-Time',''),('Narayana Marine',''),('Best Travel Club',''),('MV Koon','судно для проживания'),('GTX130 PRO','GTX130')]: s=s.replace(a,b)
 return s.replace('Указанная цена из действующего договора до','Цена действует до').replace('Детский возраст по буклету:','Детский возраст:').replace('—','-').replace('–','-').strip()
products=[]
for t in old['tours']:
 key=t['id'];slug=key if key!='four-pearls-at' else 'andaman-pearls-two-days';pid=stable('p',slug)
 # Hold the known route conflict. Keep its identity in the draft, not in public navigation.
 publication='draft' if key=='four-pearls-at' else 'published'
 image=None
 if 'phi-phi' in key or key in ['eleven-islands','five-pearls']:image='phi-phi'
 if key in ['racha-coral','racha-coral-maiton','racha-sunrise','sea-fishing']:image='racha'
 if key in ['james-bond-catamaran','james-bond-yao','james-bond-cave','phang-nga-skywalk','sunrise-phang-nga','glowing-plankton']:image='phang-nga'
 if key in ['khao-sok','cheow-lan-day']:image='cheow-lan'
 variants=[]
 for i,ov in enumerate(t['variants']):
  vid=stable('v',slug+':'+str(i+1));itinerary=[clean(x) for x in t['route']];name=clean(ov['name']);days=2 if '2 дня' in t['duration'] else 1;transport=clean(t['transport']);description=clean(ov['difference'])
  if name in ['Speedboat','Standard']:name='Скоростная лодка' if key!='similan-early' else 'Стандартный выезд'
  if name=='Speed Catamaran':name='Скоростной катамаран'
  if name=='Early Bird':name='Ранний выезд'
  if key=='phi-phi-paradise':name='Катамаран · ранний выезд';description='Майя Бэй, лагуна Пиле, Пхи-Пхи Дон и Бамбу'
  if key=='phi-phi-lazy':
   if i==0:itinerary=itinerary[:-1];transport='Скоростная лодка'
   else:itinerary[-1]='Ранг Яй: купание и водная горка';transport='Скоростной катамаран'
  if key in ['similan-lazy','james-bond-cave']:transport='Скоростная лодка' if i==0 else 'Скоростной катамаран'
  if key=='khao-sok':
   name=['Бунгало с вентилятором','Самет Нангше + бунгало с вентилятором','Самет Нангше + бунгало с кондиционером'][i]
   itinerary=['Озеро Чео Лан: прогулка на лодке','Размещение в плавучих бунгало']+(['Вечернее и утреннее сафари','Храмы и смотровая Самет Нангше'] if i else [])
  if key=='phang-nga-skywalk':itinerary[1]='Самет Нангше: смотровая площадка' if i==0 else 'Beyond Skywalk: стеклянный мост'
  if key in ['sunrise-phang-nga','elephant-spa'] and i==1:itinerary=[s.replace('Самет Нангше на рассвете','Beyond Skywalk').replace('Самет Нангше','Beyond Skywalk') for s in itinerary]
  if key=='glowing-plankton':
   if i in [1,3]:itinerary=[s.replace('Самет Нангше','Стеклянный мост Skywalk') for s in itinerary]
   if i in [2,3]:itinerary=[s.replace('Белый храм','Посещение спа') for s in itinerary]
  if key=='bangkok':
   days=1 if i==0 else 2
   itinerary=['Перелёт из Пхукета']+(['Аюттхая','Байок','Река Чао Прайя','Ват Пхо'] if i==0 else ['Королевский дворец','Ват Пхо','Река Чао Прайя','Байок','Ночь в отеле 4*'])
  if key=='sea-fishing' and i==1:itinerary=['Наблюдение за рыбалкой с борта','Рача Яй: снорклинг','Обед'];description='Сопровождение без участия в рыбалке'
  if key=='similan-diving' and i==1:itinerary=[s for s in itinerary if not any(w in s.lower() for w in ['погруж','дайв'])];name='Проживание на борту, без дайвинга'
  public_names={'phi-phi-four-islands': 'Один день · скоростная лодка', 'racha-coral-maiton': 'Три острова · скоростная лодка', 'phi-phi-sunset': 'Пхи-Пхи и закат у Майтона', 'phi-phi-bamboo': 'Бамбу · скоростная лодка', 'james-bond-yao': 'Поздний выезд · остров Яо', 'krabi-catamaran': 'Ранний выезд · катамаран', 'james-bond-catamaran': 'Катамаран · залив Пханг Нга', 'andaman-pearls-two-days': 'Два дня · маршрут уточняется'}
  if slug in public_names:name=public_names[slug]
  if publication=='draft':description='Подробности маршрута и ночёвки требуют сверки.'
  stops=[];seen=set()
  for row in itinerary:
   matched=[]
   low=row.lower()
   if 'пхи-пхи дон' in low:matched.append(('phi-phi-don','landing'))
   if any(x in low for x in ['майя','пиле','викинг']):matched.append(('phi-phi-leh','conditional'))
   if 'корал' in low and not ('переход' in low):matched.append(('coral','landing'))
   if any(x in low for x in ['рача:', 'рача яй','рача: пляж']):matched.append(('racha-yai','snorkeling' if 'снорклинг' in low and 'пляж' not in low and key=='sea-fishing' else 'landing'))
   if 'мaйтон' in low or 'майтон' in low:matched.append(('maiton','snorkeling' if 'снорклинг' in low else 'water_stop'))
   if 'чео лан' in low:matched.append(('cheow-lan','water_stop'))
   if 'пханг нга' in low:matched.append(('phang-nga-bay','passage'))
   if 'джеймс' in low:matched.append(('james-bond','landing'))
   if 'самет нангше' in low:matched.append(('samet-nangshe','landing'))
   if 'остров № 8' in low:matched.append(('similan','landing'))
   for destination,visit in matched:
    if destination in seen:continue
    stops.append({'destinationId':destination,'sequence':len(stops)+1,'visitType':visit,'required':visit!='conditional','note':row if destination!='phi-phi-leh' else 'Вариант включает отдельные точки острова. Смотрите программу: высадка, купание и осмотр различаются.'});seen.add(destination)
  if key in ['singapore','kuala-lumpur','bangkok']:stops=[{'destinationId':key,'sequence':1,'visitType':'landing','required':True,'note':'Экскурсионная программа в городе; точку аэропорта маркер не обозначает.'}]
  rates=[]
  # Only a dated current selling rate is promoted automatically. Working prices without a validity rule stay in private source facts.
  if key=='racha-coral':
   for audience,amount,unit in [('adult',200000,'за взрослого'),('child',150000,'за ребёнка 3-10 лет')]:rates.append({'id':vid+'_'+audience,'amountMinor':amount,'currency':'THB','unit':unit,'audience':audience,'validFrom':'2026-05-25','validUntil':'2026-10-31','conditions':'Детский тариф 3-10 лет. Наличие и применимость к дате требуют подтверждения.','supplements':t['extras']})
  variants.append({'id':vid,'revisionId':'','name':name,'description':description,'duration':f'{days} дня / 1 ночь' if key=='bangkok' and days==2 else '1 день' if key=='bangkok' else t['duration'],'days':days,'transport':transport,'format':'По запросу','status':'on_request','stops':stops,'itinerary':itinerary,'includes':[clean(s) for s in t['includes']],'extras':[clean(s) for s in t['extras']],'conditions':[clean(s) for s in t['conditions']],'rates':rates,'earliestDate':'2026-10-19' if key=='similan-early' else None})
 products.append({'id':pid,'slug':slug,'title':clean(t['title']),'description':clean(t['description']),'category':'culture' if key=='phuket-city' else t['category'],'image':f'/media/{image}.webp' if image else None,'imageAlt':{'phi-phi':'Майя Бэй, Пхи-Пхи','phang-nga':'Известняковые скалы залива Пханг Нга','racha':'Бухта острова Рача Яй','cheow-lan':'Берега озера Чео Лан'}.get(image,''),'status':'on_request','publicationStatus':publication,'featuredRank':{'phi-phi-paradise':1,'james-bond-catamaran':2,'racha-coral':3,'khao-sok':4}.get(key,100),'variants':variants,'provenance':{'sourceId':stable('source',key),'source':'; '.join(v['source'] for v in t['variants']),'checkedAt':CHECKED,'hash':digest(t)},'supplier':{'id':stable('supplier',t['operator']),'name':t['operator'],'offerId':stable('offer',key),'raw':t}})
packet={'schemaVersion':1,'complete':True,'source':'TOURS MASTER - reviewed one-way migration','checkedAt':CHECKED,'products':products,'destinations':dests,'media':media}
(ROOT/'private-import/initial-catalog.json').write_text(json.dumps(packet,ensure_ascii=False,indent=2))
(ROOT/'docs/asset-provenance.json').write_text(json.dumps(prov,ensure_ascii=False,indent=2))
print(json.dumps({'products':len(products),'published':sum(t['publicationStatus']=='published' for t in products),'variants':sum(len(t['variants']) for t in products),'destinations':len(dests),'media':len(media)},ensure_ascii=False))
