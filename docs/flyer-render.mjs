import {renderStoryDesign,validateStoryDesign} from './story-design.mjs';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const color = (value, fallback) => /^#[0-9a-f]{3,8}$/i.test(value || '') ? value : fallback;
const safeUrl = value => { try { return new URL(value).protocol === 'https:' ? escape(value) : ''; } catch { return ''; } };
export function flyerAdvertising(campaign, config, format='feed') {
  const a=campaign.advertising || {};
  const concise=(value,max=100)=>value?.trim().replace(/\s+/g,' ').slice(0,max)+(value?.trim().replace(/\s+/g,' ').length>max?'…':'');
  const rows=[];
  if(a.benefit?.trim()) rows.push(concise(a.benefit,120));
  if(a.speaker?.trim()) rows.push(`Speaker: ${concise(a.speaker,90)}`);
  const meta=[a.audience?.trim()?`For: ${concise(a.audience,65)}`:'',a.cost?.trim()?`Cost: ${concise(a.cost,65)}`:''].filter(Boolean).join(' · ');
  if(meta) rows.push(meta);
  if(campaign.food && a.foodDetails?.trim()) rows.push(`Food: ${a.foodDetails.trim().replace(/\s+/g,' ')}`);
  let deadline='';
  if(a.rsvpDeadline?.trim()) {
    const raw=a.rsvpDeadline.trim();
    if(/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw) && Number.isFinite(Date.parse(raw))) deadline=new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(raw));
    else if(/^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(raw))) deadline=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(`${raw}T12:00:00Z`));
    else deadline=concise(raw,65);
  }
  if(deadline || (format!=='story'&&a.rsvpUrl?.trim())) rows.push([deadline?`RSVP by ${deadline}`:'',format!=='story'&&a.rsvpUrl?.trim()?'RSVP link in caption':''].filter(Boolean).join(' · '));
  if(!rows.length) return '';
  return `<div class="advertising">${rows.map(row=>`<p>${escape(row)}</p>`).join('')}${format==='story'?'':'<small>Full event details in caption.</small>'}</div>`;
}
export function flyerHtml(template, campaign, config, format, assets = {}) {
  const date = new Date(campaign.start), tz = config.timezone;
  validateStoryDesign(campaign.storyDesign);
  const image = assets.flyer?.startsWith('blob:')?escape(assets.flyer):safeUrl(assets.flyer||campaign.flyerUrl);
  if(format==='feed'&&image)return `<!doctype html><html><head><style>*{box-sizing:border-box;margin:0}html,body{width:1080px;background:#fff}img.uploaded-feed{display:block;width:1080px;height:auto}</style></head><body><img class="flyer uploaded-feed" src="${image}" alt="Uploaded flyer"></body></html>`;
  const logo = (assets.logoResolved?assets.logo:assets.logo || safeUrl(config.brand?.logoFlyer || config.brand?.logoMark || config.brand?.logoReverse || config.brand?.logo));
  const advertising=flyerAdvertising(campaign,config,format);
  const values = {
    flyerSource:image,advertising,advertisingClass:advertising?'enriched':'',
    primary:color(config.brand?.primary,'#102840'),accent:color(config.brand?.accent,'#ba0c2f'),background:color(config.brand?.background,'#f2f5f9'),
    titleSize:campaign.title.length>70?64:campaign.title.length>45?84:112,storyTitleSize:campaign.title.length>70?78:campaign.title.length>45?96:124,
    fontCss:assets.fontCss || '',brand:logo ? `<img class="logo" src="${logo}" alt="${escape(config.chapterName)}">` : escape(config.chapterName),
    day:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,day:'numeric'}).format(date)),month:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,month:'short'}).format(date)),
    foodClass:campaign.food ? '' : 'nofood',foodCell:campaign.food ? '<div class="cell food"><small>Food</small><b>Provided</b></div>' : '',
    format, chapter:escape(config.chapterName),school:escape(config.school),handle:escape(config.instagramHandle),
    type:escape(config.eventTypes.find(t=>t.id === campaign.type)?.name || campaign.type),
    title:escape(campaign.title),description:escape(campaign.description),location:escape(campaign.location?.name || (typeof campaign.location === 'string' ? campaign.location : '') || 'Location to be announced'),
    shortDate:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',month:'short',day:'numeric'}).format(date)),
    date:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'long',...(template.includes('{{day}}') ? {} : {month:'long',day:'numeric'})}).format(date)),
    time:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date)),
    food:campaign.food ? '<div class="food">Food provided</div>' : '',
    flyer:image ? `<img class="flyer" src="${image}" alt=""><div class="photo-overlay"></div>` : '',
    logo:logo ? `<img class="logo" src="${logo}" alt="">` : ''
  };
  if(assets.previewMissingDate)Object.assign(values,{date:'Choose a date',day:'—',month:'DATE',shortDate:'Choose a date',time:'Choose a time'});
  if(format==='story'&&campaign.storyDesign?.background&&campaign.storyDesign.background!=='template')return renderStoryDesign({campaign,config,assets,values});
  return template.replace(/{{(\w+)}}/g,(_,key)=>values[key] ?? '');
}
export async function fitFlyerDocument(doc = document) {
    await doc.fonts.ready;
    await Promise.all([...doc.images].map(image => image.decode().catch(() => {if(image.classList.contains('logo')){image.replaceWith(doc.createTextNode(image.alt||doc.body.dataset.chapter||'Chapter'));return;}if(image.classList.contains('story-flyer')||image.classList.contains('uploaded-feed'))throw Error('The uploaded flyer could not load. Check its URL or upload the image again.');})));
    const page = doc.querySelector('.page');
    if (!page) return;
    const title = page.querySelector('h1');
    const hero = page.querySelector('.hero');
    const fixed = [...page.children].filter(el => ['HEADER','FOOTER'].includes(el.tagName) || el.classList.contains('block'));
    const style = doc.defaultView.getComputedStyle(page);
    const gaps = Math.max(96, (parseFloat(style.rowGap) || 0) * fixed.length);
    const budget = page.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - fixed.reduce((sum,el)=>sum+el.getBoundingClientRect().height,0) - gaps;
    // Decorative artwork gives up space before text; the complete event details remain visible.
    const artwork = hero.querySelector('.artwork');
    if (artwork) {
      for (let height=artwork.getBoundingClientRect().height; height>100 && hero.getBoundingClientRect().height>budget; height-=10) artwork.style.height=`${Math.max(100,height-10)}px`;
    }
    for (let size=parseFloat(doc.defaultView.getComputedStyle(title).fontSize); size>44 && (hero.getBoundingClientRect().height>budget || title.getBoundingClientRect().height>size*3.2); size-=2) title.style.fontSize=`${Math.max(44,size-2)}px`;
    if (hero.getBoundingClientRect().height > budget) throw new Error('Flyer text exceeds the available layout; shorten the title or location');
    const bounds=page.getBoundingClientRect(), contentBottom=bounds.bottom-parseFloat(style.paddingBottom);
    const block=page.querySelector('.block'), footer=page.querySelector('footer');
    if (block && hero.getBoundingClientRect().bottom>block.getBoundingClientRect().top+1) throw new Error('Flyer event details overlap the title');
    if (footer && footer.getBoundingClientRect().bottom>contentBottom+1) throw new Error('Flyer text exceeds the safe publishing area');

}
