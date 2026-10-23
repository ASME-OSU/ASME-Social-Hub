const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const sun = svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>');
const moon = svg('<path d="M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z"/>');
export function initTheme(){
 const device=matchMedia('(prefers-color-scheme: dark)');
 const picker=document.querySelector('#appearance-theme');
 const button=document.querySelector('#theme-toggle');
 let preference='system';
 try{const saved=localStorage.getItem('social-hub-theme');if(saved==='light'||saved==='dark')preference=saved;}catch{}
 function render(){
  const dark=preference==='dark'||(preference==='system'&&device.matches);
  const root=document.documentElement;
  if(preference==='system')delete root.dataset.theme;else root.dataset.theme=preference;
  document.querySelector('meta[name="color-scheme"]').content=preference==='system'?'light dark':preference;
  document.querySelector('#theme-toggle-icon').innerHTML=dark?sun:moon;
  document.querySelector('#theme-toggle-text').textContent=dark?'Light':'Dark';
  const label=dark?'Switch to light theme':'Switch to dark theme';
  button.setAttribute('aria-label',label);button.title=label;
  if(picker)picker.value=preference;
 }
 function choose(value){
  preference=value;
  try{if(value==='system')localStorage.removeItem('social-hub-theme');else localStorage.setItem('social-hub-theme',value);}catch{}
  render();
 }
 button.addEventListener('click',()=>choose((preference==='dark'||(preference==='system'&&device.matches))?'light':'dark'));
 picker?.addEventListener('change',()=>choose(picker.value));
 device.addEventListener('change',()=>{if(preference==='system')render();});
 window.addEventListener('storage',event=>{if(event.key==='social-hub-theme'||event.key===null){preference=event.newValue==='light'||event.newValue==='dark'?event.newValue:'system';render();}});
 render();
}
