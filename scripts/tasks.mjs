import {readFile, writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readCampaigns} from './core.mjs';
import {refreshCandidates} from './ical.mjs';
import {postBotMessage} from './groupme.mjs';
import {assessTokenExpiry} from './refresh-token.mjs';
const exec = promisify(execFile);
const task = process.argv[2];
const config = JSON.parse(await readFile('config/chapter.json','utf8'));
if(task === 'calendar') {
  if(config.icalUrl) await refreshCandidates();
  else console.log('Calendar suggestions are disabled until icalUrl is configured.');
} else if(task === 'expiry') {
  if(!process.env.IG_ACCESS_TOKEN) {console.log('Instagram publishing is not configured.');process.exit(0);}
  const assessment = assessTokenExpiry(process.env.IG_TOKEN_EXPIRES_AT);
  console.log(`Instagram token expiry: ${assessment.status}`);
  if(assessment.warning) await writeFile('data/token-warning.json',JSON.stringify({status:assessment.status,checkedAt:new Date().toISOString()}));
} else if(task === 'alert') {
  if(!process.env.GH_TOKEN || !process.env.GITHUB_REPOSITORY) throw new Error('GitHub workflow context required');
  const campaigns = await readCampaigns(process.cwd());
  const failures = campaigns.filter(c=>!c.demo && !c.archived && Object.values(c.status || {}).includes('failed'));
  const expiry = process.env.IG_ACCESS_TOKEN ? assessTokenExpiry(process.env.IG_TOKEN_EXPIRES_AT) : {warning:false};
  if(!failures.length && !expiry.warning && process.env.RUN_FAILED !== '1') process.exit(0);
  const title = 'Campaign automation needs attention';
  const {stdout} = await exec('gh',['issue','list','--repo',process.env.GITHUB_REPOSITORY,'--state','open','--search',`${title} in:title`,'--json','title']);
  if(JSON.parse(stdout).some(i=>i.title===title)) {console.log('An automation alert is already open.');process.exit(0);}
  const url = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const body = ['Review the [workflow run]('+url+').', failures.length ? `${failures.length} campaign(s) have failed steps. Inspect the dashboard timeline and saved result identifiers before retrying.` : '',expiry.warning ? `Instagram token expiry status: ${expiry.status}. Reauthorize or refresh the token as described in SETUP.md.` : '', 'This alert contains no account tokens. Close it after the problem is resolved.'].filter(Boolean).join('\n\n');
  await exec('gh',['issue','create','--repo',process.env.GITHUB_REPOSITORY,'--title',title,'--body',body]);
  if(process.env.OFFICERS_GROUPME_BOT_ID) {
    try { await postBotMessage(`Campaign automation needs attention. Review ${url}`,{env:{...process.env,GROUPME_BOT_ID:process.env.OFFICERS_GROUPME_BOT_ID}}); }
    catch { console.error('Officer bot alert unavailable; GitHub issue remains open.'); }
  }
} else if(task === 'keepalive') {
  await writeFile('data/maintenance.json',JSON.stringify({checkedAt:new Date().toISOString(),message:'Scheduled maintenance checkpoint. Check Actions schedules at officer handoff.'},null,2)+'\n');
} else throw new Error('Unknown maintenance task');
