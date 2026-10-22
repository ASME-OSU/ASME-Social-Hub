import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Generate an atomic, content-versioned shell for both root and project-path hosting.
export async function writePwa(root=process.cwd()) {
 const docs=resolve(root,'docs');
 const files=['index.html','manifest.webmanifest','config/chapter.json','data/archive-index.json','data/candidates.json'];
 for(const name of await readdir(docs)) if(/\.(?:m?js|css)$/.test(name)&&name!=='sw.js')files.push(name);
 async function walk(dir){for(const entry of await readdir(resolve(docs,dir),{withFileTypes:true})){const name=`${dir}/${entry.name}`;if(entry.isDirectory())await walk(name);else if(/\.(?:png|svg|woff2|html)$/.test(name))files.push(name);}}
 await walk('assets');await walk('templates');files.sort();
 const template=await readFile(new URL('./service-worker.js',import.meta.url),'utf8');
 const hash=createHash('sha256').update(template);
 for(const name of files)hash.update(name).update(await readFile(resolve(docs,name)));
 const worker=template.replace('__VERSION__',hash.digest('hex').slice(0,16)).replace('__FILES__',JSON.stringify(files));
 await writeFile(resolve(docs,'sw.js'),worker);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await writePwa();
