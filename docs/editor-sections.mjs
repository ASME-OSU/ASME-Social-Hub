// Keep every section in the form; navigation scrolls rather than hiding fields.
export function mountEditorSections(editor){
 const buttons=[...editor.querySelectorAll('[data-editor-section]')],fields=editor.querySelector('.editor-fields'),workspace=editor.querySelector('.editor-workspace');
 const sections=buttons.map(button=>editor.querySelector('#campaign-'+button.dataset.editorSection));
 const activate=section=>buttons.forEach(button=>{if('campaign-'+button.dataset.editorSection===section?.id)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');});
 buttons.forEach((button,index)=>button.addEventListener('click',()=>{const target=sections[index];target.querySelector('.form-section-heading')?.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});activate(target);}));
 const track=()=>{if(!editor.open)return;const root=matchMedia('(min-width:960px)').matches?fields:workspace;const top=root.getBoundingClientRect().top;activate(sections.filter(section=>section.getBoundingClientRect().top<=top+70).at(-1)||sections[0]);};
 fields.addEventListener('scroll',track,{passive:true});workspace.addEventListener('scroll',track,{passive:true});
 return {reset(){fields.scrollTop=0;workspace.scrollTop=0;activate(sections[0]);}};
}
