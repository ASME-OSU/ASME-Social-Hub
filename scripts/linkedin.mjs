import {linkedinCommentary,linkedinPostUrl} from '../docs/linkedin.mjs';
const imageUrn=value=>/^urn:li:image:[A-Za-z0-9_-]+$/.test(value||'');
const organizationUrn=value=>/^\d+$/.test(String(value||''))?`urn:li:organization:${value}`:value;
export function linkedinReadiness(env=process.env,now=new Date()){
 if(!env.LINKEDIN_ACCESS_TOKEN)throw Error('Set LINKEDIN_ACCESS_TOKEN from the approved Community Management app');
 const owner=organizationUrn(env.LINKEDIN_ORGANIZATION_URN||env.LINKEDIN_ORGANIZATION_ID);
 if(!/^urn:li:organization:\d+$/.test(owner||''))throw Error('Set LINKEDIN_ORGANIZATION_URN or LINKEDIN_ORGANIZATION_ID to the chapter Page');
 const expiry=Date.parse(env.LINKEDIN_TOKEN_EXPIRES_AT);
 if(!Number.isFinite(expiry)||expiry<=+new Date(now))throw Error('Set a future LINKEDIN_TOKEN_EXPIRES_AT and renew the LinkedIn authorization');
 const version=env.LINKEDIN_API_VERSION||'202610';
 if(!/^20\d{2}(0[1-9]|1[0-2])$/.test(version))throw Error('Invalid LINKEDIN_API_VERSION');
 return {owner,version,expiresAt:new Date(expiry).toISOString()};
}
export function createLinkedInClient({env=process.env,fetchImpl=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const ready=()=>linkedinReadiness(env);
 const send=async(url,options)=>{try{return await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw Error('LinkedIn request did not complete; inspect the Page before retrying a publication');}};
 const request=async(resource,{method='GET',body}={})=>{
  const {version}=ready();
  const response=await send(`https://api.linkedin.com/rest/${resource}`,{method,headers:{Authorization:`Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,'LinkedIn-Version':version,'X-Restli-Protocol-Version':'2.0.0','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok){const error=Error(`LinkedIn request rejected (HTTP ${response.status})`);error.retrySafe=[400,401,403,404,422,429].includes(response.status);throw error;}
  return response;
 };
 return {
  checkReady:ready,
  async verifyCredentials(){const {owner}=ready();return (await request(`organizations/${owner.split(':').at(-1)}`)).json();},
  // Retain the earlier server-side entrypoint for integrations using a single
  // image or a text-only post. The campaign scheduler uses separate preparation
  // and publication methods so it can persist progress before creating a post.
  async publishPost({commentary,imageUrl,organizationId}){
   const client=createLinkedInClient({env:{...env,...(organizationId?{LINKEDIN_ORGANIZATION_URN:organizationUrn(organizationId)}:{})},fetchImpl,sleep});
   const imageUrns=[];if(imageUrl){const id=await client.uploadImage(imageUrl);await client.waitForImage(id);imageUrns.push(id);}
   return client.publish({caption:commentary,imageUrns,title:'Event flyer'});
  },
  async uploadImage(imageUrl){
   const {owner}=ready(),source=new URL(imageUrl);
   if(source.protocol!=='https:'||source.username||source.password)throw Error('LinkedIn flyer requires public HTTPS');
   let response;try{response=await fetchImpl(source,{signal:AbortSignal.timeout(30000)});}catch{throw Error('LinkedIn flyer could not be downloaded');}
   if(!response.ok||!/^image\/jpeg\b/i.test(response.headers.get('content-type')||''))throw Error('LinkedIn flyer must return image/jpeg');
   const reader=response.body?.getReader();if(!reader)throw Error('LinkedIn flyer is empty');
   const chunks=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>=8*1024*1024){await reader.cancel();throw Error('LinkedIn flyer must be smaller than 8 MB');}chunks.push(value);}}finally{reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('LinkedIn flyer is not a JPEG');
   const init=await (await request('images?action=initializeUpload',{method:'POST',body:{initializeUploadRequest:{owner}}})).json();
   let upload;try{upload=new URL(init.value?.uploadUrl);}catch{throw Error('LinkedIn upload URL missing');}
   if(upload.protocol!=='https:'||upload.username||upload.password||!/(^|\.)(linkedin\.com|licdn\.com)$/.test(upload.hostname)||!imageUrn(init.value?.image))throw Error('LinkedIn upload response is invalid');
   const uploaded=await send(upload,{method:'PUT',headers:{Authorization:`Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,'Content-Type':'image/jpeg'},body:bytes});
   if(!uploaded.ok)throw Error('LinkedIn image upload failed');
   return init.value.image;
  },
  async waitForImage(id){
   if(!imageUrn(id))throw Error('Invalid LinkedIn image identifier');
   let status;
   for(let i=0;i<30;i++){
    const image=await (await request(`images/${encodeURIComponent(id)}`)).json();
    status=image.status;
    if(image.status==='AVAILABLE')return;
    if(image.status==='PROCESSING_FAILED'){const error=Error('LinkedIn image upload needs to be prepared again');error.code='LINKEDIN_IMAGE_REUPLOAD';throw error;}
    await sleep(2000);
   }
   const error=Error('LinkedIn image processing timed out');if(status==='WAITING_UPLOAD')error.code='LINKEDIN_IMAGE_REUPLOAD';throw error;
  },
  async publish({caption,imageUrns,title}){
   const {owner}=ready();
   if(!Array.isArray(imageUrns)||imageUrns.length>10||!imageUrns.every(imageUrn))throw Error('LinkedIn supports up to 10 prepared images');
   if(typeof caption!=='string'||!caption.trim()||caption.length>3000)throw Error('Invalid LinkedIn caption');
   const content=!imageUrns.length?undefined:imageUrns.length===1?{media:{id:imageUrns[0],title}}:{multiImage:{images:imageUrns.map(id=>({id,altText:title}))}};
   const response=await request('posts',{method:'POST',body:{author:owner,commentary:linkedinCommentary(caption),visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},...(content?{content}:{}),lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false}});
   const postId=response.headers.get('x-restli-id');
   if(!linkedinPostUrl(postId))throw Error('LinkedIn publication identifier missing; reconcile before retrying');
   return {postId,permalink:linkedinPostUrl(postId)};
  }
 };
}
