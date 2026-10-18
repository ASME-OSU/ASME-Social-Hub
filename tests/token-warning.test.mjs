import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {writeTokenWarning} from '../scripts/token-warning.mjs';
test('expiry metadata replaces stale warnings and never saves credentials',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'token-status-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const now=new Date('2026-10-17T16:00:00Z'),env={IG_ACCESS_TOKEN:'SECRET_TOKEN',IG_TOKEN_EXPIRES_AT:'2026-10-20T16:00:00Z'};
 let record=await writeTokenWarning({root,env,now});assert.equal(record.status,'warning');assert.equal(record.daysRemaining,3);
 record=await writeTokenWarning({root,env:{...env,IG_TOKEN_EXPIRES_AT:'2026-12-17T16:00:00Z'},now});assert.equal(record.status,'healthy');assert.equal(record.warning,false);
 assert.doesNotMatch(await readFile(path.join(root,'data/token-warning.json'),'utf8'),/SECRET_TOKEN|IG_ACCESS_TOKEN/);
 record=await writeTokenWarning({root,env:{},now});assert.equal(record.status,'unknown');assert.equal(record.warning,false);assert.equal(record.expiresAt,undefined);
 record=await writeTokenWarning({root,env:{...env,IG_TOKEN_EXPIRES_AT:'2026-10-16T16:00:00Z'},now});assert.equal(record.status,'expired');assert.equal(record.warning,true);
});
