import {mergeCampaignEdit} from './campaign-save.mjs';

export function campaignIsDeleted(campaign) { return Boolean(campaign?.deletedAt); }

export function prepareCampaignDeletion(base, current, config, now=new Date()) {
  const at=new Date(now).toISOString();
  const deleted=mergeCampaignEdit(base,{...base,cancelled:true,deletedAt:at},current,config,new Date(at));
  // Keep durable write intents and receipts so an old or overlapping run cannot resend.
  deleted.log=[...(current.log||[]),{at,channel:'system',message:'Campaign deleted from hub; pending announcements stopped. Published results retained.'}];
  return deleted;
}
