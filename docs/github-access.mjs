// Keep server error bodies out of the UI: they can echo credentials or submitted data.
export const initialAccess=()=>({read:'unverified',write:'unverified',dispatch:'unverified'});
const workflowDispatch=path=>/^actions\/workflows\/[^/]+\/dispatches(?:\?|$)/.test(path);
export function accessAfterResponse(previous,path,method,status,{rateLimited=false}={}) {
  const next={...previous};let capability;
  if(workflowDispatch(path)&&method==='POST')capability='dispatch';
  else if(path.startsWith('contents/'))capability=method==='GET'?'read':['PUT','DELETE'].includes(method)?'write':null;
  if(!capability)return next;
  if(status>=200&&status<300)next[capability]='accepted';
  else if(!rateLimited&&[401,403].includes(status))next[capability]='denied';
  return next;
}
export function accessLabels(access,hasToken) {
  if(!hasToken)return {read:'No token connected.',write:'Connect a token with Contents read and write.',dispatch:'Connect a token with Actions read and write.'};
  return {
    read:access.read==='accepted'?'A repository read succeeded this session.':access.read==='denied'?'Last repository read was denied. Check token access.':'Token loaded; repository read not checked this session.',
    write:access.write==='accepted'?'A save request was accepted this session.':access.write==='denied'?'Last save request was denied. Check Contents read and write.':'Not checked. Saving requires Contents read and write.',
    dispatch:access.dispatch==='accepted'?'A workflow request was accepted this session; check Actions for its result.':access.dispatch==='denied'?'Workflow request denied. Check Actions read and write and organization approval.':'Not checked. Preview and live controls require Actions read and write.'
  };
}
export async function githubRequest(path,options,connection,fetchImpl=fetch) {
  const method=(options.method||'GET').toUpperCase();
  const response=await fetchImpl(`https://api.github.com/repos/${encodeURIComponent(connection.repo.owner)}/${encodeURIComponent(connection.repo.name)}/${path}`,{...options,method,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${connection.token}`,'X-GitHub-Api-Version':'2022-11-28',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  if(!response.ok){
    if(response.status===404&&options.optional)return null;
    const rateLimited=response.status===429||(response.status===403&&(response.headers.get('x-ratelimit-remaining')==='0'||response.headers.has('retry-after')));
    let message='Check repository access, branch, and token permissions.';
    if(rateLimited)message='GitHub has temporarily limited requests. Wait before retrying; changing token permissions will not clear a rate limit.';
    else if(response.status===401)message='The token was rejected. Check whether it expired or was revoked, then reconnect in Settings.';
    else if(workflowDispatch(path)) {
      if(response.status===403)message='GitHub denied this workflow request. Repository reading and saving use separate permissions. In Settings, update the token to Actions → Read and write for this repository, confirm organization approval, then reconnect. No dispatcher run was requested.';
      else if(response.status===404)message='The dispatcher workflow was not found or is inaccessible. Check the repository and that dispatch.yml is on its default branch.';
      else if(response.status===422)message='GitHub could not start this workflow. Check that the main branch exists and dispatch.yml accepts the requested inputs.';
    } else if([409,422].includes(response.status))message='The file changed or this write conflicts. Reload the campaign before trying again.';
    const error=Object.assign(Error(`GitHub ${response.status}: ${message}`),{status:response.status,rateLimited});throw error;
  }
  return response.status===204?null:response.json();
}
