import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';

function dashboardFixtures(){
 const campaign=(id,day,title,status='pending')=>({id,year:'2026-27',type:'workshop',title,description:'A synthetic campaign for dashboard layout verification.',start:`2026-10-${day}T22:00:00Z`,end:`2026-10-${day}T23:30:00Z`,location:{name:'Scott E100'},food:false,revision:1,campaign:{feed:{enabled:true,daysBefore:7,time:'12:00'},story:{enabled:true,daysBefore:3,time:'12:00'},groupme:{enabled:true,announce:true}},status:{feed:status,story:'pending',groupme:'pending'},results:{feed:{},story:{},groupme:{}},log:[]});
 const campaigns=[campaign('dashboard-fixture-design',23,'Design night'),campaign('dashboard-fixture-social',28,'Engineering social','failed')];
 const events=Array.from({length:24},(_,i)=>{const start=new Date(Date.UTC(2026,9,25+i,22)),end=new Date(+start+5400000);return {uid:`dashboard-calendar-fixture-${i}`,title:i===0?'Quantum fixture workshop':i%3===0?'Design workshop and engineering networking evening':i%3===1?'ASME chapter social':'Industry guest speaker',start:start.toISOString(),end:end.toISOString(),location:{name:i%2?'Location to be confirmed':'Scott Laboratory, engineering collaboration room E100'}};});
 events[1]={...events[1],title:'Veterans Day — all-day fixture',start:'2026-11-11T00:00:00Z',end:'2026-11-12T00:00:00Z',allDay:true};
 return {campaigns,events};
}

async function assertTouchTargets(page){
 const undersized=await page.evaluate(()=>[...document.querySelectorAll('#view-dashboard button,#view-dashboard input,#view-dashboard select,#view-dashboard summary,#view-dashboard [role=button],.header-actions button,.header-left button')].filter(element=>element.getClientRects().length&&!element.disabled).flatMap(element=>{const rect=(element.matches('input[type=checkbox],input[type=radio]')?element.closest('label')||element:element).getBoundingClientRect();return rect.width<43.5||rect.height<43.5?[{name:element.getAttribute('aria-label')||element.textContent.trim().slice(0,70),width:rect.width,height:rect.height}]:[];}));
 assert.deepEqual(undersized,[],'Dashboard controls provide at least 44px touch targets');
}

