import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assessTokenExpiry} from './refresh-token.mjs';
import {createInstagramClient} from './ig.mjs';
import {createGroupMeClient} from './groupme.mjs';
export async function doctor({root=process.cwd(),env=process.env,live=false,fetchImpl=fetch}={}) {
  const checks=[]; const add=(name,ok,message)=>checks.push({name,ok,message});
  let config; try {config=JSON.parse(await fs.readFile(path.join(root,'config/chapter.json'),'utf8'));} catch {add('config',false,'Missing or invalid config/chapter.json');return checks;}
  for(const key of ['chapterName','timezone','activeYear','siteUrl']) add(key,Boolean(config[key]),config[key]?'Configured':`Set config.${key}`);
  try {new Intl.DateTimeFormat('en-US',{timeZone:config.timezone});add('timezone-valid',true,'Valid IANA timezone');}catch{add('timezone-valid',false,'Use an IANA timezone');}
  let siteValid=false; try{const u=new URL(config.siteUrl);siteValid=u.protocol==='https:'&&!/example\.(com|org)|your[-_]?/i.test(u.hostname+u.pathname);}catch{}
  add('public-site',siteValid,'Production requires an actual public HTTPS site URL');
  add('repository',Boolean(config.repository?.owner&&config.repository?.name&&!/your[-_]?/i.test(config.repository.owner)),'Configure repository owner and name');
  for(const key of ['IG_USER_ID','IG_ACCESS_TOKEN','GROUPME_TOKEN','GROUPME_GROUP_ID','SECRETS_ADMIN_PAT']) add(key,Boolean(env[key]),env[key]?'Present (value hidden)':`Missing ${key}${live?'':' — local preview remains available'}`);
  add('calendar',Boolean(config.icalUrl),config.icalUrl?'Calendar configured':'Optional: set icalUrl to enable calendar suggestions');
  if(env.IG_TOKEN_EXPIRES_AT) {const assessment=assessTokenExpiry(env.IG_TOKEN_EXPIRES_AT);add('token-expiry',!assessment.warning,assessment.daysRemaining===null?'Invalid IG_TOKEN_EXPIRES_AT':`${Math.floor(assessment.daysRemaining)} days remain`);}
  else add('token-expiry',true,'Expiry cannot be inferred from an opaque token. Set IG_TOKEN_EXPIRES_AT for a local expiry warning; successful refresh logs expiry.');
  if(live) {
    const probe=async(name,fn)=>{try{await fn();add(name,true,'Read-only check passed');}catch{add(name,false,'Read-only check failed; check configuration, credentials, permissions, or API availability');}};
    await probe('instagram-live',()=>createInstagramClient({env,fetchImpl}).request('me',{fields:{fields:'id,username'}}));
    await probe('groupme-live',()=>createGroupMeClient({env,fetchImpl}).listEvents());
    if(config.icalUrl) await probe('calendar-live',async()=>{const r=await fetchImpl(config.icalUrl,{signal:AbortSignal.timeout(30000)});if(!r.ok||!(await r.text()).includes('BEGIN:VCALENDAR'))throw new Error();});
    if(siteValid) await probe('site-live',async()=>{const r=await fetchImpl(config.siteUrl,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error();});
  }
  return checks;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) doctor({live:process.argv.includes('--live')}).then(checks=>{for(const c of checks)console.log(`${c.ok?'PASS':'FAIL'} ${c.name}: ${c.message}`);if(checks.some(c=>!c.ok&&c.name!=='calendar'))process.exitCode=1;}).catch(()=>{console.error('Doctor failed to read project configuration');process.exitCode=1;});
