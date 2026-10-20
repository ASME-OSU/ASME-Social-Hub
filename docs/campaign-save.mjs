import {reopenMissedChannels} from './schedule-status.mjs';
const runtime=new Set(['revision','status','results','log','flyers']);
function canonical(value) {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));
  return value;
}
export function editableContent(c) {return JSON.stringify(canonical(Object.fromEntries(Object.entries(c).filter(([k])=>!runtime.has(k)))));}
export function mergeCampaignEdit(base, draft, current, config, now=new Date()) {
  if(editableContent(base)!==editableContent(current)) throw Error('This campaign was edited since you opened it. Reload the page and review the latest version.');
  // Begin from current so future background fields and receipts survive saves.
  const merged={...current};
  for(const k of Object.keys(base)) if(!runtime.has(k) && !Object.hasOwn(draft,k)) delete merged[k];
  for(const [k,v] of Object.entries(draft)) if(!runtime.has(k)) merged[k]=v;
  merged.revision=Math.max(current.revision||0,base.revision||0)+1;
  return reopenMissedChannels(merged,current,config,now);
}
