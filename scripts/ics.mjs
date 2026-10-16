import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const escape = value => String(value || '').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const stamp = value => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function calendarFile(campaign, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Chapter Campaign Scheduler//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${escape(campaign.id)}@chapter-campaigns`,`DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(campaign.start)}`,`DTEND:${stamp(campaign.end)}`,`SUMMARY:${escape(campaign.title)}`,`DESCRIPTION:${escape(campaign.description)}`,`LOCATION:${escape(campaign.location?.name)}`,`STATUS:${campaign.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,`SEQUENCE:${campaign.revision || 0}`,'END:VEVENT','END:VCALENDAR'];
  // RFC 5545 folding counts UTF-8 octets, not JavaScript code units.
  return lines.map(line=>{let out='',column=0;for(const ch of line){const width=Buffer.byteLength(ch);if(column+width>74){out+='\r\n ';column=1;}out+=ch;column+=width;}return out;}).join('\r\n')+'\r\n';
}
export async function writeCalendarFiles(root,campaigns) {
  for(const campaign of campaigns) {
    const folder = resolve(root,'docs/calendar',campaign.year); await mkdir(folder,{recursive:true});
    await writeFile(resolve(folder,`${campaign.id}.ics`),calendarFile(campaign,new Date(campaign.updatedAt || campaign.results?.groupme?.createdAt || campaign.start)));
  }
}
