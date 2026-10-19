import {flyerSources,mediaName} from '../docs/carousel.mjs';
import {feedImageIssue} from '../docs/image-policy.mjs';
import { readFile, mkdir, writeFile, realpath, stat } from 'node:fs/promises';
import { resolve, dirname, sep, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import {flyerHtml as renderHtml, flyerAdvertising as renderAdvertising, fitFlyerDocument} from '../docs/flyer-render.mjs';
import { readCampaigns, validateConfig, validateCampaign, validateAdvertising } from './core.mjs';


export const FLYER_TEMPLATES = Object.freeze(['blueprint','editorial','refined-blueprint','editorial-poster','assembly-card']);
export function selectFlyerTemplate(campaign, config) {
  const name = [campaign.template, config.eventTypes?.find(type => type.id === campaign.type)?.template, config.defaultTemplate, 'editorial'].find(value => value !== undefined);
  if (!FLYER_TEMPLATES.includes(name)) throw new Error('Invalid flyer template name');
  return name;
}

const safeUrl = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
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
  validateAdvertising(campaign.advertising);
  return renderAdvertising(campaign, config, format);
}
export function flyerHtml(template, campaign, config, format, assets={}) {
  validateAdvertising(campaign.advertising);
  return renderHtml(template, campaign, config, format, assets);
}
export async function fitFlyer(page) { await page.evaluate(fitFlyerDocument); }

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
  const rendererSource = await Promise.all(['flyer-render.mjs','story-design.mjs','image-policy.mjs','carousel.mjs'].map(name=>readFile(new URL('../docs/'+name,import.meta.url),'utf8')));
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({headless:true});
  let count = 0;
  try {
    for (const campaign of await readCampaigns(root)) {
      validateCampaign(campaign);
      if (campaign.demo || campaign.cancelled) continue;
      const templateName=selectFlyerTemplate(campaign,config);
      const template=await readFile(resolve(root,`templates/${templateName}.html`),'utf8');
      const sources=flyerSources(campaign);
      for (const format of ['feed','story']) {
       const imageCount=format==='feed'&&!campaign.images?.feed&&!campaign.flyers?.feed?Math.max(1,sources.length):1;
       for(let imageIndex=0;imageIndex<imageCount;imageIndex++){
        const target = resolve(root,`docs/media/${campaign.year}/${mediaName(campaign,format,imageIndex)}`);
        const marker = resolve(root,`.local/render/${campaign.year}/${mediaName(campaign,format,imageIndex)}.revision`);
        const revision = JSON.stringify({campaign,config,template,assets,rendererSource});
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
          await page.setContent(flyerHtml(template,{...campaign,flyerUrl:sources[format==='feed'?imageIndex:0]||campaign.flyerUrl},config,format,assets),{waitUntil:'networkidle'});
          await fitFlyer(page);
          await mkdir(dirname(target),{recursive:true});
          const uploaded=page.locator('img.uploaded-feed');
          if(await uploaded.count()){const {width,height}=await uploaded.evaluate(image=>({width:image.naturalWidth,height:image.naturalHeight}));const issue=feedImageIssue(width,height);if(campaign.campaign?.feed?.enabled&&issue)throw Error(issue);await uploaded.screenshot({path:target,type:'jpeg',quality:93});}
          else await page.screenshot({path:target,type:'jpeg',quality:93});
          await mkdir(dirname(marker),{recursive:true});
          await writeFile(marker,revision);
          console.log(`Rendered ${campaign.id} ${format}`); count++;
        } finally { await page.close(); }
       }
      }
    }
  } finally { await browser.close(); }
  console.log(`${count} flyer images rendered`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await renderFlyers({force:process.argv.includes('--force')});
