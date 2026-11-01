import assert from 'node:assert/strict';

// A synthetic editor exercises browser modal/focus/unload behavior without writes.
export async function checkEditorGuard(browser,base){
 const page=await browser.newPage({serviceWorkers:'block'});
 try{
  await page.route('**/__editor-guard-check',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><title>Editor safeguard check</title></head><body></body></html>'}));
  await page.goto(base.replace(/\/$/,'')+'/__editor-guard-check');
  await page.evaluate(async()=>{
   const {mountEditorGuard}=await import('./editor-guard.mjs');
   const dialog=document.createElement('dialog');dialog.id='guard-fixture';
   dialog.innerHTML='<form><input name="title" value="Original"><input name="disabledValue" value="Disabled" disabled><input type="checkbox" name="food"><input type="file" name="flyer"><select name="mode"><option>A</option><option>B</option></select><button type="button" id="guard-close">Close</button></form>';
   document.body.append(dialog);dialog.showModal();
   window.guardBusy=false;
   window.guardFixture=mountEditorGuard({dialog,form:dialog.querySelector('form'),isBusy:()=>window.guardBusy});
   dialog.querySelector('#guard-close').addEventListener('click',()=>window.guardFixture.requestClose());
  });
  const editor=page.locator('#guard-fixture'),confirm=page.locator('#editor-discard-dialog');
  await editor.locator('[name=title]').fill('Changed');await page.keyboard.press('Escape');
  await confirm.waitFor({state:'visible'});
  assert.equal(await editor.evaluate(element=>element.open),true);
  assert.equal(await confirm.locator('[data-keep-editing]').evaluate(element=>element===document.activeElement),true);
  await page.keyboard.press('Escape');assert.equal(await confirm.isVisible(),false);
  assert.equal(await editor.locator('[name=title]').inputValue(),'Changed');
  assert.equal(await editor.locator('[name=title]').evaluate(element=>element===document.activeElement),true);
  await editor.locator('#guard-close').click();await confirm.locator('[data-keep-editing]').click();
  assert.equal(await editor.evaluate(element=>element.open),true);
  await editor.locator('[name=title]').fill('Original');
  assert.equal(await page.evaluate(()=>window.guardFixture.isDirty()),false,'Reverting named fields clears dirty state');
  await editor.locator('[name=food]').check();
  assert.equal(await page.evaluate(()=>window.guardFixture.isDirty()),true);
  await page.evaluate(()=>window.guardFixture.reset());
  assert.equal(await page.evaluate(()=>window.guardFixture.isDirty()),false);
  await page.evaluate(()=>document.querySelector('#guard-fixture [name=disabledValue]').value='Updated while disabled');
  assert.equal(await page.evaluate(()=>window.guardFixture.isDirty()),true,'Disabled control values are protected');
  await page.evaluate(()=>window.guardFixture.reset());
  await editor.locator('[name=flyer]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  assert.equal(await page.evaluate(()=>window.guardFixture.isDirty()),true,'Selected files are protected');
  await page.evaluate(()=>{window.guardFixture.reset();window.guardFixture.markDirty();});
  assert.equal(await page.evaluate(()=>window.guardFixture.isDirty()),true,'Upload ordering can mark changes outside controls');
  const unloadPrevented=await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});
  assert.equal(unloadPrevented,true,'Dirty editor requests browser reload protection');
  await page.evaluate(()=>window.guardBusy=true);await page.keyboard.press('Escape');
  assert.equal(await confirm.isVisible(),false);assert.equal(await editor.evaluate(element=>element.open),true,'Saving cannot be interrupted');
  await page.evaluate(()=>window.guardBusy=false);await editor.locator('#guard-close').click();
  await confirm.locator('[data-discard-edits]').click();assert.equal(await editor.isVisible(),false);
  await page.evaluate(()=>{document.querySelector('#guard-fixture').showModal();window.guardFixture.reset();});
  await editor.locator('#guard-close').click();assert.equal(await editor.isVisible(),false,'Clean editor closes immediately');
  console.log('Editor guard checks passed: Escape, Close, focus, revert, disabled fields, files, custom changes, unload and saving.');
 }finally{await page.close({runBeforeUnload:false});}
}
