import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const base = resolve('docs');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ics':'text/calendar'};
const server = http.createServer(async (req,res) => {
  try {
    let path = resolve(base, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (path !== base && !path.startsWith(base + sep)) throw new Error('outside root');
    if ((await stat(path)).isDirectory()) path = resolve(path,'index.html');
    const body = await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)] || 'application/octet-stream','Cache-Control':'no-store'}); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const port = Number(process.env.PORT || 4173);
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
