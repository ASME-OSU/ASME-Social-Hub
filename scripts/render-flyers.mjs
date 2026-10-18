import { readFile, mkdir, writeFile, realpath, stat } from 'node:fs/promises';
import { resolve, dirname, sep, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCampaigns, validateConfig, validateCampaign, validateAdvertising } from './core.mjs';


export const FLYER_TEMPLATES = Object.freeze(['blueprint','editorial','refined-blueprint','editorial-poster','assembly-card']);
export function selectFlyerTemplate(campaign, config) {
  const name = [campaign.template, config.eventTypes?.find(type => type.id === campaign.type)?.template, config.defaultTemplate, 'editorial'].find(value => value !== undefined);
  if (!FLYER_TEMPLATES.includes(name)) throw new Error('Invalid flyer template name');
  return name;
}

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
    title:escape(campaign.title),description:escape(campaign.description),location:escape(campaign.location?.name || (typeof campaign.location === 'string' ? campaign.location : '') || 'Location to be announced'),
    shortDate:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',month:'short',day:'numeric'}).format(date)),
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
    const gaps = Math.max(96, (parseFloat(style.rowGap) || 0) * fixed.length);
    const budget = page.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - fixed.reduce((sum,el)=>sum+el.getBoundingClientRect().height,0) - gaps;
    // Decorative artwork gives up space before text; the complete event details remain visible.
    const artwork = hero.querySelector('.artwork');
    if (artwork) {
      for (let height=artwork.getBoundingClientRect().height; height>100 && hero.getBoundingClientRect().height>budget; height-=10) artwork.style.height=`${Math.max(100,height-10)}px`;
    }
    for (let size=parseFloat(getComputedStyle(title).fontSize); size>44 && (hero.getBoundingClientRect().height>budget || title.getBoundingClientRect().height>size*3.2); size-=2) title.style.fontSize=`${Math.max(44,size-2)}px`;
    if (hero.getBoundingClientRect().height > budget) throw new Error('Flyer text exceeds the available layout; shorten the title or location');
    const bounds=page.getBoundingClientRect(), contentBottom=bounds.bottom-parseFloat(style.paddingBottom);
    const block=page.querySelector('.block'), footer=page.querySelector('footer');
    if (block && hero.getBoundingClientRect().bottom>block.getBoundingClientRect().top+1) throw new Error('Flyer event details overlap the title');
    if (footer && footer.getBoundingClientRect().bottom>contentBottom+1) throw new Error('Flyer text exceeds the safe publishing area');
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
      const templateName=selectFlyerTemplate(campaign,config);
      const template=await readFile(resolve(root,`templates/${templateName}.html`),'utf8');
      for (const format of ['feed','story']) {
        const target = resolve(root,`docs/media/${campaign.year}/${campaign.id}-${format}.jpg`);
        const marker = resolve(root,`.local/render/${campaign.year}/${campaign.id}-${format}.revision`);
        const revision = JSON.stringify({campaign,config,template,assets});
        // Published media are immutable; regenerating must never change an existing posted asset.
        if (isFlyerLocked(campaign,format)) continue;
        const existingImage = await stat(target).catch(()=>null);
        if (!force && existingImage?.isFile() && existingImage.size > 0 && await readFile(marker,'utf8').catch(()=>null) === revision) continue;
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
