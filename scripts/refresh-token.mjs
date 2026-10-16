import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {safeJson} from './ig.mjs';
export function assessTokenExpiry(expiresAt, now = new Date()) {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return {status:'unknown',warning:true,daysRemaining:null};
  const daysRemaining = (expiry - now.getTime()) / 86400000;
  return {status:daysRemaining <= 0 ? 'expired' : daysRemaining < 14 ? 'expiring' : 'healthy',warning:daysRemaining < 14,daysRemaining};
}
export async function refreshToken({env=process.env,fetchImpl=fetch,writeSecret,now=new Date()}={}) {
  if(!env.IG_ACCESS_TOKEN||!env.SECRETS_ADMIN_PAT||!env.GITHUB_REPOSITORY) throw new Error('Refresh requires IG_ACCESS_TOKEN, SECRETS_ADMIN_PAT, and GITHUB_REPOSITORY');
  // This OAuth endpoint requires the token as a query parameter. Never log the URL.
  const url=new URL('https://graph.instagram.com/refresh_access_token'); url.searchParams.set('grant_type','ig_refresh_token'); url.searchParams.set('access_token',env.IG_ACCESS_TOKEN);
  let response; try { response=await fetchImpl(url,{signal:AbortSignal.timeout(30000)}); } catch { throw new Error('Instagram token refresh network failure'); }
  const result=await safeJson(response,'Instagram token refresh');
  if(!result.access_token || !Number.isFinite(result.expires_in) || result.expires_in<14*86400) throw new Error('Refreshed token missing or expires in fewer than 14 days');
  const writer=writeSecret || ((name,value)=>new Promise((resolve,reject)=>{
    const child=spawn('gh',['secret','set',name,'--repo',env.GITHUB_REPOSITORY],{env:{...env,GH_TOKEN:env.SECRETS_ADMIN_PAT},stdio:['pipe','ignore','ignore']});
    child.on('error',()=>reject(new Error('Could not start gh secret set'))); child.on('close',code=>code===0?resolve():reject(new Error('gh secret set failed; check Secrets write permission'))); child.stdin.on('error',()=>{}); child.stdin.end(value);
  }));
  const expiresAt=new Date(now.getTime()+result.expires_in*1000).toISOString();
  await writer('IG_ACCESS_TOKEN',result.access_token);
  await writer('IG_TOKEN_EXPIRES_AT',expiresAt);
  return {refreshedAt:now.toISOString(),expiresAt,expiresIn:result.expires_in};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) refreshToken().then(r=>console.log(`Instagram secret refreshed; expires ${r.expiresAt}.`)).catch(()=>{console.error('Instagram token refresh failed. Check token age/expiry and Secrets admin permission; reauthorize if expired.');process.exitCode=1;});
