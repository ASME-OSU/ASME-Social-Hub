const fields=['title','start','end','location','description'];
const value=(record,key)=>{const v=key==='location'&&typeof record?.location==='object'?record.location?.name:record?.[key];if(['start','end'].includes(key)&&Number.isFinite(Date.parse(v)))return new Date(v).toISOString();return String(v??'').replace(/\r\n/g,'\n').trim();};
export function calendarSnapshot(event){return Object.fromEntries(fields.map(key=>[key,value(event,key)]));}
export function calendarChange(event,campaign){
 const baseline=campaign.source?.snapshot,hasBaseline=baseline&&typeof baseline==='object';
 // Legacy campaigns have no original calendar copy. Their social descriptions
 // are intentionally edited, so do not mistake those edits for calendar updates.
 const compared=hasBaseline?fields:fields.filter(key=>key!=='description');
 const differences=compared.filter(field=>value(baseline||campaign,field)!==value(event,field)&&value(campaign,field)!==value(event,field)).map(field=>({field,previous:value(baseline||campaign,field),current:value(event,field),campaign:value(campaign,field)}));
 return differences.length?{source:event.source,title:event.title,updated:event.updated,comparison:hasBaseline?'calendar-baseline':'campaign-details',differences}:null;
}
