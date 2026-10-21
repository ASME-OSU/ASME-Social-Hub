// Snapshots are cumulative observations, never add them together across days.
export function latestInsightsSnapshot(campaign,channel='feed'){
 const mediaId=campaign.results?.[channel]?.mediaId;
 const snapshots=(campaign.results?.insights||[]).filter(s=>s.channel===channel&&(!mediaId||!s.mediaId||String(s.mediaId)===String(mediaId)));
 const at=s=>Number.isFinite(Date.parse(s.recordedAt||s.at))?Date.parse(s.recordedAt||s.at):0;
 return snapshots.sort((a,b)=>at(b)-at(a)||Number(b.day||0)-Number(a.day||0))[0]||null;
}
export function recordedMetric(snapshot,key){const value=snapshot?.metrics?.[key]??snapshot?.[key];return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function campaignInsightsMarkup(campaign,{timezone='UTC'}={}){
 const snapshot=latestInsightsSnapshot(campaign),likes=recordedMetric(snapshot,'likes'),reach=recordedMetric(snapshot,'reach'),published=Boolean(campaign.results?.feed?.mediaId||campaign.results?.feed?.postedAt);
 if(!snapshot)return `<div class="card-engagement is-empty"><p>${published?'Insights not recorded yet':'Likes available after Feed publishes'}</p>${published?'<small>Feed snapshots are collected around day 1 and day 7.</small>':''}</div>`;
 const at=snapshot.recordedAt||snapshot.at,time=Number.isFinite(Date.parse(at))?new Intl.DateTimeFormat('en-US',{timeZone:timezone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at)):'';
 return `<div class="card-engagement" role="group" aria-label="Recorded Instagram feed insights"><div class="card-engagement-values"><span><span aria-hidden="true">♡</span> <strong>${likes===null?'—':likes.toLocaleString()}</strong> ${likes===1?'like':'likes'}</span>${reach===null?'':`<span><strong>${reach.toLocaleString()}</strong> reached</span>`}</div><p>${time?`Recorded <time datetime="${escape(at)}">${escape(time)}</time>`:'Recorded snapshot'} · ${escape(timezone)}<br>Snapshot counts; not live</p></div>`;
}
