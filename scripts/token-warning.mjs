import path from 'node:path';
import {assessTokenExpiry} from './refresh-token.mjs';
import {writeJson} from './core.mjs';
export async function writeTokenWarning({root=process.cwd(),env=process.env,now=new Date()}={}){
  const assessment=env.IG_ACCESS_TOKEN?assessTokenExpiry(env.IG_TOKEN_EXPIRES_AT,now):{status:'unknown',daysRemaining:null};
  const status=assessment.status==='expiring'?'warning':assessment.status;
  const record={status,warning:status==='warning'||status==='expired',configured:Boolean(env.IG_ACCESS_TOKEN),checkedAt:now.toISOString()};
  if(Number.isFinite(assessment.daysRemaining)){record.expiresAt=new Date(env.IG_TOKEN_EXPIRES_AT).toISOString();record.daysRemaining=assessment.daysRemaining;}
  await writeJson(path.join(root,'data/token-warning.json'),record);
  return record;
}
