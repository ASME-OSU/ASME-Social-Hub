// Brand asset provenance: assets/icons/README.md
const profiles=[
  [
    "instagram",
    "Instagram",
    "<svg viewBox=\"0 0 24 24\" width=\"23\" height=\"23\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><circle cx=\"17.5\" cy=\"6.5\" r=\".8\" fill=\"currentColor\" stroke=\"none\"/></svg>"
  ],
  [
    "linkedin",
    "LinkedIn",
    "<img class=\"social-brand-image linkedin-blue\" src=\"./assets/icons/linkedin-blue.png\" width=\"28\" height=\"24\" alt=\"\"><img class=\"social-brand-image linkedin-white\" src=\"./assets/icons/linkedin-white.png\" width=\"28\" height=\"24\" alt=\"\">"
  ],
  [
    "facebook",
    "Facebook",
    "<img class=\"social-brand-image facebook-mark\" src=\"./assets/icons/facebook.png\" width=\"25\" height=\"25\" alt=\"\">"
  ],
  [
    "linktree",
    "Linktree",
    "<svg class=\"social-brand-linktree\" width=\"22\" height=\"26\" aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"7.4115 0 21.177 26.001\"><path fill=\"currentColor\" d=\"M19.881 6.34096L24.2196 1.88105L26.7378 4.45991L22.1869 8.79846H28.5885V12.3785H22.1565L26.7378 16.8283L24.2196 19.3566L18 13.1067L11.7804 19.3566L9.26221 16.8384L13.8435 12.3886H7.4115V8.79846H13.8131L9.26221 4.45991L11.7804 1.88105L16.1189 6.34096V0H19.881V6.34096ZM16.1189 17.5059H19.881V26.001H16.1189V17.5059Z\"/></svg>"
  ]
];
export function renderSocialLinks(config){
 for(const group of document.querySelectorAll('[data-social-links]')){
  group.replaceChildren();
  for(const [key,label,markup] of profiles){
   let url;try{url=new URL(config.socialLinks?.[key]);if(url.protocol!=='https:'||url.username||url.password)continue;}catch{continue;}
   const link=document.createElement('a');link.className='social-link';link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`${label} (opens in a new tab)`);link.title=`${label} · opens in a new tab`;
   link.innerHTML=markup;
   group.append(link);
  }
  group.hidden=!group.childElementCount;
 }
}
