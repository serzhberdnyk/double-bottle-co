import {CatalogEditorPanel} from './catalog-panel';
import {MapEditorPanel} from './map-panel';
import {InquiriesPanel} from './inquiries-panel';
import {TranslationsPanel} from './translations-panel';
import styles from './admin-workspace.module.css';
export function AdminWorkspace({owner=false}:{owner?:boolean}){return <div className={styles.workspace}><MapEditorPanel/><div className={styles.tools}><span>Рабочий стол</span>{owner&&<InquiriesPanel/>}<details className={styles.window}><summary>Переводы EN / TH</summary><div className={styles.popup}><TranslationsPanel/></div></details></div><CatalogEditorPanel/></div>;}
