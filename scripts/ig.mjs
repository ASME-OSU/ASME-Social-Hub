import {MAX_FEED_IMAGES,matchingFeedIssue} from '../docs/carousel.mjs';
import {feedImageIssue,jpegDimensions} from '../docs/image-policy.mjs';
// Instagram Login API. Credentials never appear in URLs or diagnostic messages.
export async function safeJson(response, service) {
  let body; try { body = await response.json(); } catch { throw new Error(`${service}: invalid JSON (HTTP ${response.status})`); }
  if (!response.ok || body.error) {
    const error = new Error(`${service}: request rejected (HTTP ${response.status}; code ${Number(body.error?.code) || 'unknown'})`);
    error.retrySafe = response.status >= 400 && response.status < 500;
    throw error;
  }
  return body;
}
export function createInstagramClient({env = process.env, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms))} = {}) {
  const version = env.IG_API_VERSION || 'v25.0';
  if (!/^v\d+\.\d+$/.test(version)) throw new Error('IG_API_VERSION must look like v25.0');
  const base = `https://graph.instagram.com/${version}`;
  const request = async (resource, {method = 'GET', fields} = {}) => {
    if (!env.IG_ACCESS_TOKEN || !env.IG_USER_ID) throw new Error('Instagram requires IG_ACCESS_TOKEN and IG_USER_ID');
    const url = new URL(`${base}/${resource}`);
    const options = {method, headers: {Authorization: `Bearer ${env.IG_ACCESS_TOKEN}`}, signal: AbortSignal.timeout(30000)};
    if (fields && method === 'GET') for (const [k,v] of Object.entries(fields)) url.searchParams.set(k,v);
    else if (fields) options.body = new URLSearchParams(fields);
    let response; try { response = await fetchImpl(url, options); } catch { throw new Error('Instagram: network request failed; reconcile before retrying writes'); }
    return safeJson(response, 'Instagram');
  };
  const waitForContainer=async id=>{
      for (let i=0;i<30;i++) {
        const result = await request(encodeURIComponent(id), {fields:{fields:'status_code'}});
        if (result.status_code === 'FINISHED') return;
        if (['ERROR','EXPIRED'].includes(result.status_code)) throw new Error(`Instagram container ${result.status_code.toLowerCase()}`);
        await sleep(2000);
      }
      throw new Error('Instagram container processing timed out');
    };
  return {
    request,
    async checkPublishingLimit() {
      const result = await request(`${env.IG_USER_ID}/content_publishing_limit`, {fields:{fields:'config,quota_usage'}});
      const limit = result.data?.[0];
      if (limit && limit.quota_usage >= (limit.config?.quota_total ?? Infinity)) throw new Error('Instagram publishing quota exhausted');
      return result;
    },
    async createContainer({channel,imageUrl,imageUrls,caption}) {
      if(!['feed','story'].includes(channel))throw Error('Invalid Instagram channel');
      const sources=channel==='feed'&&imageUrls?.length?imageUrls:[imageUrl];
      if(!Array.isArray(sources)||sources.length<1||sources.length>MAX_FEED_IMAGES)throw Error('Use between 1 and 10 feed images.');
      const sizes=[];
      for(const source of sources){
      const url = new URL(source); if (url.protocol !== 'https:') throw new Error('Instagram image must be a public HTTPS URL');
      let response; try { response = await fetchImpl(url, {signal:AbortSignal.timeout(30000)}); } catch { throw new Error('Public flyer is unreachable'); }
      if (!response.ok || !/^image\/jpeg\b/i.test(response.headers.get('content-type') || '')) throw new Error('Public flyer must return HTTP success and image/jpeg');
      const reader=response.body?.getReader();if(!reader)throw Error('Public flyer could not be read');
      const chunks=[];let size=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>=8*1024*1024){await reader.cancel();throw Error('Public flyer must be smaller than 8 MB');}chunks.push(value);}}finally{reader.releaseLock();}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const dimensions=jpegDimensions(bytes);if(!dimensions)throw Error('Public flyer must contain a readable JPEG image');
      if(channel==='feed'){const issue=feedImageIssue(dimensions.width,dimensions.height);if(issue)throw Error(issue);}
      sizes.push(dimensions);
      }
      const issue=channel==='feed'?matchingFeedIssue(sizes):'';if(issue)throw Error(issue);
      if(sources.length>1){
        const children=[];
        for(const source of sources){const child=await request(`${env.IG_USER_ID}/media`,{method:'POST',fields:{image_url:source,is_carousel_item:'true'}});if(!child.id)throw Error('Instagram carousel item response missing ID');await waitForContainer(String(child.id));children.push(String(child.id));}
        const parent=await request(`${env.IG_USER_ID}/media`,{method:'POST',fields:{media_type:'CAROUSEL',children:children.join(','),caption:caption||''}});if(!parent.id)throw Error('Instagram carousel response missing ID');return String(parent.id);
      }
      const body=await request(`${env.IG_USER_ID}/media`,{method:'POST',fields:{image_url:sources[0],...(channel==='story'?{media_type:'STORIES'}:{caption:caption||''})}});if(!body.id)throw Error('Instagram container response missing ID');return String(body.id);
    },
    waitForContainer,
    async publishContainer(id) {
      const body = await request(`${env.IG_USER_ID}/media_publish`, {method:'POST',fields:{creation_id:id}});
      if (!body.id) throw new Error('Instagram publish response missing ID; reconcile before retrying');
      return String(body.id);
    },
    getMedia(id) { return request(encodeURIComponent(id), {fields:{fields:'id,permalink'}}); }
  };
}
