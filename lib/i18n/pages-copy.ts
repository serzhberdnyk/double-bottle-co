/** Public informational-page copy. Translation preserves the source's terms;
 * sending an inquiry is not a booking confirmation. Keep credit links intact.
 */
export type PageSection = { heading?: string; paragraphs: string[] };
export type InfoPageCopy = {
  seo: { title: string; description: string };
  eyebrow: string;
  title: [string, string];
  sections: PageSection[];
  cta?: string;
};
export type CreditsCopy = InfoPageCopy & {
  mapHeading: string; mapAttribution: string; mapLicenseBefore: string;
  mapLicenseAfter: string; downloadMap: string; mapNotes: string;
  fontsHeading: string; fontsText: string; fontLicense: string;
};
export type PagesCopy = {
  about: InfoPageCopy; guide: InfoPageCopy; privacy: InfoPageCopy;
  credits: CreditsCopy;
  destinations: InfoPageCopy & { programCount: (count: number) => string };
  destination: { titlePrefix: string; fallbackTitle: string; fallbackDescription: string };
};
export const pagesCopy: Record<'ru' | 'en' | 'th', PagesCopy> = {
  ru: {
    about: {
      seo: {title: 'О Double Bottle Co’', description: 'Double Bottle Co’ помогает выбрать экскурсии по островам, природе и городам, сравнить программы и уточнить условия поездки.'},
      eyebrow: 'Double Bottle Co’', title: ['У каждого свой', 'Таиланд.'],
      sections: [
        {paragraphs: ['Для кого-то он начинается с бирюзовой бухты. Для другого - с рассвета над заливом, ночи у озера или нового города.', 'Double Bottle Co’ помогает выбрать программу, разобраться в вариантах и согласовать детали поездки. Мы собираем островные, природные и городские впечатления в одном каталоге.']},
        {heading: 'Понятно до поездки', paragraphs: ['Мы показываем известные условия и обозначаем то, что нужно уточнить. Если цена или наличие требуют проверки, вы увидите «по запросу».', 'Туристическая лицензия: 32/02104.']}
      ], cta: 'Открыть каталог'
    },
    guide: {
      seo: {title: 'Как выбрать и забронировать', description: 'Как выбрать программу Double Bottle Co’, сравнить варианты и запросить дату. Наличие, итоговую стоимость и условия поездки согласуем до бронирования.'},
      eyebrow: 'Путешествие в вашем ритме', title: ['Сначала впечатление.', 'Потом детали.'],
      sections: [
        {heading: 'Выберите место или настроение', paragraphs: ['Острова и море, природа, активный отдых или вечернее шоу. На карте можно открыть интересующее место и увидеть программы, в которых оно есть.']},
        {heading: 'Сравните варианты', paragraphs: ['У одной экскурсии могут отличаться судно, время выезда, остановки и включённые услуги. Смотрите выбранный вариант: снорклинг рядом с островом не означает высадку.']},
        {heading: 'Запросите дату', paragraphs: ['Укажите день поездки, состав гостей и контакт. Мы уточним наличие, условия трансфера, итоговую стоимость и обязательные доплаты. Запрос на сайте не подтверждает бронирование.']},
        {heading: 'Согласуйте условия перед оплатой', paragraphs: ['В подтверждении должны быть зафиксированы программа, дата, гости, стоимость, включённые услуги и условия отмены. Любые существенные изменения обсуждаются отдельно.']}
      ], cta: 'Найти экскурсию'
    },
    privacy: {
      seo: {title: 'Обработка данных запроса', description: 'Какие данные нужны для ответа на запрос экскурсии, как Double Bottle Co’ использует контакт и как обратиться по вопросам обработки данных.'},
      eyebrow: 'Данные вашего запроса', title: ['Только для вашей', 'поездки.'],
      sections: [{paragraphs: [
        'В форме мы запрашиваем имя, контакт, дату, состав гостей и ваши пожелания. Они нужны для ответа, уточнения программы и согласования условий.',
        'Запрос хранится на сервере и доступен менеджеру. Контактные данные не публикуются в каталоге. Подтверждение отправки означает сохранение запроса, а не подтверждённое бронирование.',
        'Техническая cookie связывает этот браузер с вашими запросами и избранным. Она не используется для рекламного отслеживания. Срок действия cookie - 30 дней.',
        'Перед отправкой можно отказаться, закрыв форму. Для уточнения, изменения или удаления уже переданных данных сообщите об этом менеджеру в ответ на его обращение.'
      ]}]
    },
    credits: {
      seo: {title: 'Источники фотографий и карты', description: 'Источники и сведения об использовании фотографий и географических данных на сайте Double Bottle Co’.'},
      eyebrow: 'Авторы и открытые данные', title: ['Настоящие места.', 'Настоящие фотографии.'],
      sections: [{paragraphs: [
        'Фотографии показывают пейзажи направлений. Они не гарантируют конкретное судно, номер или оснащение экскурсии.',
        'В текущем каталоге используются реальные фотографии из материалов проекта Double Bottle Co’: Майя Бэй, Рача Яй, озеро Чео Лан, остров Пани и прогулка на гидроцикле. Файлы уменьшены для веба и преобразованы в WebP; кадрирование зависит от размера экрана.'
      ]}],
      mapHeading: 'Карта', mapAttribution: 'OpenStreetMap contributors',
      mapLicenseBefore: 'Геоданные распространяются по',
      mapLicenseAfter: 'Береговые линии подготовлены из снимка данных от 4 октября 2026 года: обрезаны по охвату и упрощены.',
      downloadMap: 'Скачать использованную географическую основу',
      mapNotes: 'Координаты мест: GeoNames (CC BY 4.0), Wikidata (CC0), Ramsar. Линии программ показывают последовательность остановок и не являются навигационными треками. Внутренние озёра в слое береговой линии не вырезаны.',
      fontsHeading: 'Шрифты', fontsText: 'Nimbus Sans и Nimbus Roman, URW Base35.', fontLicense: 'Условия использования'
    },
    destinations: {
      seo: {title: 'Направления экскурсий в Таиланде', description: 'Острова, природные места и другие направления из каталога Double Bottle Co’. Посмотрите программы и характер посещения каждого места.'},
      eyebrow: 'Места, которые останутся с вами', title: ['За следующим', 'впечатлением'],
      sections: [{paragraphs: ['Откройте место и посмотрите, какие программы проходят через него. Характер посещения указан у каждого варианта.']}],
      programCount: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'программа' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'программы' : 'программ'}`
    },
    destination: {titlePrefix: 'Экскурсии: ', fallbackTitle: 'Направление', fallbackDescription: 'Направления и экскурсии из каталога Double Bottle Co’.'}
  },
  en: {
    about: {
      seo: {title: 'About Double Bottle Co’', description: 'Explore island, nature and city tours with Double Bottle Co’. Compare itineraries and check the details before you book your trip in Thailand.'},
      eyebrow: 'Double Bottle Co’', title: ['Your own way', 'to discover Thailand.'],
      sections: [
        {paragraphs: ['For some, it starts with a turquoise bay. For others, it’s sunrise over the water, a night beside a lake or a new city to explore.', 'Double Bottle Co’ helps you choose an itinerary, understand the options and arrange the details of your trip. We bring island escapes, nature experiences and city discoveries together in one catalogue.']},
        {heading: 'Know the details before you go', paragraphs: ['We show the information available and flag anything that needs checking. If a price or availability needs to be confirmed, you’ll see “on request”.', 'Tourism licence: 32/02104.']}
      ], cta: 'Browse tours'
    },
    guide: {
      seo: {title: 'How to Choose and Book a Tour', description: 'Choose a Double Bottle Co’ tour, compare options and ask about your travel date. Confirm availability, the total price and trip terms before booking.'},
      eyebrow: 'Travel at your own pace', title: ['Start with the experience.', 'Then the details.'],
      sections: [
        {heading: 'Choose a place or a mood', paragraphs: ['Islands and sea, nature, outdoor adventures or an evening show. Select a place on the map to see the tours that include it.']},
        {heading: 'Compare your options', paragraphs: ['Options for the same tour may differ in vessel, departure time, stops and included services. Check the option you select: snorkelling near an island does not mean going ashore.']},
        {heading: 'Ask about your date', paragraphs: ['Tell us your travel date, who’s coming and how to contact you. We’ll check availability, transfer arrangements, the total price and any mandatory extras. Submitting an inquiry on the website does not confirm a booking.']},
        {heading: 'Agree on the terms before paying', paragraphs: ['The confirmation should state the itinerary, date, guests, price, included services and cancellation terms. Any significant changes are discussed separately.']}
      ], cta: 'Find a tour'
    },
    privacy: {
      seo: {title: 'How We Handle Your Inquiry Data', description: 'Learn what information Double Bottle Co’ needs to answer your tour inquiry, how your contact details are used and how to request changes to your data.'},
      eyebrow: 'Your inquiry data', title: ['Only for', 'your trip.'],
      sections: [{paragraphs: [
        'The form asks for your name, contact details, travel date, guest details and preferences. We use these to reply, clarify the itinerary and agree on the terms.',
        'Your inquiry is stored on the server and is accessible to a manager. Contact details are not published in the catalogue. A submission confirmation means your inquiry has been saved, not that a booking has been confirmed.',
        'A technical cookie links this browser to your inquiries and favourites. It is not used for advertising tracking. The cookie expires after 30 days.',
        'You can choose not to submit by closing the form. To clarify, change or delete information you have already provided, ask the manager when replying to their message.'
      ]}]
    },
    credits: {
      seo: {title: 'Photo and Map Credits', description: 'Sources and usage information for photographs, geographic data and fonts on the Double Bottle Co’ website.'},
      eyebrow: 'Creators and open data', title: ['Real places.', 'Real photographs.'],
      sections: [{paragraphs: [
        'Photographs show the scenery at each destination. They do not guarantee a particular vessel, room or equipment for a tour.',
        'The current catalogue uses real photographs from the Double Bottle Co’ project materials: Maya Bay, Racha Yai, Cheow Lan Lake, Koh Panyee and a jet ski trip. Files have been resized for the web and converted to WebP; cropping varies with screen size.'
      ]}],
      mapHeading: 'Map', mapAttribution: 'OpenStreetMap contributors',
      mapLicenseBefore: 'Geographic data is licensed under',
      mapLicenseAfter: 'Coastlines were prepared from a data snapshot dated 4 October 2026, clipped to the map area and simplified.',
      downloadMap: 'Download the geographic data used for the map',
      mapNotes: 'Place coordinates: GeoNames (CC BY 4.0), Wikidata (CC0), Ramsar. Tour lines show the order of stops and are not navigation tracks. Inland lakes have not been cut out of the coastline layer.',
      fontsHeading: 'Fonts', fontsText: 'Nimbus Sans and Nimbus Roman, URW Base35.', fontLicense: 'Licence terms'
    },
    destinations: {
      seo: {title: 'Thailand Tour Destinations', description: 'Explore islands, natural landscapes and more with Double Bottle Co’. Find tours for each destination and check how each itinerary visits the place.'},
      eyebrow: 'Places that stay with you', title: ['Find your next', 'experience'],
      sections: [{paragraphs: ['Open a destination to see the tours that include it. Each option explains how the place is visited.']}],
      programCount: (n) => `${n} ${n === 1 ? 'tour' : 'tours'}`
    },
    destination: {titlePrefix: 'Tours: ', fallbackTitle: 'Destination', fallbackDescription: 'Explore destinations and tours in the Double Bottle Co’ catalogue.'}
  },
  th: {
    about: {
      seo: {title: 'เกี่ยวกับ Double Bottle Co’', description: 'เลือกทัวร์เกาะ ธรรมชาติ และเมืองในประเทศไทยกับ Double Bottle Co’ เปรียบเทียบโปรแกรมและสอบถามรายละเอียดก่อนจองทริปของคุณ'},
      eyebrow: 'Double Bottle Co’', title: ['ค้นพบเมืองไทย', 'ในแบบของคุณ'],
      sections: [
        {paragraphs: ['สำหรับบางคน การเดินทางเริ่มต้นที่อ่าวน้ำสีฟ้าใส สำหรับอีกคน อาจเป็นแสงแรกเหนืออ่าว ค่ำคืนริมทะเลสาบ หรือการได้รู้จักเมืองใหม่', 'Double Bottle Co’ ช่วยคุณเลือกโปรแกรม ทำความเข้าใจตัวเลือก และตกลงรายละเอียดการเดินทาง เรารวมทริปเที่ยวเกาะ สัมผัสธรรมชาติ และสำรวจเมืองไว้ในแค็ตตาล็อกเดียว']},
        {heading: 'รู้รายละเอียดก่อนออกเดินทาง', paragraphs: ['เราแสดงเงื่อนไขที่ทราบแล้ว พร้อมระบุสิ่งที่ต้องสอบถามเพิ่มเติม หากราคาหรือที่ว่างยังต้องตรวจสอบ คุณจะเห็นข้อความ “สอบถามเพิ่มเติม”', 'ใบอนุญาตประกอบธุรกิจนำเที่ยว: 32/02104']}
      ], cta: 'ดูโปรแกรมทัวร์'
    },
    guide: {
      seo: {title: 'วิธีเลือกและจองทัวร์', description: 'เลือกโปรแกรม Double Bottle Co’ เปรียบเทียบตัวเลือก และสอบถามวันเดินทาง ตรวจสอบที่ว่าง ราคารวม และเงื่อนไขให้ชัดเจนก่อนจอง'},
      eyebrow: 'เดินทางในจังหวะของคุณ', title: ['เริ่มจากทริปที่อยากไป', 'แล้วค่อยดูรายละเอียด'],
      sections: [
        {heading: 'เลือกสถานที่หรือบรรยากาศที่ชอบ', paragraphs: ['เที่ยวเกาะและทะเล สัมผัสธรรมชาติ ทำกิจกรรมกลางแจ้ง หรือชมการแสดงยามค่ำคืน เลือกสถานที่บนแผนที่เพื่อดูโปรแกรมที่แวะไปยังจุดนั้น']},
        {heading: 'เปรียบเทียบตัวเลือก', paragraphs: ['ทัวร์เดียวกันอาจมีตัวเลือกที่ต่างกัน ทั้งเรือ เวลาออกเดินทาง จุดแวะ และบริการที่รวมอยู่ ตรวจสอบตัวเลือกที่คุณเลือกให้ชัดเจน: การดำน้ำตื้นใกล้เกาะไม่ได้หมายความว่าจะได้ขึ้นเกาะ']},
        {heading: 'สอบถามวันเดินทาง', paragraphs: ['ระบุวันเดินทาง รายละเอียดผู้ร่วมทริป และช่องทางติดต่อ เราจะตรวจสอบที่ว่าง เงื่อนไขรถรับส่ง ราคารวม และค่าใช้จ่ายเพิ่มเติมที่จำเป็น การส่งคำขอบนเว็บไซต์ยังไม่ใช่การยืนยันการจอง']},
        {heading: 'ตกลงเงื่อนไขก่อนชำระเงิน', paragraphs: ['การยืนยันควรระบุโปรแกรม วันเดินทาง ผู้ร่วมทริป ราคา บริการที่รวมอยู่ และเงื่อนไขการยกเลิกให้ชัดเจน หากมีการเปลี่ยนแปลงสาระสำคัญ จะต้องหารือกันเพิ่มเติม']}
      ], cta: 'ค้นหาทัวร์'
    },
    privacy: {
      seo: {title: 'การใช้ข้อมูลคำขอของคุณ', description: 'ข้อมูลที่ Double Bottle Co’ ใช้ตอบคำขอเกี่ยวกับทัวร์ วิธีใช้ข้อมูลติดต่อ และช่องทางขอแก้ไขหรือลบข้อมูลที่คุณส่งมา'},
      eyebrow: 'ข้อมูลในคำขอของคุณ', title: ['เพื่อการเดินทาง', 'ของคุณเท่านั้น'],
      sections: [{paragraphs: [
        'แบบฟอร์มจะขอชื่อ ช่องทางติดต่อ วันเดินทาง รายละเอียดผู้ร่วมทริป และความต้องการของคุณ ข้อมูลเหล่านี้ใช้เพื่อตอบกลับ สอบถามรายละเอียดโปรแกรม และตกลงเงื่อนไข',
        'คำขอจะถูกเก็บไว้บนเซิร์ฟเวอร์และผู้ดูแลสามารถเข้าถึงได้ ข้อมูลติดต่อจะไม่เผยแพร่ในแค็ตตาล็อก การยืนยันว่าส่งสำเร็จหมายถึงระบบบันทึกคำขอแล้ว ไม่ใช่การยืนยันการจอง',
        'คุกกี้ทางเทคนิคใช้เชื่อมโยงเบราว์เซอร์นี้กับคำขอและรายการโปรดของคุณ ไม่ได้ใช้ติดตามเพื่อการโฆษณา คุกกี้มีอายุ 30 วัน',
        'หากยังไม่ส่ง คุณสามารถเปลี่ยนใจได้โดยปิดแบบฟอร์ม หากต้องการสอบถาม แก้ไข หรือลบข้อมูลที่ส่งไปแล้ว ให้แจ้งผู้ดูแลเมื่อตอบกลับข้อความที่ติดต่อมาหาคุณ'
      ]}]
    },
    credits: {
      seo: {title: 'ที่มาของภาพถ่ายและแผนที่', description: 'แหล่งที่มาและข้อมูลการใช้งานภาพถ่าย ข้อมูลภูมิศาสตร์ และแบบอักษรบนเว็บไซต์ Double Bottle Co’'},
      eyebrow: 'ผู้สร้างสรรค์และข้อมูลเปิด', title: ['สถานที่จริง', 'ภาพถ่ายจริง'],
      sections: [{paragraphs: [
        'ภาพถ่ายแสดงทิวทัศน์ของแต่ละจุดหมาย ไม่ได้เป็นการรับประกันเรือ ห้องพัก หรืออุปกรณ์เฉพาะที่จะใช้ในทัวร์',
        'แค็ตตาล็อกปัจจุบันใช้ภาพถ่ายจริงจากสื่อของโครงการ Double Bottle Co’ ได้แก่ อ่าวมาหยา เกาะราชาใหญ่ ทะเลสาบเชี่ยวหลาน เกาะปันหยี และทริปเจ็ตสกี ไฟล์ถูกย่อขนาดสำหรับเว็บไซต์และแปลงเป็น WebP โดยการครอปภาพจะแตกต่างกันตามขนาดหน้าจอ'
      ]}],
      mapHeading: 'แผนที่', mapAttribution: 'OpenStreetMap contributors',
      mapLicenseBefore: 'ข้อมูลภูมิศาสตร์เผยแพร่ภายใต้สัญญาอนุญาต',
      mapLicenseAfter: 'แนวชายฝั่งจัดทำจากชุดข้อมูล ณ วันที่ 4 ตุลาคม ค.ศ. 2026 โดยตัดให้พอดีกับพื้นที่แผนที่และลดรายละเอียดลง',
      downloadMap: 'ดาวน์โหลดข้อมูลภูมิศาสตร์ที่ใช้ทำแผนที่',
      mapNotes: 'พิกัดสถานที่: GeoNames (CC BY 4.0), Wikidata (CC0), Ramsar เส้นทางทัวร์แสดงลำดับจุดแวะ ไม่ใช่เส้นทางสำหรับการนำทาง ชั้นข้อมูลแนวชายฝั่งไม่ได้ตัดพื้นที่ทะเลสาบภายในแผ่นดินออก',
      fontsHeading: 'แบบอักษร', fontsText: 'Nimbus Sans และ Nimbus Roman จาก URW Base35', fontLicense: 'เงื่อนไขการใช้งาน'
    },
    destinations: {
      seo: {title: 'จุดหมายทัวร์ในประเทศไทย', description: 'สำรวจเกาะ แหล่งธรรมชาติ และจุดหมายอื่น ๆ ในแค็ตตาล็อก Double Bottle Co’ ดูโปรแกรมทัวร์และรายละเอียดการแวะเที่ยวแต่ละสถานที่'},
      eyebrow: 'สถานที่ที่จะอยู่ในความทรงจำ', title: ['ออกไปค้นพบ', 'ประสบการณ์ใหม่'],
      sections: [{paragraphs: ['เปิดดูแต่ละจุดหมายเพื่อค้นหาโปรแกรมที่เดินทางผ่านสถานที่นั้น แต่ละตัวเลือกจะระบุรูปแบบการแวะเที่ยวไว้ให้ทราบ']}],
      programCount: (n) => `${n} โปรแกรม`
    },
    destination: {titlePrefix: 'ทัวร์: ', fallbackTitle: 'จุดหมาย', fallbackDescription: 'จุดหมายและโปรแกรมทัวร์ในแค็ตตาล็อก Double Bottle Co’'}
  }
};

/** Stable credit destinations; local file paths must not receive locale prefixes. */
export const creditLinks = {
  osm: 'https://www.openstreetmap.org/copyright',
  odbl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  mapDownload: '/map/andaman.geojson',
  fontLicense: '/fonts/LICENSE.txt'
} as const;
