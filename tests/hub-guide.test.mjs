import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenSetupHTML} from '../docs/hub-guide.mjs';
test('PAT guide selects the actual repository and separates saving from dispatcher permissions',()=>{
 const html=tokenSetupHTML({owner:'ASME-OSU',name:'ASME-Social-Hub',branch:'main'});
 for(const text of ['Only select repositories','Selected repositories','ASME-OSU','ASME-Social-Hub','Contents','Actions','Read and write','Pending','Connect &amp; verify'])assert.ok(html.includes(text),text);
 const link=html.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&'),url=new URL(link);assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/settings/personal-access-tokens/new');assert.equal(url.searchParams.get('target_name'),'ASME-OSU');assert.equal(url.searchParams.get('contents'),'write');assert.equal(url.searchParams.get('actions'),'write');assert.equal(url.searchParams.get('expires_in'),'90');assert.equal(url.searchParams.has('workflows'),false);
 assert.match(html,/does not prove write access/);assert.match(html,/Leave other permissions unselected/);
});
test('guide escapes custom repository values and its generated link',()=>{
 const html=tokenSetupHTML({owner:'<script>alert(1)</script>',name:'x" onclick="alert(1)',branch:'<main>'});assert.doesNotMatch(html,/<script>|<main>|<b>x" onclick=/);assert.match(html,/&lt;main&gt;/);
});
