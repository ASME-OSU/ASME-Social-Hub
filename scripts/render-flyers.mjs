import { readFile, mkdir, writeFile, realpath } from 'node:fs/promises';
import { resolve, dirname, sep, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCampaigns, validateConfig, validateCampaign, validateAdvertising } from './core.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const color = (value, fallback) => /^#[0-9a-f]{3,8}$/i.test(value || '') ? value : fallback;
const safeUrl = value => { try { return new URL(value).protocol === 'https:' ? escape(value) : ''; } catch { return ''; } };
// Only bundled fonts and files physically inside the logo directory may become data URIs.
export async function loadFlyerAssets(root, config) {
  const fonts = [];
  for (const [filename,family,weight] of [['dm-serif-display-latin.woff2','DM Serif Display','400'],['inter-latin.woff2','Inter','100 900']]) {
    const base = await realpath(resolve(root,'docs/assets/fonts'));
    const file = await realpath(resolve(base,filename));
    if (!file.startsWith(base+sep)) throw new Error('Font must stay inside bundled font directory');
    fonts.push(`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${(await readFile(file)).toString('base64')}) format('woff2');}`);
  }
  let logo = '';
  const configured = config.brand?.logoFlyer || config.brand?.logoMark || config.brand?.logoReverse || config.brand?.logo;
  if (configured && !safeUrl(configured)) {
    const candidate = configured.replace(/^\/?(?:docs\/)?assets\/logos\//,'');
    if (!candidate.includes('..') && !candidate.includes(':')) {
      try {
        const base = await realpath(resolve(root,'docs/assets/logos'));
        const file = await realpath(resolve(base,candidate));
        const mime = {'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'}[extname(file).toLowerCase()];
        if (file.startsWith(base+sep) && mime) logo = `data:${mime};base64,${(await readFile(file)).toString('base64')}`;
      } catch { /* Missing optional logo falls back to chapter name. */ }
    }
  }
  return {fontCss:fonts.join('\n'),logo};
}
export function flyerAdvertising(campaign, config, format='feed') {
  const a=campaign.advertising || {};
  validateAdvertising(campaign.advertising);
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
  const image = safeUrl(campaign.flyerUrl);
  const logo = assets.logo || safeUrl(config.brand?.logoFlyer || config.brand?.logoMark || config.brand?.logoReverse || config.brand?.logo);
  const advertising=flyerAdvertising(campaign,config,format);
  const values = {
    advertising,advertisingClass:advertising?'enriched':'',
    primary:color(config.brand?.primary,'#102840'),accent:color(config.brand?.accent,'#ba0c2f'),background:color(config.brand?.background,'#f2f5f9'),
    titleSize:campaign.title.length>70?64:campaign.title.length>45?84:112,storyTitleSize:campaign.title.length>70?78:campaign.title.length>45?96:124,
    fontCss:assets.fontCss || '',brand:logo ? `<img class="logo" src="${logo}" alt="${escape(config.chapterName)}">` : escape(config.chapterName),
    day:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,day:'numeric'}).format(date)),month:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,month:'short'}).format(date)),
    foodClass:campaign.food ? '' : 'nofood',foodCell:campaign.food ? '<div class="cell food"><small>Food</small><b>Provided</b></div>' : '',
    format, chapter:escape(config.chapterName),school:escape(config.school),handle:escape(config.instagramHandle),
    type:escape(config.eventTypes.find(t=>t.id === campaign.type)?.name || campaign.type),
    title:escape(campaign.title),description:escape(campaign.description),location:escape(campaign.location?.name || 'Location to be announced'),
    date:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'long',...(template.includes('{{day}}') ? {} : {month:'long',day:'numeric'})}).format(date)),
    time:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date)),
    food:campaign.food ? '<div class="food">Food provided</div>' : '',
    flyer:image ? `<img class="flyer" src="${image}" alt=""><div class="photo-overlay"></div>` : '',
    logo:logo ? `<img class="logo" src="${logo}" alt="">` : ''
  };
  return template.replace(/{{(\w+)}}/g,(_,key)=>values[key] ?? '');
}
export async function fitFlyer(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    const page = document.querySelector('.page');
    if (!page) return;
    const title = page.querySelector('h1');
    const hero = page.querySelector('.hero');
    const fixed = [...page.children].filter(el => ['HEADER','FOOTER'].includes(el.tagName) || el.classList.contains('block'));
    const style = getComputedStyle(page);
    const budget = page.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - fixed.reduce((sum,el)=>sum+el.getBoundingClientRect().height,0) - 96;
    for (let size=parseFloat(getComputedStyle(title).fontSize); size>44 && (hero.getBoundingClientRect().height>budget || title.getBoundingClientRect().height>size*3.2); size-=2) title.style.fontSize=`${size-2}px`;
    if (hero.getBoundingClientRect().height > budget) throw new Error('Flyer text exceeds the available layout; shorten the title or location');
  });
}
export function isFlyerLocked(campaign, format) {
  const result = campaign.results?.[format] || {};
  if (result.mediaId || result.publishAttemptedAt || campaign.status?.[format] === 'done') return true;
  // Legacy containers without a recorded revision are also retained by the dispatcher.
  return Boolean(result.containerId && (result.preparedRevision === undefined || result.preparedRevision === (campaign.revision ?? 0)));
}
export async function renderFlyers({root = process.cwd(), force = false} = {}) {
  const config = JSON.parse(await readFile(resolve(root,'config/chapter.json'),'utf8'));
  validateConfig(config);
  const assets = await loadFlyerAssets(root,config);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({headless:true});
  let count = 0;
  try {
    for (const campaign of await readCampaigns(root)) {
      validateCampaign(campaign);
      if (campaign.demo || campaign.cancelled) continue;
      const templateName=config.eventTypes?.find(t=>t.id===campaign.type)?.template || config.defaultTemplate || 'editorial';
      if(!/^[a-z0-9-]+$/.test(templateName)) throw new Error('Invalid flyer template name');
      const template=await readFile(resolve(root,`templates/${templateName}.html`),'utf8');
      for (const format of ['feed','story']) {
        const target = resolve(root,`docs/media/${campaign.year}/${campaign.id}-${format}.jpg`);
        const marker = resolve(root,`.local/render/${campaign.year}/${campaign.id}-${format}.revision`);
        const revision = JSON.stringify({campaign,brand:config.brand,template,assets});
        // Published media are immutable; regenerating must never change an existing posted asset.
        if (isFlyerLocked(campaign,format)) continue;
        if (!force && await readFile(marker,'utf8').catch(()=>null) === revision) continue;
        const page = await browser.newPage({viewport:{width:1080,height:format === 'feed' ? 1350 : 1920},deviceScaleFactor:1});
        try {
          await page.route('**/*', route => {
            const requestUrl = new URL(route.request().url());
            return requestUrl.protocol === 'https:' ? route.continue() : route.abort();
          });
          await page.setContent(flyerHtml(template,campaign,config,format,assets),{waitUntil:'networkidle'});
          await fitFlyer(page);
          await mkdir(dirname(target),{recursive:true});
          await page.screenshot({path:target,type:'jpeg',quality:93});
          await mkdir(dirname(marker),{recursive:true});
          await writeFile(marker,revision);
          console.log(`Rendered ${campaign.id} ${format}`); count++;
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
  console.log(`${count} flyer images rendered`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await renderFlyers({force:process.argv.includes('--force')});
