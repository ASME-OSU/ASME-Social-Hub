export const STORY_BACKGROUNDS = Object.freeze({template:'Chapter template','color-wash':'Color wash','blueprint-rings':'Blueprint rings','folded-paper':'Folded paper'});
const hex=/^#[0-9a-f]{6}$/;
const defaults=['#102840','#ba0c2f','#f2f5f9'];
const normalize=value=>{if(typeof value!=='string')return null;const v=value.toLowerCase();if(hex.test(v))return v;if(/^#[0-9a-f]{3}$/.test(v))return '#'+[...v.slice(1)].map(c=>c+c).join('');return null;};
export function validateStoryDesign(design){
  if(design===undefined)return;
  if(!design||typeof design!=='object'||Array.isArray(design)||Object.keys(design).some(k=>!['background','palette','paletteSource'].includes(k))||!Object.hasOwn(STORY_BACKGROUNDS,design.background))throw Error('Invalid Story background');
  if(design.paletteSource!==undefined&&!['flyer','chapter','custom'].includes(design.paletteSource))throw Error('Invalid Story palette source');
  if(design.palette!==undefined&&(!Array.isArray(design.palette)||design.palette.length!==3||!design.palette.every(c=>typeof c==='string'&&hex.test(c))))throw Error('Story palette must contain three normalized six-digit hex colors');
}
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const toHex=c=>'#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,t)=>toHex(a.map((v,i)=>v*(1-t)+b[i]*t));
export function paletteFromPixels(pixels,fallbackPalette=defaults){
  const fallback=Array.isArray(fallbackPalette)&&fallbackPalette.length===3&&fallbackPalette.every(c=>typeof c==='string'&&hex.test(c))?fallbackPalette:defaults;
  const bins=new Map();
  for(let i=0;i+3<pixels.length;i+=4){const [r,g,b,a]=pixels.slice(i,i+4);if(a<192||Math.min(r,g,b)>240||Math.max(r,g,b)<20||Math.max(r,g,b)-Math.min(r,g,b)<18)continue;const key=[r,g,b].map(v=>Math.floor(v/32)).join(',');const bin=bins.get(key)||{count:0,sum:[0,0,0],key};bin.count++;bin.sum[0]+=r;bin.sum[1]+=g;bin.sum[2]+=b;bins.set(key,bin);}
  const colors=[...bins.values()].sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key)).map(b=>({color:b.sum.map(v=>v/b.count),count:b.count}));
  if(!colors.length)return [...fallback];
  const first=colors[0].color;
  const distance=(a,b)=>Math.sqrt(a.reduce((n,v,i)=>n+(v-b[i])**2,0));
  const distinct=colors.filter(c=>distance(c.color,first)>75).sort((a,b)=>b.count*distance(b.color,first)-a.count*distance(a.color,first));
  const second=distinct[0]?.color;
  return [toHex(first),second?toHex(second):mix(first,[255,255,255],.35),mix(first,[255,255,255],.86)];
}
export function resolveStoryPalette(design,config){
  if(design?.paletteSource!=='chapter'&&Array.isArray(design?.palette)&&design.palette.length===3&&design.palette.every(c=>typeof c==='string'&&hex.test(c)))return [...design.palette];
  return [config?.brand?.primary,config?.brand?.accent,config?.brand?.background].map((v,i)=>normalize(v)||defaults[i]);
}
export function renderStoryDesign({campaign,config,assets={},values:v}){
  validateStoryDesign(campaign.storyDesign);
  const treatment=campaign.storyDesign?.background||'template';
  if(treatment==='template'&&!assets.previewMissingDate)return '';
  const [primary,accent,light]=resolveStoryPalette(campaign.storyDesign,config);
  const gridInk=rgb(primary).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0)>145?'#102840':'#ffffff';
  const decorative=treatment==='blueprint-rings'?`<svg class="decoration" viewBox="0 0 1080 1920" fill="none" aria-hidden="true"><g stroke="${gridInk}" opacity=".24" stroke-width="3"><circle cx="1020" cy="650" r="480"/><circle cx="1020" cy="650" r="370" stroke-dasharray="12 18"/><circle cx="0" cy="1690" r="460"/><path d="M0 650H1080M540 0V1920" stroke-dasharray="20 16"/></g></svg>`:'';
  if(v.flyerSource){
    const food=campaign.food?' · Food provided':'';
    return `<!doctype html><html><head><meta charset="utf-8"><style>${v.fontCss||assets.fontCss||''}
*{box-sizing:border-box;margin:0}html,body{width:1080px;height:1920px;overflow:hidden}body{font-family:Inter,Arial,sans-serif;color:#102840;-webkit-font-smoothing:antialiased}.page{position:relative;width:1080px;height:1920px;padding:270px 82px 320px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;background:${primary}}.color-wash{background:radial-gradient(ellipse at 100% 0,${accent},transparent 66%),radial-gradient(ellipse at 0 100%,${light},transparent 72%),${primary}}.blueprint-rings{background:linear-gradient(${gridInk}20 1px,transparent 1px) 0 0/54px 54px,linear-gradient(90deg,${gridInk}20 1px,transparent 1px) 0 0/54px 54px,${primary}}.folded-paper{background:linear-gradient(145deg,transparent 0 46%,${accent} 46% 65%,transparent 65%),linear-gradient(30deg,${light} 0 30%,${primary} 30% 73%,${light} 73%)}.decoration{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.hero{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center}.artwork{width:100%;height:1240px;display:flex;align-items:flex-end;justify-content:center;flex-shrink:0}.story-flyer{display:block;width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain;background:#fff;border-radius:20px 20px 0 0;box-shadow:0 14px 44px #0003}.showcase-caption{width:100%;max-width:100%;background:#fff;border-radius:0 0 20px 20px;padding:22px 28px 24px;color:#102840;border-top:4px solid ${accent};box-shadow:0 14px 44px #0003;overflow-wrap:anywhere}.showcase-caption p{font-size:32px;line-height:1.3}.showcase-caption p+p{margin-top:6px;font-size:30px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style></head><body class="story"><main class="page ${treatment} flyer-showcase">${decorative}<section class="hero"><h1 class="sr-only">${v.title||''}</h1><div class="artwork flyer-card"><img class="story-flyer" src="${v.flyerSource}" alt="Uploaded event flyer"></div><div class="showcase-caption"><p><strong>${v.shortDate||v.date||''} · ${v.time||''}</strong></p><p>${v.location||''}${food}</p></div></section></main></body></html>`;
  }
  // A Story without a photo is finished typographic artwork, not an empty media slot.
  // Tint sampled colors toward navy so text stays readable even with a pale palette.
  const dark=mix(rgb(primary),[8,22,36],.72),wash=mix(rgb(accent),[8,22,36],.65),tint=mix(rgb(light),[8,22,36],.84);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${v.fontCss||assets.fontCss||''}
