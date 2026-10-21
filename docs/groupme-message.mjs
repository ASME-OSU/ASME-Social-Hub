// Shared by live publishing and the browser preview; do not trim or shorten preview copy.
import {advertisingLines} from './caption.mjs';
import {eventPageUrl} from './event-links.mjs';
export function groupMeAnnouncementDraft(campaign,config) {
  const when=new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,dateStyle:'full',timeStyle:'short'}).format(new Date(campaign.start));
  const location=typeof campaign.location==='string'?campaign.location:campaign.location?.name;
  const event=eventPageUrl(campaign,config);
  const text=[campaign.title,`${when} (${config.timezone})`,location,campaign.description || '',...advertisingLines(campaign,config),event?`Event details: ${event}`:''].filter(Boolean).join('\n');
  return text;
}
export function botAnnouncementText(campaign,config) {
  const text=groupMeAnnouncementDraft(campaign,config);
  if(text.length>1000) throw new Error('GroupMe announcement exceeds 1000 characters; shorten event copy or advertising details; RSVP links are never silently omitted');
  return text;
}
