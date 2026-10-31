import {captionFor} from './caption.mjs';
export const LINKEDIN_DEFAULT_CADENCE={daysBefore:7,time:'12:00'};
export const linkedinEnabled=config=>config.integrations?.linkedin?.enabled===true;
export function linkedinPlan(c,config){return {...LINKEDIN_DEFAULT_CADENCE,...config.defaultCadence?.linkedin,...c.campaign?.linkedin,enabled:c.campaign?.linkedin?.enabled===true};}
export function linkedinCaption(c,config){
 const custom=c.campaign?.linkedin?.caption;
 if(custom!==undefined&&typeof custom!=='string')throw Error('LinkedIn caption must be text');
 const text=custom?.trim()||captionFor(c,config);
 if(!text||text.length>3000)throw Error('LinkedIn caption must contain 1–3000 characters.');
 return text;
}
// LinkedIn commentary uses little-text syntax; escape literal punctuation so
// officer copy cannot accidentally become mentions or formatting instructions.
export const linkedinCommentary=text=>text.replace(/[\\{}@\[\]()<>#*_~|]/g,'\\$&');
export function linkedinPostUrl(urn){return /^urn:li:(share|ugcPost):\d+$/.test(urn||'')?`https://www.linkedin.com/feed/update/${urn}/`:'';}
