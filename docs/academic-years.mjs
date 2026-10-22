const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function validAcademicYear(value){return /^\d{4}-\d{2}$/.test(value||'')&&Number(value.slice(5))===(Number(value.slice(0,4))+1)%100;}
export function nextAcademicYear(value){if(!validAcademicYear(value))return '';const start=Number(value.slice(0,4))+1;return `${start}-${String((start+1)%100).padStart(2,'0')}`;}
export function academicYears(config,campaigns=[]){return [...new Set([config.activeYear,...(Array.isArray(config.academicYears)?config.academicYears:[]),...campaigns.filter(c=>!c.deletedAt).map(c=>c.year)].filter(validAcademicYear))].sort().reverse();}
export function prepareAcademicYearChange(latest,{action,year,expectedActiveYear,campaigns=[]}){
 if(!latest||typeof latest!=='object'||Array.isArray(latest)||!validAcademicYear(latest.activeYear))throw Error('The repository has an invalid active academic year. Review chapter configuration before saving.');
 if(!validAcademicYear(year))throw Error('Enter consecutive academic years, such as 2027-28.');
 if(!['add','activate'].includes(action))throw Error('Choose whether to add or activate an academic year.');
 if(action==='activate'&&latest.activeYear!==expectedActiveYear)throw Error(`The active year changed to ${latest.activeYear}. Reload the hub and review it before activating another year.`);
 const known=academicYears(latest,campaigns);
 if(action==='activate'&&!known.includes(year))throw Error('Add this academic year before activating it.');
 return {...latest,academicYears:[...new Set([...known,year])].sort().reverse(),...(action==='activate'?{activeYear:year}:{})};
}
export async function saveAcademicYearChange({getState,readConfig,writeConfig,onSaved},change){
 const initial=getState();
 if(initial.config?.previewOnly)throw Error('Academic year changes require the connected repository, outside local preview mode.');
 if(!initial.connected)throw Error('Connect a GitHub token with Contents read and write to save academic years.');
 const unchanged=()=>getState().connected&&getState().connectionKey===initial.connectionKey;
 const latest=await readConfig();
 if(!unchanged())throw Error('The repository connection changed. Review the academic year and try again.');
 if(!latest?.sha||!latest.config)throw Error('Chapter configuration could not be verified. Reload before trying again.');
 const next=prepareAcademicYearChange(latest.config,{...change,expectedActiveYear:initial.config.activeYear,campaigns:initial.campaigns});
 await writeConfig(next,latest.sha,`${change.action==='activate'?'Activate':'Add'} academic year: ${change.year}`);
 if(!unchanged())throw Error('The year was saved to the previous repository connection. Reload that repository to see the result.');
 onSaved(next);return next;
}
export function mountAcademicYears(container,options){
 if(!container)return {refresh(){}};
 container.classList.add('academic-years-panel');container.setAttribute('aria-labelledby','academic-years-title');
 container.innerHTML=`<h2 id="academic-years-title">Academic years</h2><p class="subtle" data-year-current></p><p class="field-help" data-year-history></p><form data-year-add><label>Add an academic year<input name="academicYear" inputmode="numeric" pattern="[0-9]{4}-[0-9]{2}" maxlength="7" placeholder="2027-28" required aria-describedby="academic-year-help"></label><p id="academic-year-help" class="field-help">Add next year now and prepare its campaigns. Only the active year is eligible for publishing.</p><div class="actions"><button type="submit">Add academic year</button></div></form><form data-year-activate><label>Academic year<select name="selectedYear" aria-describedby="academic-year-impact"></select></label><p id="academic-year-impact" class="field-help" data-year-impact></p><label class="check"><input name="acknowledge" type="checkbox">I understand that activating this year changes which campaigns can publish.</label><div class="actions"><button type="button" data-year-create>Create campaign for selected year</button><button type="submit" class="primary">Activate selected year</button></div></form><p class="field-help" data-year-connection></p><p class="field-help" role="status" data-year-status></p>`;
 const add=container.querySelector('[data-year-add]'),activate=container.querySelector('[data-year-activate]'),input=add.elements.academicYear,select=activate.elements.selectedYear,ack=activate.elements.acknowledge,status=container.querySelector('[data-year-status]');let busy=false,configured=false;
 function controls(){
  const state=options.getState();if(!state.config)return;
  const editable=state.connected&&!state.config.previewOnly;
  add.querySelector('button').disabled=busy||!editable;input.disabled=busy;
  select.disabled=busy;ack.disabled=busy||!editable||select.value===state.config.activeYear;
  activate.querySelector('button[type=submit]').disabled=busy||!editable||!ack.checked||select.value===state.config.activeYear;
  container.querySelector('[data-year-create]').disabled=busy||!options.onCreateCampaign||!select.value;
  const remaining=(state.campaigns||[]).filter(c=>c.year===state.config.activeYear&&!c.cancelled&&!c.deletedAt&&!c.archived&&!c.demo&&Object.values(c.status||{}).some(value=>value==='pending'||value==='failed')).length;
  container.querySelector('[data-year-impact]').textContent=select.value===state.config.activeYear?`${select.value} is active. New campaigns use this year by default.`:`Activating ${select.value} makes its eligible campaigns available to the dispatcher and stops processing other years. ${remaining} current-year ${remaining===1?'campaign has':'campaigns have'} pending or failed steps. Existing campaigns, posting receipts, and archive history stay in their original years.`;
  container.querySelector('[data-year-connection]').textContent=state.config.previewOnly?'Year settings are read-only in local preview mode.':editable?'Year changes save to the connected repository.':'Connect a GitHub token with Contents read and write to add or activate years.';
 }
 function refresh(){
  const {config,campaigns=[]}=options.getState();if(!config)return;
  const years=academicYears(config,campaigns),selected=select.value;
  select.innerHTML=years.map(year=>`<option value="${escape(year)}">${escape(year)}${year===config.activeYear?' · Active':''}</option>`).join('');select.value=years.includes(selected)?selected:config.activeYear;
  container.querySelector('[data-year-current]').textContent=`Active academic year: ${config.activeYear}`;
  container.querySelector('[data-year-history]').textContent=`Available years: ${years.join(', ')}. Add a year before preparing its campaigns; activate it when your chapter is ready to switch.`;
  if(!configured){input.value=nextAcademicYear(config.activeYear);configured=true;}
  controls();
 }
 async function save(action,year){
  if(busy)return;busy=true;container.setAttribute('aria-busy','true');status.textContent='Saving academic year…';controls();
  try{await saveAcademicYearChange(options,{action,year});ack.checked=false;refresh();select.value=year;status.textContent=action==='activate'?`${year} is now active. Existing campaigns and history were preserved.`:`${year} added. The active year has not changed. Select it below to prepare campaigns.`;}
  catch(error){status.textContent=[409,422].includes(error.status)?'The chapter configuration changed while saving. Reload the hub and review the year before trying again.':error.message;}
  finally{busy=false;container.setAttribute('aria-busy','false');controls();}
 }
 add.addEventListener('submit',event=>{event.preventDefault();if(add.checkValidity())save('add',input.value.trim());});
 activate.addEventListener('submit',event=>{event.preventDefault();if(ack.checked)save('activate',select.value);});
 select.addEventListener('change',()=>{ack.checked=false;controls();});ack.addEventListener('change',controls);
 container.querySelector('[data-year-create]').addEventListener('click',()=>options.onCreateCampaign?.(select.value));
 refresh();return {refresh};
}
