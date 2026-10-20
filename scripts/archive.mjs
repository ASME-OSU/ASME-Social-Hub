import path from 'node:path';
import {readFile} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readCampaigns, writeJson } from './core.mjs';
export async function buildArchive(root=process.cwd()) {
  const campaigns=(await readCampaigns(root)).filter(c=>!c.deletedAt).sort((a,b)=>Date.parse(b.start)-Date.parse(a.start));
  const previous=await readFile(path.join(root,'data/archive-index.json'),'utf8').then(JSON.parse).catch(()=>null);
  if(previous && JSON.stringify(previous.campaigns)===JSON.stringify(campaigns)) return previous;
  const index={generatedAt:new Date().toISOString(),campaigns};
  await writeJson(path.join(root,'data/archive-index.json'),index); return index;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) buildArchive().catch(e=>{console.error(e.message);process.exitCode=1;});
