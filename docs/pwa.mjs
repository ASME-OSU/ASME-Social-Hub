const panel = document.querySelector('#pwa-panel');
const status = document.querySelector('#pwa-status');
const install = document.querySelector('#pwa-install');
const offline = document.querySelector('#pwa-offline');
let prompt;
function connectionStatus() {
 offline.hidden = navigator.onLine;
 if(!navigator.onLine) offline.textContent = 'You are offline. Showing a saved public copy; campaign and calendar details may be out of date. Repository saves, uploads, and publishing controls require an internet connection. Reconnect and reload for current data.';
}
connectionStatus();
window.addEventListener('offline', connectionStatus);
window.addEventListener('online', () => {
 offline.hidden = false;
 offline.textContent = 'Connection restored. Reload to refresh campaign data before making changes.';
});
window.addEventListener('beforeinstallprompt', event => {
 event.preventDefault();prompt = event;install.hidden = false;
});
window.addEventListener('appinstalled', () => {prompt = null;install.hidden = true;status.textContent = 'Social Hub is installed on this device.';});
install.addEventListener('click', async () => {
 if(!prompt)return;
 const current=prompt;prompt=null;install.hidden=true;
 await current.prompt();await current.userChoice;
});
if(matchMedia('(display-mode: standalone)').matches || navigator.standalone) status.textContent = 'Social Hub is running as an installed app.';
if('serviceWorker' in navigator && window.isSecureContext) {
 navigator.serviceWorker.addEventListener('message', event => {
  if(event.data?.type === 'PWA_CACHED_DATA') {
   offline.hidden = false;
   offline.textContent = 'Live data could not be reached. Showing a saved public copy that may be out of date. Reconnect and reload before making changes.';
  }
 });
 navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), {updateViaCache:'none'}).then(registration => {
  const updateStatus=()=>{
   if(registration.waiting) status.textContent = 'An app update is ready. Close all Social Hub tabs and app windows, then reopen to update. Save or export your work first.';
  };
  updateStatus();
  registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',updateStatus));
 }).catch(() => {status.textContent = 'Offline setup could not finish. You can keep using the website; reconnect and reload to try again.';});
} else {
 status.textContent = 'Offline support requires HTTPS or localhost and a browser with service worker support.';
}
panel.hidden = false;
