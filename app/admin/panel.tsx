import {AdminWorkspace} from './admin-workspace';
import {Header,Footer} from '../components/SiteChrome';
export function AdminPanel(){return <><Header/><main className="admin-page"><h1 style={{fontSize:20,margin:'12px 0'}}>Double Bottle · управление</h1><AdminWorkspace owner/></main><Footer/></>;}
