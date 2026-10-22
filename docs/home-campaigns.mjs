export const HOME_EVENT_RETENTION_MS=24*60*60*1000;
export function homeCampaigns(campaigns,now=Date.now()){
 const current=+now;
 return campaigns.filter(c=>!c.cancelled&&!c.deletedAt&&!c.archived&&Number.isFinite(Date.parse(c.end||c.start))&&Date.parse(c.end||c.start)>current-HOME_EVENT_RETENTION_MS)
 .sort((a,b)=>{const pastA=Date.parse(a.end||a.start)<current,pastB=Date.parse(b.end||b.start)<current;return Number(pastA)-Number(pastB)||(pastA?Date.parse(b.end||b.start)-Date.parse(a.end||a.start):Date.parse(a.start)-Date.parse(b.start));});
}
