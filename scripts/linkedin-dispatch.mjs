import {linkedinEnabled,linkedinPlan,linkedinCaption} from '../docs/linkedin.mjs';
import {feedImageUrls} from '../docs/carousel.mjs';
import {fireAt} from './core.mjs';
export async function dispatchLinkedIn({c,config,now,dryRun,services,save,log,actions}){
 if(!linkedinEnabled(config)||c.campaign?.linkedin?.enabled!==true)return;
 const result=c.results?.linkedin||{};
 if(result.postId||result.postedAt||c.cancelled||['done','skipped'].includes(c.status?.linkedin))return;
 const fail=async(reconcile=false)=>{
  result.error={at:now.toISOString(),code:reconcile?'LINKEDIN_RECONCILIATION_REQUIRED':'LINKEDIN_PUBLISH_FAILED',hint:reconcile?'Inspect the chapter LinkedIn Page before clearing the recorded publication attempt.':'Check Community Management approval, token expiry, Page role, public flyers, and LinkedIn configuration.'};
  c.status.linkedin='failed';actions.at(-1).outcome='failed';actions.at(-1).error=result.error;log('linkedin',result.error.hint);await save();
 };
 // Uncertainty must stay visible even after the publishing window closes.
 if(result.publishAttemptedAt){actions.push({id:c.id,channel:'linkedin',action:'reconcile'});if(!dryRun){c.results.linkedin=result;await fail(true);}return;}
 const scheduled={...c,campaign:{...c.campaign,linkedin:linkedinPlan(c,config)}},due=fireAt(scheduled,'linkedin',config);
 if(now<due)return;
 if(now>=new Date(c.start)||+now-+due>86400000){actions.push({id:c.id,channel:'linkedin',action:'skip',fireAt:due.toISOString()});if(!dryRun){c.status.linkedin='skipped';c.results.linkedin=result;result.skipReason='publishing-window-missed';log('linkedin','Publishing window missed');await save();}return;}
 const action={id:c.id,channel:'linkedin',action:'publish',fireAt:due.toISOString()};actions.push(action);
 if(dryRun){action.caption=linkedinCaption(c,config);action.images=feedImageUrls(c,config);return;}
 c.results.linkedin=result;
 try{
  if(result.preparedRevision!==(c.revision??0)){delete result.imageUrns;delete result.images;delete result.caption;delete result.owner;}
  const {owner}=services.linkedin.checkReady();
  const configuredPage=config.integrations?.linkedin?.organizationUrn||config.integrations?.linkedin?.organizationId;
  if(configuredPage&&(String(configuredPage).startsWith('urn:')?configuredPage:`urn:li:organization:${configuredPage}`)!==owner)throw Error('LinkedIn Page does not match chapter configuration');
  if(result.owner&&result.owner!==owner)throw Error('Prepared LinkedIn images belong to another Page');
  result.owner=owner;result.preparedRevision=c.revision??0;
  result.caption=linkedinCaption(c,config);result.images=feedImageUrls(c,config);
  if(!result.images.length)throw Error('LinkedIn requires a public flyer');
  result.imageUrns??=[];
  for(let i=0;i<result.images.length;i++){
   if(!result.imageUrns[i]){result.imageUrns[i]=await services.linkedin.uploadImage(result.images[i]);await save();}
   try{await services.linkedin.waitForImage(result.imageUrns[i]);}catch(error){if(error.code==='LINKEDIN_IMAGE_REUPLOAD'){result.imageUrns[i]=null;await save();}throw error;}
  }
  // Persist intent remotely before the only call that can publish a post.
  result.publishAttemptedAt=now.toISOString();await save();
  let published;try{published=await services.linkedin.publish({caption:result.caption,imageUrns:result.imageUrns,title:c.title});}catch(error){if(error.retrySafe)delete result.publishAttemptedAt;throw error;}
  if(!published?.postId)throw Error('Missing LinkedIn post identifier');
  Object.assign(result,published,{postedAt:now.toISOString()});delete result.error;c.status.linkedin='done';log('linkedin','Published');await save();
 }catch(error){if(error.persistenceFailure)throw error;await fail(Boolean(result.publishAttemptedAt));}
}