*{box-sizing:border-box;margin:0}html,body{width:1080px;height:1920px;overflow:hidden}body{font-family:Inter,Arial,sans-serif;-webkit-font-smoothing:antialiased}.page{width:1080px;height:1920px;padding:250px 80px 360px;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;gap:42px;color:#fff7ed;background:${dark};overflow:hidden}.color-wash{background:radial-gradient(ellipse at 100% 0,${wash},transparent 76%),radial-gradient(ellipse at 0 100%,${tint},transparent 90%),${dark}}.blueprint-rings{background:linear-gradient(${gridInk}08 1px,transparent 1px) 0 0/72px 72px,linear-gradient(90deg,${gridInk}08 1px,transparent 1px) 0 0/72px 72px,${dark}}.folded-paper{background:linear-gradient(165deg,${dark} 0 76%,${tint} 76% 100%)}header{display:flex;align-items:center;justify-content:space-between;gap:28px;padding-bottom:28px;border-bottom:4px solid ${accent}}.brand{max-width:64%;font-size:28px;line-height:1.4;font-weight:600;overflow-wrap:anywhere}.tag{font-size:26px;line-height:1.4;text-transform:uppercase;letter-spacing:.08em;max-width:34%;text-align:right;overflow-wrap:anywhere;color:#d7e0e6}.hero{display:flex;flex-direction:column;justify-content:center;min-height:0;padding:20px 0}.title-card{width:100%;max-width:860px;flex-shrink:0}h1{max-width:840px;font:400 144px/1.04 'DM Serif Display',Georgia,serif;letter-spacing:-.035em;overflow-wrap:anywhere}.desc{max-width:830px;font-size:32px;line-height:1.5;margin-top:32px;color:#d7e0e6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.desc:empty{display:none}.advertising{font-size:26px;line-height:1.4;margin-top:24px;overflow-wrap:anywhere;color:#e5ebee}.advertising p+p{margin-top:7px}.block{display:grid;grid-template-columns:1.05fr 1.2fr .65fr;gap:28px;padding-top:30px;border-top:1px solid #ffffff55}.block.nofood{grid-template-columns:1fr 1.2fr}.cell{min-width:0}.cell small{display:block;font-size:26px;font-weight:500;text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px;color:#bdcbd5}.cell b{display:block;font-size:34px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}.cell span{display:block;font-size:30px;line-height:1.35;margin-top:8px}footer{display:flex;justify-content:space-between;gap:28px;font-size:24px;line-height:1.4;color:#bdcbd5}footer span{max-width:50%;overflow-wrap:anywhere}footer span:last-child{text-align:right}
</style></head><body class="story"><main class="page ${treatment} text-story"><header><div class="brand">${v.chapter||''}</div><div class="tag">${v.type||''}</div></header><section class="hero"><div class="title-card"><h1>${v.title||''}</h1><p class="desc">${v.description||''}</p>${v.advertising||''}</div></section><section class="block ${v.foodClass||''}"><div class="cell"><small>When</small><b>${v.shortDate||v.date||''}</b><span>${v.time||''}</span></div><div class="cell"><small>Where</small><b>${v.location||''}</b></div>${v.foodCell||''}</section><footer><span>${v.handle||''}</span><span>${v.school||''}</span></footer></main></body></html>`;
}
