import {GROUPME_FORMATS} from '../docs/groupme-message.mjs';
import {validateAdvertising} from '../docs/caption.mjs';
export {validateAdvertising,advertisingLines,captionFor} from '../docs/caption.mjs';
import {validateFlyerSources} from '../docs/carousel.mjs';
import {validateStoryDesign} from '../docs/story-design.mjs';
import { readdir, readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const assert = (ok, message) => { if (!ok) throw new Error(message); };
const cadenceValid = c => c && Number.isInteger(c.daysBefore) && c.daysBefore >= 0 && c.daysBefore <= 365 && /^([01]\d|2[0-3]):[0-5]\d$/.test(c.time);
export function validateConfig(c) {
  assert(c && typeof c === 'object', 'Configuration is required');
  for (const key of ['chapterName', 'timezone', 'activeYear']) assert(typeof c[key] === 'string' && c[key].trim(), `Missing ${key}`);
  try { new Intl.DateTimeFormat('en', { timeZone: c.timezone }); } catch { throw new Error('Invalid timezone'); }
  assert(/^\d{4}-\d{2}$/.test(c.activeYear), 'Invalid activeYear');
  for (const ch of ['feed', 'story']) assert(cadenceValid(c.defaultCadence?.[ch]), `Invalid ${ch} cadence`);
  return c;
}
export function validateCampaign(c) {
  validateFlyerSources(c);
  assert(c && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(c.id), 'Invalid campaign id');
  assert(/^\d{4}-\d{2}$/.test(c.year), 'Invalid campaign year');
  assert(typeof c.title === 'string' && c.title.trim(), 'Campaign title is required');
  for (const key of ['start','end']) assert(typeof c[key] === 'string' && /(Z|[+-]\d\d:\d\d)$/.test(c[key]) && Number.isFinite(Date.parse(c[key])), `Invalid ${key}; include timezone offset`);
  assert(Date.parse(c.end) > Date.parse(c.start), 'End must follow start');
  assert(typeof c.food === 'boolean', 'Food must be a boolean');
  if (c.template !== undefined) assert(['blueprint','editorial','refined-blueprint','editorial-poster','assembly-card'].includes(c.template), 'Invalid campaign template');
  validateAdvertising(c.advertising);
  validateStoryDesign(c.storyDesign);
  for (const ch of ['feed','story']) if (c.campaign?.[ch]) assert(cadenceValid(c.campaign[ch]), `Invalid ${ch} cadence`);
  const gm=c.campaign?.groupme;
  if(gm){
    if(gm.announce!==undefined)assert(typeof gm.announce==='boolean','Invalid GroupMe announce flag');
    if(gm.daysBefore!==undefined||gm.time!==undefined)assert(cadenceValid(gm),'Invalid GroupMe cadence');
    if(gm.format!==undefined)assert(Object.hasOwn(GROUPME_FORMATS,gm.format),'Invalid GroupMe message format');
    if(gm.followUp!==undefined){
      assert(gm.followUp&&typeof gm.followUp==='object'&&!Array.isArray(gm.followUp)&&typeof gm.followUp.enabled==='boolean','Invalid GroupMe follow-up');
      assert(cadenceValid(gm.followUp),'Invalid GroupMe follow-up cadence');
      if(gm.followUp.format!==undefined)assert(Object.hasOwn(GROUPME_FORMATS,gm.followUp.format),'Invalid GroupMe follow-up format');
    }
  }
  assert(!c.campaign?.groupme?.createAt || c.campaign.groupme.createAt === 'immediately', 'GroupMe createAt supports immediately only');
  if(c.revision!==undefined) assert(Number.isInteger(c.revision) && c.revision>=0, 'Invalid revision');
  for(const channel of ['feed','story','groupme']) {
    if(c.status?.[channel]!==undefined) assert(['pending','done','failed','skipped'].includes(c.status[channel]), `Invalid ${channel} status`);
    if(c.campaign?.[channel]?.enabled!==undefined) assert(typeof c.campaign[channel].enabled==='boolean', `Invalid ${channel} enabled flag`);
  }
  if(c.log!==undefined) assert(Array.isArray(c.log), 'Invalid campaign log');
  const reminders = c.campaign?.groupme?.reminders;
  if (reminders) assert(Array.isArray(reminders) && reminders.length <= 2 && reminders.every(n => [0,300,900,1800,3600,7200,86400,172800,604800].includes(n)), 'Invalid GroupMe reminders');
  return c;
}
function parts(date, timezone) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
export function fireAt(campaign, channel, config) {
  const cadence = { ...config.defaultCadence[channel], ...campaign.campaign?.[channel] };
  assert(cadenceValid(cadence), `Invalid ${channel} cadence`);
  const p = parts(new Date(campaign.start), config.timezone);
  const day = new Date(Date.UTC(p.year,p.month-1,p.day-cadence.daysBefore));
  const [hour,minute] = cadence.time.split(':').map(Number);
  const target = Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),hour,minute);
  // Search offsets around the date: handles DST transitions and non-hour offsets.
  const candidates = new Set();
  for (const delta of [-36,-12,0,12,36]) {
    const sample = target + delta*3600000, s = parts(new Date(sample), config.timezone);
    const offset = Date.UTC(s.year,s.month-1,s.day,s.hour,s.minute,s.second)-sample;
    candidates.add(target-offset);
  }
  const matches = [...candidates].filter(t => { const s=parts(new Date(t),config.timezone); return Date.UTC(s.year,s.month-1,s.day,s.hour,s.minute)===target; }).sort((a,b)=>a-b);
  assert(matches.length, 'Scheduled local time does not exist because of a timezone transition; choose another time');
  return new Date(matches[0]);
}
export async function readCampaigns(root) {
  const base=path.join(root,'data/campaigns'); let years;
  try { years=await readdir(base,{withFileTypes:true}); } catch(e) { if(e.code==='ENOENT') return []; throw e; }
  const result=[];
  for(const year of years.filter(d=>d.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))) for(const name of (await readdir(path.join(base,year.name))).filter(n=>n.endsWith('.json')).sort()) { const c=JSON.parse(await readFile(path.join(base,year.name,name),'utf8')); assert(c.year===year.name && `${c.id}.json`===name, `Campaign path does not match its year/id: ${year.name}/${name}`); result.push(c); }
  return result;
}
export async function writeJson(file,data) { await mkdir(path.dirname(file),{recursive:true}); const temp=`${file}.${process.pid}.tmp`; await writeFile(temp,JSON.stringify(data,null,2)+'\n'); await rename(temp,file); }
