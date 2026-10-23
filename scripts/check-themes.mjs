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
   assert.equal(await page.locator('#connection-label').textContent(),'Not connected');assert.equal(await page.locator('#header-connection-text').textContent(),'Not connected');assert.equal(await page.locator('.sidebar-foot').textContent().then(text=>/Plan once|Ohio State University/.test(text)),false);assert.equal(await page.locator('.workspace>footer').textContent().then(text=>text.trim()),'ASME Hub');
   assert.equal(await page.locator('.social-brand-facebook').first().getAttribute('fill'),'currentColor');
   assert.equal(await page.locator('nav .nav-icon svg').count(),3);
   assert.equal(await page.locator('.sidebar-social a').count(),5);
   const hub=page.locator('.sidebar-social .asme-hub-shortcut');assert.equal(await hub.getAttribute('href'),'https://asme-osu.github.io/ASME-HUB/');assert.equal(await hub.getAttribute('target'),null,'Hub shortcut navigates directly');assert.equal(await page.locator('.sidebar-social').evaluate(e=>e.firstElementChild.classList.contains('asme-hub-shortcut')),true,'Hub shortcut precedes every social profile');await hub.locator('img').evaluate(image=>image.decode());
   for(const label of ['Instagram','LinkedIn','Facebook','Linktree']){const link=page.locator('.sidebar-social').getByRole('link',{name:label+' (opens in a new tab)',exact:true});assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('rel'),/noopener/);assert.ok(await link.locator('svg,img').count()>0);for(const image of await link.locator('img').all())assert.ok(await image.evaluate(async img=>{await img.decode();return img.naturalWidth>0;}),'Brand image must load');}
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),theme,'System theme should control native fields');
   // Device appearance must update live; users can explicitly return to automatic mode.
   assert.equal(await page.locator('#appearance-theme').inputValue(),'system');
   await page.emulateMedia({colorScheme:theme==='dark'?'light':'dark'});
   await page.waitForFunction(dark=>document.querySelector('#theme-toggle').getAttribute('aria-label')===(dark?'Switch to light theme':'Switch to dark theme'),theme==='light');
   assert.equal(await page.locator('#theme-toggle-icon svg').count(),1);
   await page.emulateMedia({colorScheme:theme});
   await page.waitForFunction(dark=>document.querySelector('#theme-toggle').getAttribute('aria-label')===(dark?'Switch to light theme':'Switch to dark theme'),theme==='dark');
   assert.equal(await page.locator('#sidebar').evaluate(e=>e.getBoundingClientRect().width),240);
   const expandedDivider=await page.locator('.sidebar-social .hub-shortcut-divider').boundingBox();assert.ok(expandedDivider.width>expandedDivider.height,'Expanded Hub divider is horizontal');
   await checkContrast(page,['#sidebar .sidebar-label','#sidebar .asme-hub-shortcut','#sidebar nav button.active']);
   await checkContrast(page,['h1','.subtle','.stat-label','.stat small','.campaign-card h3','.campaign-card .card-info','.card-footer button','#new-campaign','nav button.active']);
   await page.locator('#header-sidebar-toggle').click();await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().width===72);await page.reload();await page.locator('.campaign-card').first().waitFor();assert.equal(await page.locator('#header-sidebar-toggle').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('.sidebar-social').isVisible(),true);const railDivider=await page.locator('.sidebar-social .hub-shortcut-divider').boundingBox();assert.ok(railDivider.width>railDivider.height,'Collapsed Hub divider stays horizontal');
   await page.locator('#header-sidebar-toggle').click();await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().width===240);
   await page.locator('[data-view=settings]').click();await checkContrast(page,['#appearance-heading','#appearance-theme','#appearance-theme+.field-help','#settings-form h2','#settings-form label','#settings-connection-state','#settings-form input[name=owner]','#channel-defaults-form .subtle','#channel-defaults-form button.primary']);
   await page.locator('[data-view=dashboard]').click();await page.locator('#new-campaign').click();await checkContrast(page,['#editor-title','#editor .field-help','#editor input[name=title]','#editor .food-segments .yes','#editor .channel-switch .switch-on','#save-button']);await page.locator('[data-close=editor]').first().click();
   // Explicit overrides must win even when the system requests the opposite palette.
   await page.locator('#theme-toggle').click();assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),theme==='dark'?'light':'dark');await page.reload();await page.locator('.campaign-card').first().waitFor();assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),theme==='dark'?'light':'dark');
   await page.setViewportSize({width:900,height:1000});await page.locator('#header-sidebar-toggle').click();await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().width===72);assert.equal(await page.locator('#header-sidebar-toggle').getAttribute('aria-expanded'),'false');await page.locator('#header-sidebar-toggle').click();await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().width===240);assert.equal(await page.locator('nav button span:not(.nav-icon)').first().isVisible(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Expanded tablet layout must fit');
   await page.setViewportSize({width:700,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Expanded narrow tablet layout must fit');
   await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('.mobile-social-menu summary').click();assert.equal(await page.locator('.header-social a').count(),5);assert.equal(await page.locator('.header-social').isVisible(),true);await page.locator('.mobile-social-menu summary').click();
   for(const width of [320,344,360,390,690]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Header must fit ${width}px`);
    for(const selector of ['#theme-toggle','.mobile-social-menu summary']){
     const rect=await page.locator(selector).boundingBox();assert.equal(rect.width,44);assert.equal(rect.height,44);assert.ok(rect.x>=0&&rect.x+rect.width<=width);
    }
    for(const selector of ['#theme-toggle-icon svg','.mobile-social-menu summary svg']){
     const box=await page.locator(selector).boundingBox();assert.equal(box.width,20);assert.equal(box.height,20);
     assert.ok(await page.locator(selector).evaluate(svg=>{const b=svg.getBBox();return b.x>=1&&b.y>=1&&b.x+b.width<=23&&b.y+b.height<=23;}),'Icon strokes must fit the view box');
    }
    await page.locator('.mobile-social-menu summary').click();
    const menu=await page.locator('.header-social').boundingBox();assert.ok(menu.x>=0&&menu.x+menu.width<=width,'Social menu must fit phone viewport');
    await page.locator('.mobile-social-menu summary').click();
   }
   await page.setViewportSize({width:390,height:844});
   await page.locator('[data-view=settings]').click();
   await page.locator('#appearance-theme').selectOption('system');
   await page.emulateMedia({colorScheme:'dark'});
   await page.waitForFunction(()=>document.querySelector('#theme-toggle').getAttribute('aria-label')==='Switch to light theme');
   assert.equal(await page.evaluate(()=>localStorage.getItem('social-hub-theme')),null);
   await page.locator('#appearance-theme').selectOption('light');
   await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
   await page.locator('[data-view=dashboard]').click();
   assert.equal(await page.locator('.footer-social a').count(),5);assert.equal(await page.locator('.footer-social').isVisible(),true);assert.equal(await page.locator('.sidebar-social').isVisible(),false);
   assert.equal(await page.locator('.sidebar-header').isVisible(),false);assert.equal(await page.locator('#header-sidebar-toggle').isVisible(),false);
   for(const button of await page.locator('nav button').all()){assert.ok(await button.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Every mobile navigation button must stay inside the visible bottom bar');}
  }finally{await context.close();}
 }
 // With no saved desktop choice, tablets start in a rail that can actually expand.
 const page=await browser.newPage({viewport:{width:900,height:1000}});try{await page.goto(base);await page.locator('#new-campaign:not([disabled])').waitFor();assert.equal(await page.locator('#header-sidebar-toggle').getAttribute('aria-expanded'),'false');await page.locator('#header-sidebar-toggle').click();await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().width===240);assert.equal(await page.locator('#header-sidebar-toggle').getAttribute('aria-expanded'),'true');}finally{await page.close();}
 console.log('Theme checks passed: text contrast, system and saved themes, desktop/tablet collapse, and mobile bottom navigation.');
}
