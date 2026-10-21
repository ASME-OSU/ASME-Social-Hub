import {mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {renderEventPage,publicEventURL} from '../docs/event-page.mjs';
export async function writeEventPages(root,campaigns,config){
 const output=resolve(root,'docs/events');
 const pages=campaigns.filter(c=>!c.demo&&!c.deletedAt);
 if(!config.siteUrl){await rm(output,{recursive:true,force:true});return;}
 if(!publicEventURL({year:'2026-27',id:'event'},config))throw Error('A public HTTPS site URL is required');
 for(const c of pages)if(!/^\d{4}-\d{2}$/.test(c.year)||!/^[a-zA-Z0-9_-]{1,180}$/.test(c.id))throw Error('Invalid event page path');
 await rm(output,{recursive:true,force:true});
 for(const c of pages){const folder=resolve(output,c.year,c.id);await mkdir(folder,{recursive:true});await writeFile(resolve(folder,'index.html'),renderEventPage(c,config));}
}
