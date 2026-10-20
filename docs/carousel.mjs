export const MAX_FEED_IMAGES=10;
export function flyerSources(campaign){return Array.isArray(campaign.flyerUrls)&&campaign.flyerUrls.length?[...campaign.flyerUrls]:campaign.flyerUrl?[campaign.flyerUrl]:[];}
export function validateFlyerSources(campaign){
 if(!campaign||campaign.flyerUrls===undefined)return;
 if(!Array.isArray(campaign.flyerUrls)||campaign.flyerUrls.length<1||campaign.flyerUrls.length>MAX_FEED_IMAGES)throw Error('Use between 1 and 10 flyer images.');
 for(const value of campaign.flyerUrls){let url;try{url=new URL(value);}catch{throw Error('Flyer images must use public HTTPS URLs.');}if(typeof value!=='string'||url.protocol!=='https:'||url.username||url.password)throw Error('Flyer images must use public HTTPS URLs without credentials.');}
 if(campaign.flyerUrl&&campaign.flyerUrl!==campaign.flyerUrls[0])throw Error('The cover flyer must match the first ordered image.');
}
export function mediaName(campaign,format,index=0){return `${campaign.id}-${format}${format==='feed'&&index?'-'+(index+1):''}.jpg`;}
export function feedImageUrls(campaign,config){
 const override=campaign.flyers?.feed||campaign.images?.feed;if(override)return [override];
 const count=Math.max(1,flyerSources(campaign).length),site=config.siteUrl?.replace(/\/$/,'');
 return site?Array.from({length:count},(_,i)=>`${site}/media/${campaign.year}/${mediaName(campaign,'feed',i)}`):[];
}
export function matchingFeedIssue(dimensions){
 if(dimensions.length<2)return '';
 const first=dimensions[0].width/dimensions[0].height;
 return dimensions.some(d=>Math.abs(d.width/d.height-first)>.01)?'Carousel images need matching proportions so Instagram does not crop them. Use images with the same shape, choose a single feed image URL, or turn Feed off.':'';
}
