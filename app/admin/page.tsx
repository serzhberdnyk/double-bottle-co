import {AdminWorkspace} from './admin-workspace';
import {headers} from 'next/headers';
import {configuration} from '@/lib/server/db';
import {requireChatGPTUser} from '../chatgpt-auth';
import {AdminPanel} from './panel';
import {canManageIdentity} from '@/lib/server/access-policy';
import {canEditCatalogIdentity} from '@/lib/public/catalog-editor';
import {Header,Footer} from '../components/SiteChrome';
export const metadata={title:'Управление каталогом',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function Admin(){const user=await requireChatGPTUser('/admin'),h=await headers(),email=h.get('oai-authenticated-user-email'),c=configuration();
 if(canManageIdentity(email,user.userId,c.ADMIN_EMAILS))return <AdminPanel/>;
 if(canEditCatalogIdentity(email,user.userId,c.ADMIN_EMAILS,c.CATALOG_EDITOR_EMAILS))return <><Header/><main className="admin-page"><h1 style={{fontSize:20,margin:"12px 0"}}>Double Bottle · каталог</h1><AdminWorkspace/></main><Footer/></>;
 return <main className="content-page"><h1>Доступ закрыт</h1><p>Этот раздел доступен только редактору каталога.</p><a href="/">На главную</a></main>;
}
