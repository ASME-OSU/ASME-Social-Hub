import {readFile,stat,appendFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateCampaign,writeJson} from './core.mjs';
const exec = promisify(execFile);
export function prepareImportedCampaign(input,config,now=Date.now()) {
  const c=validateCampaign(structuredClone(input));
  if(c.year!==config.activeYear || Date.parse(c.start)<=now) throw new Error('Choose a future event in the active year');
  delete c.demo; delete c.archived; delete c.cancelled;
  c.status=Object.fromEntries(['feed','story','groupme'].map(channel=>[channel,c.campaign?.[channel]?.enabled===false ? 'skipped' : 'pending']));
  if(config.integrations?.groupme?.enabled===false || (config.integrations?.groupme?.mode==='bot' && (c.campaign?.groupme?.enabled!==true || c.campaign?.groupme?.announce!==true))) c.status.groupme='skipped';
  c.results={feed:{},story:{},groupme:{},insights:[]}; c.log=[];c.revision=1;
  return c;
}
export async function main() {
  const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  const repo=process.env.GITHUB_REPOSITORY;
  const {stdout}=await exec('gh',['api',`repos/${repo}/collaborators/${encodeURIComponent(event.issue.user.login)}/permission`]);
  if(!['admin','write','maintain'].includes(JSON.parse(stdout).permission)) throw new Error('Campaign import requires repository write permission');
  // Only authorized requests receive validation feedback. Never publish raw input or errors.
  if(process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,'authorized=true\n');
  const match=event.issue.body?.match(/```(?:json)?\s*([\s\S]*?)```/);
  if(!match) throw new Error('Campaign JSON is required');
  const config=JSON.parse(await readFile('config/chapter.json','utf8'));
  const c=prepareImportedCampaign(JSON.parse(match[1]),config);
  const file=resolve('data/campaigns',c.year,`${c.id}.json`);
  if(await stat(file).catch(error=>{if(error.code==='ENOENT')return null;throw error;})) throw new Error('Campaign ID already exists');
  await writeJson(file,c);
  console.log('Campaign validated and saved for commit.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(()=>{
  console.error('Campaign import failed. Check repository write permission, fenced JSON, a unique ID, a future date in the active year, and supported campaign fields.');
  process.exitCode=1;
});
