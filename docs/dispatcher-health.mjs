export const STALE_AFTER_MS=90*60*1000;
export function dispatcherHealth(data, now=Date.now()) {
  const at=Date.parse(data?.lastSuccessfulLiveRunAt);
  if(!Number.isFinite(at) || at>+now) return {state:'unknown',at:null,message:'No successful live dispatcher run recorded. Automatic publishing health is unknown.'};
  const stale=+now-at>STALE_AFTER_MS;
  return {state:stale?'stale':'healthy',at:new Date(at).toISOString(),message:stale?'Dispatcher overdue: no successful live execution for more than 90 minutes. Check Actions or run the dispatcher manually.':'Dispatcher is current. Scheduled GitHub Actions runs can be delayed.'};
}
