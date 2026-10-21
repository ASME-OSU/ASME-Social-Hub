// Public event destinations shared by announcements and the member page.
export function httpsLink(value) {
  try { const url=new URL(value); return url.protocol==='https:'&&!url.username&&!url.password?url.href:''; } catch { return ''; }
}
export function eventPageUrl(campaign,config) {
  const site=httpsLink(config.siteUrl);
  if(!site||!campaign.year||!campaign.id)return '';
  const url=new URL(`${site.replace(/\/$/,'')}/event.html`);
  url.searchParams.set('year',campaign.year);url.searchParams.set('id',campaign.id);
  return url.href;
}
export function eventIdentity(search) {
  const params=new URLSearchParams(search),year=params.get('year'),id=params.get('id');
  if(!/^\d{4}-\d{2}$/.test(year||'')||!/^[a-z0-9][a-z0-9_-]*$/i.test(id||''))throw Error('This event link is incomplete or invalid.');
  return {year,id};
}
