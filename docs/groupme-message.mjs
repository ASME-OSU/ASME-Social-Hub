// Shared by live publishing and the browser preview; do not trim or shorten preview copy.
import {timeZoneName} from './display-time.mjs';
import {advertisingLines} from './caption.mjs';
import {eventPageUrl} from './event-links.mjs';
import {publicEventURL} from './event-page.mjs';
export const GROUPME_FORMATS=Object.freeze({standard:'Event details',invite:'Friendly invite',bulletin:'Quick bulletin'});
export function randomGroupMeFormat(current,random=Math.random) {
 const choices=Object.keys(GROUPME_FORMATS).filter(key=>key!==current);
 return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
}
export function groupMeAnnouncementDraft(campaign,config,{kind='initial'}={}) {
  const when=new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,dateStyle:'full',timeStyle:'short'}).format(new Date(campaign.start));
  const location=typeof campaign.location==='string'?campaign.location:campaign.location?.name;
  const event=config.previewOnly===true?publicEventURL(campaign,config):eventPageUrl(campaign,config);
  const plan=campaign.campaign?.groupme||{},format=(kind==='followUp'?plan.followUp?.format:plan.format)||'standard',reminder=kind==='followUp';
  const date=`${when} ${timeZoneName(campaign.start,config.timezone)}`;
  const heading=format==='invite'?`${reminder?'Coming up soon':'You’re invited'}: ${campaign.title}`:format==='bulletin'?`${reminder?'EVENT REMINDER':'UPCOMING EVENT'} · ${campaign.title}`:reminder?`Reminder: ${campaign.title}`:campaign.title;
  const details=format==='bulletin'?[`When: ${date}`,location?`Where: ${location}`:'']:[date,location];
  const text=[heading,...details,campaign.description || '',...advertisingLines(campaign,config),event?`Event details: ${event}`:''].filter(Boolean).join('\n');
  return text;
}
export function botAnnouncementText(campaign,config,options) {
  const text=groupMeAnnouncementDraft(campaign,config,options);
  if(text.length>1000) throw new Error('GroupMe announcement exceeds 1000 characters; shorten event copy or advertising details; RSVP links are never silently omitted');
  return text;
}
