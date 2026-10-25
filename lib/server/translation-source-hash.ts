/** Same exact raw UTF-8 SHA-256 as translation-sync sourceHash. Never normalize or JSON-quote. */
export async function sourceHash(text:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
