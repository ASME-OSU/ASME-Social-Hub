// Public event destinations shared by announcements and the member page.
export function httpsLink(value) {
  try { const url=new URL(value); return url.protocol==='https:'&&!url.username&&!url.password?url.href:''; } catch { return ''; }
}
export function eventPageUrl(campaign,config) {
  let site=httpsLink(config.siteUrl);
  if(!site&&config.previewOnly===true){try{const url=new URL(config.siteUrl);if(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password)site=url.href;}catch{}}
  if(!site||!/^\d{4}-\d{2}$/.test(campaign.year||'')||!/^[a-z0-9][a-z0-9_-]*$/i.test(campaign.id||''))return '';
  const base=new URL(site);base.pathname=base.pathname.replace(/\/?$/,'/');base.search='';base.hash='';
  return new URL(`events/${encodeURIComponent(campaign.year)}/${encodeURIComponent(campaign.id)}/`,base).href;
}
export function eventIdentity(search) {
  const params=new URLSearchParams(search),year=params.get('year'),id=params.get('id');
  if(!/^\d{4}-\d{2}$/.test(year||'')||!/^[a-z0-9][a-z0-9_-]*$/i.test(id||''))throw Error('This event link is incomplete or invalid.');
  return {year,id};
}
