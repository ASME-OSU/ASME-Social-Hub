import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const exec=promisify(execFile);
export async function gitCheckpoint({root,file,campaign}) {
  const relative=path.relative(root,file);
  if(relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Checkpoint file is outside repository');
  const git=(...args)=>exec('git',args,{cwd:root,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
  await git('add','--',relative);
  const {stdout}=await git('diff','--cached','--name-only','--',relative);
  if(stdout.trim()) await git('commit','-m',`Checkpoint campaign ${campaign.id}`,'--',relative);
  // A successful push is required even for a no-op checkpoint: an earlier local
  // commit might not have reached the remote yet.
  await git('push','origin','HEAD');
}