export async function checkDashboardDesign(browser,base){
 const config=JSON.parse(await readFile('config/chapter.json','utf8'));
 config.showExamples=false;config.integrations={...config.integrations,groupme:{...config.integrations?.groupme,enabled:true,mode:'bot'}};
 const {campaigns,events}=dashboardFixtures(),metrics=[],baseline=process.env.DASHBOARD_BASELINE==='1',output=baseline?'test-results/dashboard-design-before':'test-results/dashboard-design';
 const baselineSources=baseline?Object.fromEntries(['docs/app.js','docs/styles.css','docs/index.html'].map(path=>[path,execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'})])):null;
 await mkdir(output,{recursive:true});
 for(const [width,height]of [[1440,900],[1440,778],[390,844],[320,740]])for(const theme of ['light','dark'])for(const health of ['healthy','stale']){
  const context=await browser.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
  try{
   const page=await context.newPage(),errors=[],requests=[];let listedCampaigns=campaigns;
   await page.clock.install({time:new Date('2026-10-20T16:00:00Z')});page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/config/chapter.json',route=>route.fulfill({json:config}));
   await page.route('**/data/archive-index.json',route=>route.fulfill({json:{campaigns:listedCampaigns}}));
   await page.route('**/data/candidates.json',route=>route.fulfill({json:{events,changes:[]}}));
   await page.route('**/data/dispatcher-health.json',route=>route.fulfill({json:{lastSuccessfulLiveRunAt:health==='healthy'?'2026-10-20T15:55:00Z':'2026-10-20T13:00:00Z'}}));
   await page.route('**/data/token-warning.json',route=>route.fulfill({json:{status:'unknown'}}));
   const image=await readFile('docs/assets/logos/social-hub-512.png');
   await page.route('**/media/2026-27/dashboard-fixture-*.jpg',route=>route.fulfill({contentType:'image/png',body:image}));
   await page.route('https://api.github.com/**',route=>{requests.push(route.request().method());return route.abort();});
   if(baseline){await page.route(`${base}/app.js`,route=>route.fulfill({contentType:'text/javascript',body:baselineSources['docs/app.js']}));await page.route(`${base}/styles.css`,route=>route.fulfill({contentType:'text/css',body:baselineSources['docs/styles.css']}));await page.route(`${base}/`,route=>route.fulfill({contentType:'text/html',body:baselineSources['docs/index.html']}));}
   await page.goto(base);await page.waitForSelector('#campaign-list .campaign-card');
   await page.waitForFunction(expected=>document.querySelector('#dispatcher-warning').hidden===(expected==='healthy'),health);
   if(!baseline&&health==='stale')assert.match(await page.locator('#dispatcher-warning').textContent(),/Connect a repository to run it manually/i);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px ${theme}: no horizontal overflow`);
   if(!baseline){
    await assertTouchTargets(page);
    if(width<700)assert.equal(await page.locator('#view-dashboard #new-campaign').evaluate(element=>getComputedStyle(element).position),'static','Mobile New campaign stays in flow and cannot cover calendar actions');
    if(width===1440){const first=await page.locator('#campaign-list .campaign-card').first().boundingBox();assert.ok(first.y+100<=height,'First campaign is visible within the desktop viewport');}
    const numberSize=await page.locator('#stats .stat strong').first().evaluate(element=>parseFloat(getComputedStyle(element).fontSize));assert.ok(numberSize>=24&&numberSize<=32,`Compact dashboard numbers use 24–32px (${numberSize})`);
   }
   const tag=`${width}-${height}-${theme}-${health}`;
   await page.screenshot({path:`${output}/${tag}-overview.png`});
   // Calendar checks remain independent of live calendar records and campaign contents.
   let calendarTextWidth=null;
   const firstRow=page.locator('#suggestions .suggestion').first();
   if(await firstRow.count()){
    await firstRow.scrollIntoViewIfNeeded();
    const column=await firstRow.evaluate(row=>{const title=row.querySelector('strong,h3');const element=title?.closest('.suggestion-content,.suggestion-main')||title?.parentElement;return element?element.getBoundingClientRect().width:0;});
    calendarTextWidth=column;
    if(!baseline)assert.ok(column>=150,`${width}px calendar text column is at least 150px (${column})`);
    await page.screenshot({path:`${output}/${tag}-calendar.png`});
   }
   if(!baseline){
    const rows=page.locator('#suggestions .calendar-suggestion-list .suggestion'),more=page.locator('.calendar-suggestions-more'),filter=page.getByLabel('Filter calendar suggestions');
    assert.equal(await rows.count(),5,'Calendar starts with only the next five timed events');
    assert.match(await page.locator('#suggestions p[role=status]').textContent(),/1 all-day date is available/);
    assert.equal(await more.getAttribute('aria-expanded'),'false');
    await more.focus();await page.keyboard.press('Enter');assert.equal(await rows.count(),23);assert.equal(await more.getAttribute('aria-expanded'),'true');
    if(width<700){
     await filter.scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${tag}-calendar-expanded.png`});
     await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
     const lastAction=await rows.last().locator('[data-suggest]').boundingBox(),showFewer=await more.boundingBox(),bottomNav=await page.locator('aside nav').boundingBox();
     assert.ok(lastAction.y+lastAction.height<=bottomNav.y-8,'Last calendar action remains above the mobile navigation');assert.ok(showFewer.y+showFewer.height<=bottomNav.y-8,'Show fewer remains above the mobile navigation and safe-area clearance');
     await page.screenshot({path:`${output}/${tag}-calendar-bottom.png`});
    }
    await more.focus();

    await page.keyboard.press('Enter');assert.equal(await rows.count(),5);assert.equal(await more.getAttribute('aria-expanded'),'false');
    await filter.focus();assert.equal(await filter.evaluate(element=>document.activeElement===element),true,'Calendar filter is keyboard focusable');await page.keyboard.press('Tab');assert.equal(await filter.evaluate(element=>document.activeElement===element),false,'Keyboard can leave the calendar filter');await filter.selectOption('all-day');
    assert.equal(await filter.inputValue(),'all-day','Calendar filter changes the visible category');assert.equal(await rows.count(),1);
    assert.equal(await rows.locator('time').getAttribute('datetime'),'2026-11-11');assert.equal(await rows.locator('time').textContent(),'Nov 11, 2026 · All day');
    assert.match(await rows.locator('.date-box').textContent(),/^11/);assert.doesNotMatch(await rows.locator('time').textContent(),/AM|PM|Nov 10/);
    if(width<700){await filter.scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${tag}-calendar-all-day.png`});}
    await rows.locator('[data-suggest]').click();await page.waitForFunction(()=>document.querySelector('#editor').open);
    assert.equal(await page.locator('[name=start]').inputValue(),'');assert.equal(await page.locator('[name=end]').inputValue(),'');
    assert.match(await page.locator('#calendar-date-note').textContent(),/Nov 11, 2026/);
    await page.locator('[data-close=editor]').first().click();
    await filter.selectOption('timed');assert.equal(await filter.inputValue(),'timed');assert.equal(await rows.count(),5);
    const summary=page.locator('#dispatcher-controls > summary');assert.equal(await page.locator('#dispatcher-controls').evaluate(element=>element.open),false);
    await summary.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#dispatcher-preview').isVisible(),true);await page.keyboard.press('Enter');assert.equal(await page.locator('#dispatcher-preview').isVisible(),false);
    if(width===1440&&height===900&&theme==='light'&&health==='healthy')await page.locator('#stats').screenshot({path:`${output}/1440-900-light-healthy-stats.png`});
   }
   metrics.push(await page.evaluate(({width,height,theme,health,calendarTextWidth})=>{const campaign=document.querySelector('#campaign-list .campaign-card'),dispatcher=document.querySelector('.dispatcher-health'),stats=document.querySelector('#stats'),suggestions=document.querySelector('#suggestions');const heightOf=element=>element?.getBoundingClientRect().height||0;return {width,height,theme,health,calendarTextWidth,pageHeight:document.documentElement.scrollHeight,campaignTop:campaign?campaign.getBoundingClientRect().top+scrollY:null,dispatcherHeight:heightOf(dispatcher),statsHeight:heightOf(stats),suggestionRows:suggestions?.querySelectorAll('.suggestion').length||0,calendarHeight:heightOf(suggestions)};},{width,height,theme,health,calendarTextWidth}));
   await writeFile(`${output}/metrics.json`,JSON.stringify(metrics,null,2));
   assert.deepEqual(errors,[]);assert.deepEqual(requests,[],'Dashboard inspection must not request GitHub writes or dispatches');
   if(!baseline&&width===1440&&height===778&&theme==='light'&&health==='healthy'){
    const denied=[];await page.unroute('https://api.github.com/**');
    await page.route('https://api.github.com/**',route=>{const request=route.request();if(request.method()==='POST'){denied.push(JSON.parse(request.postData()));return route.fulfill({status:403,json:{message:'Synthetic denied Actions scope'}});}if(request.url().includes('config/chapter.json'))return route.fulfill({json:{sha:'synthetic-config',content:Buffer.from(JSON.stringify(config)).toString('base64')}});if(request.url().includes('dispatcher-health.json'))return route.fulfill({json:{sha:'synthetic-health',content:Buffer.from(JSON.stringify({lastSuccessfulLiveRunAt:'2026-10-20T15:55:00Z'})).toString('base64')}});return route.fulfill({status:404,json:{message:'Synthetic fixture only'}});});
    listedCampaigns=[{...campaigns[0],allDay:true}];await page.reload();await page.waitForSelector('#campaign-list .campaign-card');assert.equal(await page.locator('#campaign-list .campaign-card').count(),1);
    await page.locator('[data-view=settings]').click();await page.locator('[name=token]').fill('mock-dashboard-token-not-a-credential');await page.locator('#settings-form button.primary').click();await page.waitForFunction(()=>document.querySelector('#connection-label').textContent==='Connected');
    await page.locator('[data-view=dashboard]').click();assert.equal(await page.locator('#notice').evaluate(element=>element.classList.contains('visible')),false,'A successful connection does not leave a persistent dashboard notice');const connectedTitle=await page.locator('#campaign-list .campaign-card h3').first().boundingBox();assert.ok(connectedTitle.y+connectedTitle.height<=height,'First campaign title is visible on the connected desktop dashboard');metrics.at(-1).connectedTitleBottom=connectedTitle.y+connectedTitle.height;metrics.at(-1).connectedCampaignCount=1;await page.screenshot({path:`${output}/1440-778-light-connected-overview.png`});
    await page.locator('#campaign-list [data-detail]').first().click();await page.locator('[data-edit]').click();
    assert.equal(await page.locator('[name=start]').inputValue(),'2026-10-23T18:00','Existing allDay campaigns preserve actual edited start time');assert.equal(await page.locator('[name=end]').inputValue(),'2026-10-23T19:30');assert.equal(await page.locator('#calendar-date-note').isVisible(),false);await page.locator('[data-close=editor]').first().click();
    await page.locator('#dispatcher-controls > summary').click();await page.locator('#dispatcher-preview').click();
    await page.waitForFunction(()=>!document.querySelector('#dispatcher-control-status').hidden&&document.querySelector('#dispatcher-control-status').textContent.includes('403'));
    const deniedCopy=await page.locator('#dispatcher-control-status').textContent();assert.match(deniedCopy,/Manual preview request was denied \(GitHub 403\)/);assert.match(deniedCopy,/Actions write/i);assert.match(deniedCopy,/last successful live dispatcher run/i);assert.equal(await page.locator('#dispatcher-control-status').getAttribute('role'),'alert');
    assert.equal(await page.locator('#sidebar-dot').evaluate(element=>element.classList.contains('limited')),true);assert.match(await page.locator('#connection-label').textContent(),/Actions access limited/);assert.match(await page.locator('#header-connection-text').textContent(),/limited/);
    const dotColors=await page.locator('#sidebar-dot').evaluate(element=>{const reference=document.createElement('span');reference.style.background='var(--signal)';reference.hidden=true;document.body.append(reference);const expected=getComputedStyle(reference).backgroundColor;reference.remove();return {actual:getComputedStyle(element).backgroundColor,expected};});assert.equal(dotColors.actual,dotColors.expected,'Limited sidebar dot is amber');
    const scheduledRun=await page.locator('#dispatcher-last-run').textContent();assert.match(scheduledRun,/11:55 AM/);

    await page.locator('#dispatcher-controls > summary').click();assert.equal(await page.locator('#dispatcher-control-status').isVisible(),true,'Denied request stays visible outside collapsed controls');
    assert.deepEqual(denied,[{ref:'main',inputs:{dry_run:true}}]);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));assert.equal(await page.evaluate(()=>scrollY),0);await page.screenshot({path:`${output}/1440-778-light-preview-denied.png`});
    await page.locator('#dispatcher-controls > summary').click();page.once('dialog',dialog=>dialog.dismiss());await page.locator('#dispatcher-live').click();assert.equal(denied.length,1);
    page.once('dialog',dialog=>dialog.accept());await page.locator('#dispatcher-live').click();await page.waitForFunction(()=>document.querySelector('#dispatcher-control-status').textContent.includes('Manual live request was denied'));
    assert.deepEqual(denied[1],{ref:'main',inputs:{dry_run:false}});assert.equal(await page.locator('#dispatcher-last-run').textContent(),scheduledRun,'Manual denial does not change the recorded scheduled run');
    await page.locator('#dispatcher-controls > summary').click();await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));assert.equal(await page.evaluate(()=>scrollY),0);await page.screenshot({path:`${output}/1440-778-light-live-denied.png`});assert.deepEqual(errors,[]);

   }

  }finally{await context.close();}
 }
 await writeFile(`${output}/metrics.json`,JSON.stringify(metrics,null,2));
 console.log(baseline?'Dashboard baseline captured with frozen committed sources and synthetic data; layout measurements are diagnostic.':'Dashboard design checks passed: synthetic campaigns/calendar, light/dark desktop and phones, healthy/stale dispatcher, no overflow, readable calendar columns, and 44px controls.');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {chromium}=await import('playwright'),port=4291,base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
 try{for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}browser=await chromium.launch({headless:true});await checkDashboardDesign(browser,base);}finally{if(browser)await browser.close();server.kill();}
}
