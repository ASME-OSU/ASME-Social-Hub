import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {renderEventPage} from '../docs/event-page.mjs';
import {calendarFile} from './ics.mjs';
const root=resolve('.'),base=resolve('docs'),port=Number(process.env.PORT||4273),origin=`http://127.0.0.1:${port}`,drafts=new Map();
const config=JSON.parse(await readFile(resolve(base,'config/chapter.json'),'utf8'));
config.previewOnly=true;config.siteUrl=origin;
const archive=JSON.parse(await readFile(resolve(base,'data/archive-index.json'),'utf8'));
for(const c of archive.campaigns||[])if(!c.demo&&!c.deletedAt)drafts.set(`${c.year}/${c.id}`,{campaign:c,flyer:`/media/${c.year}/${c.id}-feed.jpg`});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ics':'text/calendar; charset=utf-8'};
async function availableFlyer(flyer){if(!flyer?.startsWith('/media/'))return flyer;try{await stat(resolve(base,'.'+flyer));return flyer;}catch{return null;}}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'");
 const reply=(status,type,body)=>{res.writeHead(status,{'Content-Type':type});res.end(body);};
 try{
 const url=new URL(req.url,origin),path=decodeURIComponent(url.pathname);
 if(req.method==='POST'&&path==='/__preview/campaign'){
  if(req.headers.origin&&!([origin,`http://localhost:${port}`].includes(req.headers.origin)))return reply(403,'text/plain','Local origin required');
  if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,'text/plain','JSON required');
  let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>12*1024*1024)return reply(413,'text/plain','Draft image is too large');}
  const value=JSON.parse(text),c=value.campaign;
  if(!c||!/^\d{4}-\d{2}$/.test(c.year)||!/^[a-zA-Z0-9_-]{1,180}$/.test(c.id)||typeof c.title!=='string'||!Number.isFinite(Date.parse(c.start))||!Number.isFinite(Date.parse(c.end)))return reply(400,'text/plain','Invalid local draft');
  drafts.set(`${c.year}/${c.id}`,{campaign:c,flyer:typeof value.flyer==='string'?value.flyer:''});return reply(200,'application/json',JSON.stringify({saved:'memory-only'}));
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return reply(405,'text/plain','Publishing is disabled in this local preview');
 if(path==='/config/chapter.json')return reply(200,'application/json',JSON.stringify(config));
 const event=path.match(/^\/events\/(\d{4}-\d{2})\/([a-zA-Z0-9_-]{1,180})\/$/);
 if(event){const draft=drafts.get(`${event[1]}/${event[2]}`);if(!draft)return reply(404,'text/plain','Event not found');return reply(200,'text/html; charset=utf-8',renderEventPage(draft.campaign,config,{localPreview:true,flyerUrl:await availableFlyer(draft.flyer)}));}
 const calendar=path.match(/^\/calendar\/(\d{4}-\d{2})\/([a-zA-Z0-9_-]{1,180})\.ics$/);
 if(calendar){const draft=drafts.get(`${calendar[1]}/${calendar[2]}`);if(draft){res.setHeader('Content-Disposition',`attachment; filename="${calendar[2]}.ics"`);return reply(200,'text/calendar; charset=utf-8',calendarFile(draft.campaign));}}
 if(path==='/current-layout/'){let html=await readFile(resolve(base,'index.html'),'utf8');html=html.replace('<head>','<head><base href="/">');return reply(200,'text/html; charset=utf-8',html);}
 let file=resolve(base,'.'+(path==='/'?'/index.html':path));
 if(file!==base&&!file.startsWith(base+sep))return reply(403,'text/plain','Outside preview root');
 if(path.startsWith('/__uploads/')){const name=path.slice('/__uploads/'.length);if(!/^[a-zA-Z0-9._-]+$/.test(name))return reply(400,'text/plain','Invalid image');file=resolve(root,'assets/uploads',name);}
 if((await stat(file)).isDirectory())file=resolve(file,'index.html');
 return reply(200,types[extname(file)]||'application/octet-stream',await readFile(file));
 }catch(error){return reply(error instanceof SyntaxError?400:404,'text/plain','Local preview resource unavailable');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local preview: ${origin}/ — publishing disabled`));
