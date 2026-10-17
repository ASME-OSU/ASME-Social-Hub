export const DEFAULT_CHANNELS=Object.freeze({feed:true,story:true,groupme:false});
const keyFor=repo=>`social-hub-channel-defaults:${String(repo.owner).toLowerCase()}/${String(repo.name).toLowerCase()}/${repo.branch}`;
const channels=value=>Object.fromEntries(Object.entries(DEFAULT_CHANNELS).map(([key,fallback])=>[key,typeof value?.[key]==='boolean'?value[key]:fallback]));
export function readChannelDefaults(storage,repo){
  try{const saved=JSON.parse(storage.getItem(keyFor(repo)));return saved?.version===1?channels(saved.channels):{...DEFAULT_CHANNELS};}
  catch{return {...DEFAULT_CHANNELS};}
}
export function saveChannelDefaults(storage,repo,value){
  const result=channels(value);
  storage.setItem(keyFor(repo),JSON.stringify({version:1,channels:result}));
  return result;
}
export function resetChannelDefaults(storage,repo){storage.removeItem(keyFor(repo));return {...DEFAULT_CHANNELS};}
