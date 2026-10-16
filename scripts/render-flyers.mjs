import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCampaigns, validateConfig, validateCampaign } from './core.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const color = (value, fallback) => /^#[0-9a-f]{3,8}$/i.test(value || '') ? value : fallback;
const safeUrl = value => { try { return new URL(value).protocol === 'https:' ? escape(value) : ''; } catch { return ''; } };
export function flyerHtml(template, campaign, config, format) {
  const date = new Date(campaign.start), tz = config.timezone;
  const image = safeUrl(campaign.flyerUrl);
  const logo = safeUrl(config.brand?.logo);
  const values = {
    primary:color(config.brand?.primary,'#102840'),accent:color(config.brand?.accent,'#ba0c2f'),background:color(config.brand?.background,'#f2f5f9'),
    titleSize:campaign.title.length>70?64:campaign.title.length>45?78:100,storyTitleSize:campaign.title.length>70?78:campaign.title.length>45?92:110,
    format, chapter:escape(config.chapterName),school:escape(config.school),handle:escape(config.instagramHandle),
    type:escape(config.eventTypes.find(t=>t.id === campaign.type)?.name || campaign.type),
    title:escape(campaign.title),description:escape(campaign.description),location:escape(campaign.location?.name),
    date:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'long',month:'long',day:'numeric'}).format(date)),
    time:escape(new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date)),
    food:campaign.food ? '<div class="food">Food provided</div>' : '',
    flyer:image ? `<img class="flyer" src="${image}" alt="Event flyer">` : '',
    logo:logo ? `<img class="logo" src="${logo}" alt="">` : ''
  };
  return template.replace(/{{(\w+)}}/g,(_,key)=>values[key] ?? '');
}
export async function renderFlyers({root = process.cwd(), force = false} = {}) {
  const config = JSON.parse(await readFile(resolve(root,'config/chapter.json'),'utf8'));
  validateConfig(config);
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
        const revision = JSON.stringify({campaign,brand:config.brand,template});
        // Published media are immutable; regenerating must never change an existing posted asset.
        if (campaign.results?.[format]?.mediaId || campaign.status?.[format] === 'done') continue;
        if (!force && await readFile(marker,'utf8').catch(()=>null) === revision) continue;
        const page = await browser.newPage({viewport:{width:1080,height:format === 'feed' ? 1350 : 1920},deviceScaleFactor:1});
        try {
          await page.route('**/*', route => {
            const requestUrl = new URL(route.request().url());
            return requestUrl.protocol === 'https:' ? route.continue() : route.abort();
          });
          await page.setContent(flyerHtml(template,campaign,config,format),{waitUntil:'networkidle'});
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
