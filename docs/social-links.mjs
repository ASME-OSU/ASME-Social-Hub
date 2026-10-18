const profiles=[
 ['instagram','Instagram','<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/>'],
 ['linkedin','LinkedIn','<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7.5 10v7M7.5 7v.1M11 17v-7m0 3c0-4 6-4 6 0v4"/>'],
 ['facebook','Facebook','<path d="M14 21v-8h3l.5-4H14V7c0-1 .5-2 2-2h2V2h-3c-4 0-5 2.5-5 5v2H7v4h3v8"/>'],
 ['linktree','Linktree','<path d="M12 3v10m-7-8 7 7 7-7M3 12h18M7 17l5-5 5 5M12 17v5"/>']
];
export function renderSocialLinks(config){
 for(const group of document.querySelectorAll('[data-social-links]')){
  group.replaceChildren();
  for(const [key,label,paths] of profiles){
   let url;try{url=new URL(config.socialLinks?.[key]);if(url.protocol!=='https:'||url.username||url.password)continue;}catch{continue;}
   const link=document.createElement('a');link.className='social-link';link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`${label} (opens in a new tab)`);link.title=`${label} · opens in a new tab`;
   link.innerHTML=`<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
   group.append(link);
  }
  group.hidden=!group.childElementCount;
 }
}
