import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readCampaigns,writeJson} from './core.mjs';
import {createInstagramClient} from './ig.mjs';
export async function collectInsights(campaign,{client=createInstagramClient(),now=new Date()}={}) {
  campaign.results ||= {}; campaign.results.insights ||= [];
  for(const channel of ['feed','story']) {
    const result=campaign.results[channel]; if(!result?.mediaId || !result.postedAt) continue;
    const age=(now-new Date(result.postedAt))/86400000;
    // Story insights disappear quickly; collect inside 24h. Feed snapshots at day 1 and 7.
    const day=channel==='story' ? (age>=0 && age<1 ? 0 : null) : age>=7 ? 7 : age>=1 ? 1 : null;
    if(day===null || campaign.results.insights.some(x=>x.channel===channel&&x.day===day&&x.mediaId===result.mediaId)) continue;
    const metrics=channel==='story'?'reach,replies':'reach,likes,saved';
    try {
      const response=await client.request(`${encodeURIComponent(result.mediaId)}/insights`,{fields:{metric:metrics}});
      const values={}; for(const metric of response.data || []) { const value=metric.values?.[0]?.value ?? metric.total_value?.value; if(metrics.split(',').includes(metric.name)&&typeof value==='number'&&Number.isFinite(value)) values[metric.name]=value; }
      if (!Object.keys(values).length) throw new Error('No supported metrics returned');
      campaign.results.insights.push({channel,day,mediaId:String(result.mediaId),recordedAt:now.toISOString(),metrics:values});
    } catch { campaign.log ||= []; campaign.log.push({at:now.toISOString(),step:'insights',message:`${channel} metrics unavailable; check permission, media age, and supported metrics.`}); }
  }
  return campaign;
}
export async function main(root=process.cwd(),options={}) {
  for(const campaign of await readCampaigns(root)) {
    const before=JSON.stringify(campaign);
    await collectInsights(campaign,options);
    if(JSON.stringify(campaign)!==before) await writeJson(path.join(root,'data/campaigns',campaign.year,`${campaign.id}.json`),campaign);
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(()=>{console.error('Insights collection failed; check configuration and credentials.');process.exitCode=1;});
