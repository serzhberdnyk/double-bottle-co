import {configuration} from '@/lib/server/db';
import {indexingPolicy,robotsText} from '@/lib/public/seo-policy';
export function GET(request:Request){return new Response(robotsText(indexingPolicy(configuration(),new URL(request.url).host)),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
