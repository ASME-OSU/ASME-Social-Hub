// Compare named controls directly so changing a field back also clears dirty state.
export function editorSnapshot(form){
 return JSON.stringify([...form.elements].filter(field=>field.name&&!['button','submit','reset'].includes(field.type)).map(field=>{
  if(field.type==='file')return [field.name,[...(field.files||[])].map(file=>[file.name,file.size,file.type,file.lastModified])];
  if(['checkbox','radio'].includes(field.type))return [field.name,field.value,field.checked];
  if(field.multiple&&field.options)return [field.name,[...field.options].filter(option=>option.selected).map(option=>option.value)];
  return [field.name,field.value];
 }));
}

/** Protect a modal editor without storing its draft content or intercepting saves. */
export function mountEditorGuard({dialog,form,isBusy=()=>false,getExtraState=()=>null}){
 const document=dialog.ownerDocument,window=document.defaultView;
 const confirmation=document.createElement('dialog');
 confirmation.id='editor-discard-dialog';
 confirmation.setAttribute('aria-labelledby','editor-discard-title');
 confirmation.setAttribute('aria-describedby','editor-discard-description');
 confirmation.style.cssText='width:min(460px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:24px;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:12px;';
 confirmation.innerHTML='<h2 id="editor-discard-title" style="margin-top:0">Discard unsaved changes?</h2><p id="editor-discard-description">Your campaign has changes that have not been saved. Keep editing to finish them, or discard them and close.</p><div style="display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap"><button type="button" data-keep-editing autofocus>Keep editing</button><button type="button" class="primary" data-discard-edits>Discard changes</button></div>';
 document.body.append(confirmation);
 let baseline=editorSnapshot(form),extraBaseline=JSON.stringify(null),extraDirty=false,previousFocus=null;
 const isDirty=()=>extraDirty||editorSnapshot(form)!==baseline||JSON.stringify(getExtraState())!==extraBaseline;
 const restoreFocus=()=>{if(previousFocus?.isConnected&&dialog.open)previousFocus.focus({preventScroll:true});};
 const keep=()=>{confirmation.close();restoreFocus();};
 confirmation.querySelector('[data-keep-editing]').addEventListener('click',keep);
 confirmation.querySelector('[data-discard-edits]').addEventListener('click',()=>{confirmation.close();extraDirty=false;dialog.close();});
 confirmation.addEventListener('cancel',event=>{event.preventDefault();keep();});
 const requestClose=()=>{
  if(!dialog.open||isBusy())return false;
  if(!isDirty()){dialog.close();return true;}
  if(!confirmation.open){previousFocus=document.activeElement;confirmation.showModal();confirmation.querySelector('[data-keep-editing]').focus();}
  return false;
 };
 dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
 dialog.addEventListener('close',()=>{if(confirmation.open)confirmation.close();});
 window.addEventListener('beforeunload',event=>{if(dialog.open&&isDirty()){event.preventDefault();event.returnValue='';}});
 return {
  reset(){baseline=editorSnapshot(form);extraBaseline=JSON.stringify(getExtraState());extraDirty=false;},
  markDirty(){extraDirty=true;},
  isDirty,
  requestClose
 };
}
