import test from 'node:test';
import assert from 'node:assert/strict';
import {githubRequest,initialAccess,accessAfterResponse,accessLabels} from '../docs/github-access.mjs';
const connection={token:'SECRET-token',repo:{owner:'fixture',name:'hub',branch:'main'}},dispatch='actions/workflows/dispatch.yml/dispatches';
test('read acceptance cannot imply Contents or Actions write, and denial does not revoke unrelated capabilities',()=>{
 let state=accessAfterResponse(initialAccess(),'contents/config/chapter.json','GET',200);assert.deepEqual(state,{read:'accepted',write:'unverified',dispatch:'unverified'});
 state=accessAfterResponse(state,dispatch,'POST',403);assert.deepEqual(state,{read:'accepted',write:'unverified',dispatch:'denied'});
 state=accessAfterResponse(state,'contents/data/campaign.json','PUT',201);assert.equal(state.write,'accepted');assert.equal(state.dispatch,'denied');
 assert.match(accessLabels(state,true).dispatch,/denied/);assert.match(accessLabels(initialAccess(),true).dispatch,/Not checked/);
 state=accessAfterResponse(state,dispatch,'POST',204);assert.match(accessLabels(state,true).dispatch,/request was accepted/);assert.doesNotMatch(accessLabels(state,true).dispatch,/publishing verified|completed/);
});
test('workflow 403 gives permission and approval remedy while discarding untrusted response bodies',async()=>{
 const error=await githubRequest(dispatch,{method:'POST',body:'{}'},connection,async()=>Response.json({message:'SECRET-token malicious <script> body'},{status:403})).catch(error=>error);
 assert.equal(error.status,403);assert.match(error.message,/Actions → Read and write/);assert.match(error.message,/organization approval/);assert.match(error.message,/No dispatcher run was requested/);assert.doesNotMatch(error.message,/SECRET-token|malicious|script/);
});
test('successful workflow dispatch accepts both older 204 and JSON responses without proving completion',async()=>{
 assert.equal(await githubRequest(dispatch,{method:'POST'},connection,async()=>new Response(null,{status:204})),null);
 assert.deepEqual(await githubRequest(dispatch,{method:'POST'},connection,async()=>Response.json({workflow_run_id:42})),{workflow_run_id:42});
});
test('rate limiting is separate from permission denial, and optional missing files stay optional',async()=>{
 const error=await githubRequest(dispatch,{method:'POST'},connection,async()=>Response.json({}, {status:403,headers:{'x-ratelimit-remaining':'0'}})).catch(error=>error);
 assert.equal(error.rateLimited,true);assert.match(error.message,/temporarily limited/);assert.equal(accessAfterResponse(initialAccess(),dispatch,'POST',403,{rateLimited:true}).dispatch,'unverified');
 assert.equal(await githubRequest('contents/missing',{optional:true},connection,async()=>new Response('',{status:404})),null);
});
