import {safeJson} from './ig.mjs';
import {advertisingLines} from './core.mjs';
const retrySafe = message => Object.assign(new Error(message), {retrySafe:true});
const REMINDERS = new Set([0,300,900,1800,3600,7200,86400,172800,604800]);
const httpsLink=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}};
export function botAnnouncementText(campaign,config) {
  const when=new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,dateStyle:'full',timeStyle:'short'}).format(new Date(campaign.start));
  const location=typeof campaign.location==='string'?campaign.location:campaign.location?.name;
  const site=httpsLink(config.siteUrl);
  const calendar=site?httpsLink(`${site.replace(/\/$/,'')}/calendar/${encodeURIComponent(campaign.year)}/${encodeURIComponent(campaign.id)}.ics`):'';
  const flyer=httpsLink(campaign.images?.feed||campaign.flyers?.feed||campaign.flyerUrl||(site?`${site.replace(/\/$/,'')}/media/${encodeURIComponent(campaign.year)}/${encodeURIComponent(campaign.id)}-feed.jpg`:''));
  const text=[campaign.title,`${when} (${config.timezone})`,location,campaign.description || '',...advertisingLines(campaign,config),calendar?`Calendar: ${calendar}`:'',flyer?`Flyer: ${flyer}`:''].filter(Boolean).join('\n');
  if(text.length>1000) throw new Error('GroupMe announcement exceeds 1000 characters; shorten event copy or advertising details; RSVP links are never silently omitted');
  return text;
}
export function eventPayload(campaign, config) {
  const reminders = campaign.campaign?.groupme?.reminders ?? [604800,86400];
  if (reminders.length > 2 || reminders.some(x => !REMINDERS.has(x))) throw new Error('Invalid GroupMe reminders');
  if (!campaign.end) throw new Error('GroupMe events require an end time');
  return {name:campaign.title,start_at:campaign.start,end_at:campaign.end,timezone:config.timezone,description:[campaign.description || '',...advertisingLines(campaign,config)].filter(Boolean).join('\n'),is_all_day:Boolean(campaign.allDay),...(campaign.location?.name ? {location:campaign.location}:{}),reminders};
}
export function createGroupMeClient({env = process.env, fetchImpl = fetch} = {}) {
  const request = async (resource, method='GET', payload) => {
    if (!env.GROUPME_TOKEN || !env.GROUPME_GROUP_ID) throw retrySafe('GroupMe requires GROUPME_TOKEN and GROUPME_GROUP_ID');
    let response; try { response = await fetchImpl(`https://api.groupme.com/v3/conversations/${encodeURIComponent(env.GROUPME_GROUP_ID)}/events/${resource}`,{method,headers:{'X-Access-Token':env.GROUPME_TOKEN,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(30000)}); } catch { throw new Error('GroupMe: network request failed; reconcile before retrying writes'); }
    if ((response.status === 204 || method === 'DELETE') && response.ok) return {};
    return safeJson(response,'GroupMe');
  };
  const save = async (action,campaign,config) => {
    if (!env.GROUPME_TOKEN || !env.GROUPME_GROUP_ID) throw retrySafe('GroupMe requires GROUPME_TOKEN and GROUPME_GROUP_ID');
    const payload = eventPayload(campaign,config);
    // Calendar API accepts only images uploaded to GroupMe's image service.
    const image = campaign.images?.feed || campaign.flyerUrl || (config.siteUrl ? `${config.siteUrl.replace(/\/$/, '')}/media/${campaign.year}/${campaign.id}-feed.jpg` : '');
    if (image) {
      let media; try { media = await fetchImpl(image,{signal:AbortSignal.timeout(30000)}); } catch { throw retrySafe('GroupMe flyer could not be fetched'); }
      if (!media.ok || !/^image\//.test(media.headers.get('content-type') || '')) throw retrySafe('GroupMe flyer must be a reachable image');
      let uploaded; try { uploaded = await fetchImpl('https://image.groupme.com/pictures',{method:'POST',headers:{'X-Access-Token':env.GROUPME_TOKEN,'Content-Type':media.headers.get('content-type')},body:await media.arrayBuffer(),signal:AbortSignal.timeout(30000)}); } catch { throw retrySafe('GroupMe image upload failed'); }
      let body; try { body = await safeJson(uploaded,'GroupMe image upload'); } catch { throw retrySafe('GroupMe image upload failed'); } payload.image_url = body.payload?.url;
      if (!payload.image_url) throw retrySafe('GroupMe image upload response missing URL');
    }
    const body = await request(action,'POST',payload); const event = body.response?.event || body.event;
    if (!event?.event_id) throw new Error('GroupMe response missing event ID; reconcile before retrying');
    const eventUrl = (body.response || body).message?.event?.data?.url;
    return {eventId:String(event.event_id),createdAt:event.created_at || new Date().toISOString(),...(typeof eventUrl === 'string' && eventUrl.startsWith('https://s.groupme.com/') ? {eventUrl} : {})};
  };
  return {listEvents:()=>request(`list?end_at=${encodeURIComponent(new Date().toISOString())}&limit=20`),createEvent:(c,cfg)=>save('create',c,cfg),updateEvent:(id,c,cfg)=>save(`update?event_id=${encodeURIComponent(id)}`,c,cfg),deleteEvent:id=>request(`delete?event_id=${encodeURIComponent(id)}`,'DELETE')};
}
export async function postBotMessage(text,{env=process.env,fetchImpl=fetch}={}) {
  if(typeof text!=='string'||!text.trim()||text.length>1000) throw new Error('GroupMe bot text must contain 1 to 1000 characters');
  if (!env.GROUPME_BOT_ID) throw new Error('GROUPME_BOT_ID is required');
  let response; try { response = await fetchImpl('https://api.groupme.com/v3/bots/post',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bot_id:env.GROUPME_BOT_ID,text}),signal:AbortSignal.timeout(30000)}); } catch { throw new Error('GroupMe bot network request failed'); }
  if (!response.ok) throw new Error(`GroupMe bot rejected request (HTTP ${response.status})`);
}
