import assert from 'node:assert/strict';

async function checkContrast(page,selectors){
 const rows=await page.evaluate(selectors=>{
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});canvas.width=canvas.height=1;
  const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};
  const over=(fg,bg)=>fg.slice(0,3).map((value,i)=>value*fg[3]+bg[i]*(1-fg[3])).concat(1);
  const luminance=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((total,v,i)=>total+v*[.2126,.7152,.0722][i],0);
  return selectors.map(selector=>{const element=[...document.querySelectorAll(selector)].find(el=>el.checkVisibility());if(!element)return {selector,missing:true};const ancestors=[];for(let e=element;e;e=e.parentElement)ancestors.unshift(e);const bg=ancestors.reduce((color,e)=>over(rgba(getComputedStyle(e).backgroundColor),color),[255,255,255,1]),fg=over(rgba(getComputedStyle(element).color),bg),values=[luminance(fg),luminance(bg)].sort((a,b)=>b-a);return {selector,ratio:(values[0]+.05)/(values[1]+.05)};});
 },selectors);
 for(const row of rows){assert.ok(!row.missing,`Contrast target missing: ${row.selector}`);assert.ok(row.ratio>=4.5,`${row.selector}: text contrast ${row.ratio.toFixed(2)} must meet 4.5:1`);}
}
export async function checkThemes(browser,base){
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',colorScheme:theme});
  try{
   const page=await context.newPage();await page.route('**/config/chapter.json',async route=>{const response=await route.fetch(),config=await response.json();await route.fulfill({json:{...config,showExamples:true,socialLinks:{...config.socialLinks,facebook:'https://www.facebook.com/chapter-test-fixture/',linktree:'https://linktr.ee/chapter-test-fixture'}}});});
   await page.goto(base);await page.locator('.campaign-card').first().waitFor();
   assert.equal(await page.locator('#connection-label').textContent(),'Not connected');assert.equal(await page.locator('#header-connection-text').textContent(),'Not connected');assert.equal(await page.locator('.sidebar-foot').textContent().then(text=>/Plan once|Ohio State University/.test(text)),false);assert.equal(await page.locator('.workspace>footer').textContent().then(text=>text.trim()),'');
   assert.equal(await page.locator('.social-brand-facebook').first().getAttribute('fill'),'currentColor');
   assert.equal(await page.locator('nav .nav-icon svg').count(),3);
   assert.equal(await page.locator('.sidebar-social a').count(),4);
   for(const label of ['Instagram','LinkedIn','Facebook','Linktree']){const link=page.locator('.sidebar-social').getByRole('link',{name:label+' (opens in a new tab)',exact:true});assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('rel'),/noopener/);assert.ok(await link.locator('svg,img').count()>0);for(const image of await link.locator('img').all())assert.ok(await image.evaluate(async img=>{await img.decode();return img.naturalWidth>0;}),'Brand image must load');}
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),theme,'System theme should control native fields');
   assert.equal(await page.locator('#sidebar').evaluate(e=>e.getBoundingClientRect().width),240);
   await checkContrast(page,['h1','.subtle','.stat-label','.stat small','.campaign-card h3','.campaign-card .card-info','.card-footer button','#new-campaign','nav button.active']);
   await page.locator('#header-sidebar-toggle').click();await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().width===72);await page.reload();await page.locator('.campaign-card').first().waitFor();assert.equal(await page.locator('#header-sidebar-toggle').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('.sidebar-social').isVisible(),true);
   await page.locator('#header-sidebar-toggle').click();await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().width===240);
   await page.locator('[data-view=settings]').click();await checkContrast(page,['#settings-form h2','#settings-form label','#settings-connection-state','#settings-form input[name=owner]','#channel-defaults-form .subtle','#channel-defaults-form button.primary']);
   await page.locator('[data-view=dashboard]').click();await page.locator('#new-campaign').click();await checkContrast(page,['#editor-title','#editor .field-help','#editor input[name=title]','#editor .food-segments .yes','#editor .channel-switch .switch-on','#save-button']);await page.locator('[data-close=editor]').first().click();
   // Explicit overrides must win even when the system requests the opposite palette.
   await page.locator('#theme-toggle').click();assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),theme==='dark'?'light':'dark');await page.reload();await page.locator('.campaign-card').first().waitFor();assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),theme==='dark'?'light':'dark');
   await page.setViewportSize({width:900,height:1000});await page.locator('#header-sidebar-toggle').click();await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().width===72);assert.equal(await page.locator('#header-sidebar-toggle').getAttribute('aria-expanded'),'false');await page.locator('#header-sidebar-toggle').click();await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().width===240);assert.equal(await page.locator('nav button span:not(.nav-icon)').first().isVisible(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Expanded tablet layout must fit');
   await page.setViewportSize({width:700,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Expanded narrow tablet layout must fit');
   await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('.mobile-social-menu summary').click();assert.equal(await page.locator('.header-social a').count(),4);assert.equal(await page.locator('.header-social').isVisible(),true);await page.locator('.mobile-social-menu summary').click();
   assert.equal(await page.locator('.footer-social a').count(),4);assert.equal(await page.locator('.footer-social').isVisible(),true);assert.equal(await page.locator('.sidebar-social').isVisible(),false);
   assert.equal(await page.locator('.sidebar-header').isVisible(),false);assert.equal(await page.locator('#header-sidebar-toggle').isVisible(),false);
   for(const button of await page.locator('nav button').all()){assert.ok(await button.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Every mobile navigation button must stay inside the visible bottom bar');}
  }finally{await context.close();}
 }
 // With no saved desktop choice, tablets start in a rail that can actually expand.
 const page=await browser.newPage({viewport:{width:900,height:1000}});try{await page.goto(base);await page.locator('#new-campaign:not([disabled])').waitFor();assert.equal(await page.locator('#header-sidebar-toggle').getAttribute('aria-expanded'),'false');await page.locator('#header-sidebar-toggle').click();await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().width===240);assert.equal(await page.locator('#header-sidebar-toggle').getAttribute('aria-expanded'),'true');}finally{await page.close();}
 console.log('Theme checks passed: text contrast, system and saved themes, desktop/tablet collapse, and mobile bottom navigation.');
}
