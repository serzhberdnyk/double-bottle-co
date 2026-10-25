export type BusinessContact = {
  service: 'telegram' | 'whatsapp';
  label: string;
  href: string;
};

// Only owner-confirmed Double Bottle Co inquiry destinations belong here.
// Telegram supplied by the owner on 8 October 2026 (Sentinel_0d3298a96bc48191876553cdb718187c).
// WhatsApp +66 9 3587 1190 supplied by the owner (Sentinel_e96c91d09e748191addf1dd84c1a4cb1).
export const businessContacts: readonly BusinessContact[] = [
  {service:'telegram', label:'Telegram', href:'https://t.me/islandino'},
  {service:'whatsapp', label:'WhatsApp', href:'https://wa.me/66935871190'},
];
