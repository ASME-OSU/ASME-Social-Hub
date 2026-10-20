// Shared by live publishing and the browser preview; do not trim or shorten preview copy.
import {advertisingLines} from './caption.mjs';
const httpsLink=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}};
export function groupMeAnnouncementDraft(campaign,config) {
  const when=new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,dateStyle:'full',timeStyle:'short'}).format(new Date(campaign.start));
  const location=typeof campaign.location==='string'?campaign.location:campaign.location?.name;
  const site=httpsLink(config.siteUrl);
  const calendar=site?httpsLink(`${site.replace(/\/$/,'')}/calendar/${encodeURIComponent(campaign.year)}/${encodeURIComponent(campaign.id)}.ics`):'';
  const flyer=httpsLink(campaign.images?.feed||campaign.flyers?.feed||campaign.flyerUrl||(site?`${site.replace(/\/$/,'')}/media/${encodeURIComponent(campaign.year)}/${encodeURIComponent(campaign.id)}-feed.jpg`:''));
  const text=[campaign.title,`${when} (${config.timezone})`,location,campaign.description || '',...advertisingLines(campaign,config),calendar?`Calendar: ${calendar}`:'',flyer?`Flyer: ${flyer}`:''].filter(Boolean).join('\n');
  return text;
}
export function botAnnouncementText(campaign,config) {
  const text=groupMeAnnouncementDraft(campaign,config);
  if(text.length>1000) throw new Error('GroupMe announcement exceeds 1000 characters; shorten event copy or advertising details; RSVP links are never silently omitted');
  return text;
}
