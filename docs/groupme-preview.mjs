import {groupMeAnnouncementDraft} from './groupme-message.mjs';

export function groupMeBotAvatar(config) {
  const value=config.integrations?.groupme?.botAvatar||'assets/logos/groupme-bot.png';
  if(typeof value!=='string')return '';
  if(/^(?:\.\/)?assets\/[a-zA-Z0-9._/-]+$/.test(value)&&!value.split('/').includes('..'))return value;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}

export function groupMePreviewContent(campaign,config,{useRecorded=true,pendingFlyerUpload=false,kind='initial'}={}) {
  const integration=config.integrations?.groupme||{},initial=campaign.results?.groupme||{},result=kind==='followUp'?(initial.followUp||{}):initial;
  const name=typeof integration.botName==='string'&&integration.botName.trim()?integration.botName.trim():'Gearley';
  const recorded=useRecorded&&typeof result.botText==='string'&&Boolean(result.botAttemptedAt||result.botSentAt);
  const skipped=kind==='followUp'?result.status==='skipped':campaign.status?.groupme==='skipped';
  const initialUnresolved=kind==='followUp'&&!!initial.botAttemptedAt&&!initial.botSentAt;
  const enabled=!skipped&&!initialUnresolved&&integration.enabled!==false&&integration.mode==='bot'&&campaign.campaign?.groupme?.enabled===true&&campaign.campaign?.groupme?.announce===true&&(kind!=='followUp'||campaign.campaign?.groupme?.followUp?.enabled===true)&&!campaign.cancelled&&!campaign.deletedAt&&!campaign.demo&&!campaign.archived&&(!config.activeYear||campaign.year===config.activeYear);
  let text='',error='';
  if(recorded)text=result.botText;
  else if(!Number.isFinite(Date.parse(campaign.start)))error='Choose an event date to preview the GroupMe announcement.';
  else if(integration.mode!=='bot')error='GroupMe bot announcement previews apply when the chapter uses bot mode.';
  else try{text=groupMeAnnouncementDraft(campaign,config,{kind});}catch(cause){error=cause.message;}
  if(text.length>1000)error='GroupMe announcement exceeds 1000 characters; shorten event copy or advertising details; RSVP links are never silently omitted';
  const state=recorded?(result.botSentAt?'sent':'attempted'):error?'invalid':enabled?'preview':'off';
  const label=recorded?(result.botSentAt?'Recorded sent announcement':'Recorded publishing attempt'):enabled?'Preview only · not sent':'GroupMe is off · will not send';
  let note=recorded?(result.botSentAt?'Showing the message recorded when this announcement was sent.':'Showing the recorded publishing attempt. Delivery is unconfirmed; inspect GroupMe before retrying.'):campaign.cancelled||campaign.deletedAt?'This campaign is cancelled. Its pending announcement will not be sent.':enabled?'This is the exact message the bot will send when the campaign is due. Previewing does not send a message.':'Turn on the GroupMe announcement for this campaign to schedule this message.';
  if(!recorded){if(campaign.demo)note='Example campaign only. Example announcements are never dispatched.';else if(campaign.archived)note='This campaign is archived. Its announcement will not be sent.';else if(config.activeYear&&campaign.year!==config.activeYear)note='This campaign is outside the active academic year. Its announcement will not be sent.';else if(integration.enabled===false)note='GroupMe is off for this chapter. Enable chapter-wide bot posting before scheduling announcements.';else if(error)note='Resolve the warning before this announcement can be published.';}
  if(!recorded&&pendingFlyerUpload)note=(enabled?'':note+' ')+'New flyer links are finalized when uploads are saved. Review the saved campaign before dispatching.';
  if(!recorded&&skipped)note='This message was skipped and will not be sent. Review its schedule before rescheduling.';
  if(!recorded&&initialUnresolved)note='The initial message has an unresolved delivery attempt. Inspect GroupMe before this follow-up can be sent.';
  if(kind==='followUp')note='Follow-up message. '+note+' A follow-up is sent only after the initial announcement is confirmed.';
  return {name,avatar:groupMeBotAvatar(config),text,error,count:text.length,enabled,state,label,note,recorded};
}

export function mountGroupMePreview(container,campaign,config,options={}) {
  const root=document.createElement('section');root.className='gm-preview';root.setAttribute('aria-label','GroupMe announcement preview');
  root.innerHTML='<div class="gm-message-tabs" role="group" aria-label="GroupMe message"><button type="button" data-gm-kind="initial" aria-pressed="true">Initial message</button><button type="button" data-gm-kind="followUp" aria-pressed="false">Follow-up</button></div><div class="gm-preview-heading"><strong>GroupMe message preview</strong><span class="gm-status"></span></div><div class="gm-conversation"><span class="gm-avatar" aria-hidden="true"></span><div class="gm-message-column"><div class="gm-bot-heading"><strong class="gm-bot-name"></strong><span class="gm-bot-badge">BOT</span></div><div class="gm-message" role="region" tabindex="0" aria-label="GroupMe announcement; scroll to read"><span class="gm-message-text"></span></div></div></div><div class="gm-preview-footer"><p class="gm-note"></p><span class="gm-count"></span></div><p class="gm-error" role="status" hidden></p>';
  let currentOptions=options;
  function update(nextCampaign=campaign,nextConfig=config,nextOptions=currentOptions) {
    campaign=nextCampaign;config=nextConfig;currentOptions={...nextOptions};
    const hasFollowUp=!!campaign.campaign?.groupme?.followUp?.enabled;
    if(!hasFollowUp)currentOptions.kind='initial';
    root.querySelector('.gm-message-tabs').hidden=!hasFollowUp;
    for(const button of root.querySelectorAll('[data-gm-kind]'))button.setAttribute('aria-pressed',String(button.dataset.gmKind===(currentOptions.kind||'initial')));
    const content=groupMePreviewContent(campaign,config,currentOptions);root.dataset.state=content.state;
    root.querySelector('.gm-bot-name').textContent=content.name;root.querySelector('.gm-message-text').textContent=content.text;root.querySelector('.gm-status').textContent=content.label;root.querySelector('.gm-note').textContent=content.note;
    root.querySelector('.gm-message').hidden=!content.text;
    root.querySelector('.gm-count').textContent=content.text?`${content.count} / 1000 characters`:'';
    const error=root.querySelector('.gm-error');error.textContent=content.error;error.hidden=!content.error;
    const avatar=root.querySelector('.gm-avatar');
    if(avatar.dataset.source!==content.avatar){avatar.dataset.source=content.avatar;avatar.replaceChildren();if(content.avatar){const image=document.createElement('img');image.alt='';image.src=content.avatar;image.addEventListener('error',()=>{avatar.textContent=content.name.slice(0,1).toUpperCase();},{once:true});avatar.append(image);}else avatar.textContent=content.name.slice(0,1).toUpperCase();}
    return content;
  }
  for(const button of root.querySelectorAll('[data-gm-kind]'))button.addEventListener('click',()=>update(campaign,config,{...currentOptions,kind:button.dataset.gmKind}));
  container.replaceChildren(root);update(campaign,config,options);return {root,update,select(kind){return update(campaign,config,{...currentOptions,kind});}};
}
