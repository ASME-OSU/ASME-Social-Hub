import path from 'node:path';
import {writeJson} from './core.mjs';
export function linkedinTokenWarning({env=process.env,enabled=false,now=new Date()}={}){
 const expires=Date.parse(env.LINKEDIN_TOKEN_EXPIRES_AT),known=Number.isFinite(expires),daysRemaining=known?(expires-+now)/86400000:null;
 const configured=Boolean(env.LINKEDIN_ACCESS_TOKEN),status=!enabled?'paused':!configured?'missing':!known?'unknown':daysRemaining<=0?'expired':daysRemaining<14?'warning':'healthy';
 return {status,warning:enabled&&status!=='healthy',configured,checkedAt:now.toISOString(),...(known?{expiresAt:new Date(expires).toISOString(),daysRemaining}:{})};
}
export async function writeLinkedInTokenWarning({root=process.cwd(),...options}={}){const record=linkedinTokenWarning(options);await writeJson(path.join(root,'data/linkedin-token-warning.json'),record);return record;}
