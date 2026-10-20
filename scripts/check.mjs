import {readdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {validateConfig,validateCampaign,readCampaigns} from './core.mjs';
validateConfig(JSON.parse(await readFile('config/chapter.json','utf8')));
for(const campaign of await readCampaigns(process.cwd())) validateCampaign(campaign);
for(const name of (await readdir('scripts')).filter(n=>n.endsWith('.mjs'))) execFileSync(process.execPath,['--check',resolve('scripts',name)],{stdio:'inherit'});
for(const name of ['app.js','revision-conflict.mjs','campaign-save.mjs','campaign-delete.mjs','schedule-warning.mjs','instagram-preview.mjs','caption.mjs','groupme-message.mjs','groupme-preview.mjs','schedule-status.mjs','dispatcher-health.mjs','time.mjs','channel-preferences.mjs','flyer-render.mjs','flyer-preview.mjs','social-links.mjs','story-design.mjs','story-controls.mjs','image-policy.mjs','carousel.mjs','flyer-uploads.mjs']) {try {await readFile(resolve('docs',name));execFileSync(process.execPath,['--check',resolve('docs',name)],{stdio:'inherit'});}catch(e){if(e.code!=='ENOENT')throw e;}}
console.log('Configuration, campaign data, and JavaScript syntax passed');
