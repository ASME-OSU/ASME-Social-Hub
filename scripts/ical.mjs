// Extracted from ASME-Newsletter-Builder/scripts/sync-calendar.mjs.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ical from 'node-ical';
import {calendarChange} from '../docs/calendar-changes.mjs';
const text = value => value == null ? '' : typeof value === 'object' && 'val' in value ? String(value.val || '') : String(value);
const iso = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : '';
function eventDateIso(value, allDay) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
  return allDay ? new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())).toISOString() : date.toISOString();
}
export async function parseCalendar(source, {from = new Date(), to = new Date(Date.now()+366*86400000), sourceUrl=''}={}) {
  const parsed = await ical.async.parseICS(source); const events=[];
  for (const component of Object.values(parsed)) {
    if (!component || component.type !== 'VEVENT' || component.recurrenceid || text(component.status).toUpperCase()==='CANCELLED') continue;
    const instances = ical.expandRecurringEvent(component,{from,to,includeOverrides:true,excludeExdates:true,expandOngoing:true});
    for (const instance of instances) {
      const event=instance.isOverride ? instance.event : component;
      if (text(instance.event.status).toUpperCase()==='CANCELLED') continue;
      const start=eventDateIso(instance.start,Boolean(instance.isFullDay));
      const uid=text(event.uid); const occurrenceId=`${uid}::${start}`;
      events.push({id:occurrenceId,title:text(instance.summary || event.summary)||'Untitled Event',start,end:eventDateIso(instance.end,Boolean(instance.isFullDay)),allDay:Boolean(instance.isFullDay),location:text(event.location),description:instance.isRecurring&&!instance.isOverride?'':text(event.description),url:sourceUrl,updated:iso(event.lastmodified||event.dtstamp),source:{kind:'ical',uid:occurrenceId,calendarUid:uid}});
    }
  }
  return [...new Map(events.map(e=>[e.id,e])).values()].sort((a,b)=>a.start.localeCompare(b.start));
}
export async function refreshCandidates({root=process.cwd(),fetchImpl=fetch,now=new Date()}={}) {
  const config=JSON.parse(await fs.readFile(path.join(root,'config/chapter.json'),'utf8'));
  if (!config.icalUrl) throw new Error('Set config.icalUrl before refreshing candidates');
  let response; try { response=await fetchImpl(config.icalUrl,{signal:AbortSignal.timeout(30000)}); } catch { throw new Error('Calendar feed request failed'); }
  if(!response.ok) throw new Error(`Calendar feed returned HTTP ${response.status}`);
  const events=await parseCalendar(await response.text(),{from:now,to:new Date(now.getTime()+730*86400000),sourceUrl:config.icalUrl});
  const used=new Map(); const campaignRoot=path.join(root,'data/campaigns');
  for (const year of await fs.readdir(campaignRoot).catch(()=>[])) for(const name of await fs.readdir(path.join(campaignRoot,year)).catch(()=>[])) if(name.endsWith('.json')) {
    const c=JSON.parse(await fs.readFile(path.join(campaignRoot,year,name),'utf8')); if(c.source?.kind==='ical') used.set(c.source.uid,c);
  }
  const result={generatedAt:now.toISOString(),events:events.filter(e=>!used.has(e.source.uid)),changes:events.filter(e=>used.has(e.source.uid)).map(e=>calendarChange(e,used.get(e.source.uid))).filter(Boolean)};
  await fs.mkdir(path.join(root,'data'),{recursive:true}); await fs.writeFile(path.join(root,'data/candidates.json'),JSON.stringify(result,null,2)+'\n'); return result;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) refreshCandidates().then(r=>console.log(`Refreshed ${r.events.length} calendar suggestions.`)).catch(()=>{console.error('Calendar refresh failed; check feed URL and configuration.');process.exitCode=1;});
