import {administrator} from './http';
import {configuration} from './db';
import {canEditCatalogIdentity} from '../public/catalog-editor';
export async function catalogEditorActor(req:Request){
 const admin=await administrator(req);if(admin)return admin;
 const c=configuration(),email=req.headers.get('oai-authenticated-user-email'),id=req.headers.get('oai-authenticated-user-id');
 return canEditCatalogIdentity(email,id,c.ADMIN_EMAILS,c.CATALOG_EDITOR_EMAILS)?id:null;
}
