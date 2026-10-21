import {localInput} from './time.mjs';

export const CALENDAR_SUGGESTION_LIMIT=5;
const FILTERS=new Set(['timed','all','all-day']);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const uid=event=>event.source?.uid||event.uid||event.id;

/** iCal DATE values are encoded at UTC midnight; keep the original calendar day. */
export function calendarSourceDay(value) {
  const day=String(value||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return '';
  const time=Date.parse(day+'T00:00:00Z');
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===day?day:'';
}
function todayInZone(now,timezone){return localInput(now,timezone).slice(0,10);}
function previousDay(day){return new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10);}

/** Datetime-local cannot represent an all-day date without inventing a time. */
export function calendarSuggestionPrefill(event,timezone) {
  if(event.allDay)return {start:'',end:'',startDate:calendarSourceDay(event.start),endDate:calendarSourceDay(event.end),allDay:true,needsTime:true};
  return {start:localInput(event.start,timezone),end:localInput(event.end,timezone),allDay:false,needsTime:false};
}

export function calendarSuggestionState(candidates=[],campaigns=[],{now=new Date(),timezone='UTC',filter='timed',expanded=false,limit=CALENDAR_SUGGESTION_LIMIT}={}) {
  now=new Date(now);
  if(!Number.isFinite(+now))throw Error('Invalid calendar suggestion time');
  const today=todayInZone(now,timezone),used=new Set(campaigns.map(c=>c.source?.uid).filter(Boolean)),seen=new Set();
  const available=candidates.filter(event=>{
    const id=uid(event);if(!id||used.has(id)||seen.has(id))return false;
    const start=Date.parse(event.start);if(!Number.isFinite(start))return false;
    // All-day dates remain reachable throughout their source calendar day. Their
    // exclusive end date also allows multi-day calendar dates already in progress.
    const upcoming=event.allDay?((calendarSourceDay(event.end)||calendarSourceDay(event.start))>today||calendarSourceDay(event.start)>=today):start>+now;
    if(!upcoming)return false;seen.add(id);return true;
  }).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||String(uid(a)).localeCompare(String(uid(b))));
  filter=FILTERS.has(filter)?filter:'timed';
  const counts={all:available.length,timed:available.filter(e=>!e.allDay).length,'all-day':available.filter(e=>e.allDay).length};
  const matching=available.filter(e=>filter==='all'||(filter==='all-day'?e.allDay:!e.allDay));
  const pageSize=Number.isInteger(limit)&&limit>0?limit:CALENDAR_SUGGESTION_LIMIT;
  return {filter,expanded,counts,total:matching.length,visible:expanded?matching:matching.slice(0,pageSize),hasMore:matching.length>pageSize};
}

export function calendarSuggestionDate(event,{timezone='UTC',format}={}) {
  if(!event.allDay)return format?format(event.start):new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(event.start));
  const first=calendarSourceDay(event.start),exclusive=calendarSourceDay(event.end);
  const date=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
  const firstLabel=date.format(new Date(first+'T00:00:00Z'));
  const last=exclusive&&exclusive>first?previousDay(exclusive):first;
  return `${firstLabel}${last>first?' – '+date.format(new Date(last+'T00:00:00Z')):''} · All day`;
}

export function calendarSuggestionRows(events,{timezone='UTC',format,esc=escape}={}) {
  return events.map(event=>{
    const allDay=Boolean(event.allDay),zone=allDay?'UTC':timezone;
    const when=new Date(allDay?calendarSourceDay(event.start)+'T00:00:00Z':event.start);
    const day=new Intl.DateTimeFormat('en-US',{timeZone:zone,day:'numeric'}).format(when);
    const month=new Intl.DateTimeFormat('en-US',{timeZone:zone,month:'short'}).format(when);
    const location=typeof event.location==='string'?event.location.trim():event.location?.name?.trim()||'';
    return `<div class="suggestion" role="listitem"><div class="date-box" aria-hidden="true">${esc(day)}<small>${esc(month)}</small></div><div><strong>${esc(event.title||'Untitled event')}</strong><p><time datetime="${esc(allDay?calendarSourceDay(event.start):event.start)}">${esc(calendarSuggestionDate(event,{timezone,format}))}</time>${location?' · '+esc(location):''}</p></div><button type="button" data-suggest="${esc(uid(event))}" aria-label="Create campaign for ${esc(event.title||'Untitled event')}" style="min-height:44px">Create campaign ＋</button></div>`;
  }).join('');
}

/**
 * Keep this controller mounted and call update on each campaign-data change.
 * data-suggest buttons work with the dashboard's existing delegated handler.
 * Candidate metadata has no reliable chapter/university category, so filters
 * describe timed events and all-day dates rather than guessing from titles.
 */
export function mountCalendarSuggestions({container,candidates=[],campaigns=[],format,esc=escape,onCreate,timezone='UTC',now=()=>new Date()}) {
  const doc=container.ownerDocument;
  const controls=doc.createElement('div');controls.className='calendar-suggestion-controls';
  controls.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:16px;';
  const label=doc.createElement('label');label.textContent='Calendar suggestions';label.style.cssText='display:flex;align-items:center;gap:12px;margin:0;font-size:13px;letter-spacing:normal;text-transform:none;';
  const select=doc.createElement('select');select.setAttribute('aria-label','Filter calendar suggestions');select.style.cssText='min-height:44px;margin:0;width:auto;max-width:100%;';
  for(const [value,text] of [['timed','Timed events'],['all','All events'],['all-day','All-day dates']]){const option=doc.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  label.append(select);controls.append(label);
  const count=doc.createElement('p');count.className='field-help';count.setAttribute('role','status');count.setAttribute('aria-live','polite');count.style.cssText='padding:0 16px;margin:0 0 12px;';
  const list=doc.createElement('div');list.className='calendar-suggestion-list';list.setAttribute('role','list');list.setAttribute('aria-label','Upcoming calendar suggestions');
  const footer=doc.createElement('div');footer.style.cssText='padding:16px;';
  const more=doc.createElement('button');more.type='button';more.className='calendar-suggestions-more';more.style.cssText='min-height:44px;';more.setAttribute('aria-expanded','false');footer.append(more);
  container.replaceChildren(controls,count,list,footer);
  let filter='timed',expanded=false,destroyed=false;
  function render(){
    if(destroyed)return;
    const state=calendarSuggestionState(candidates,campaigns,{now:typeof now==='function'?now():now,timezone,filter,expanded});
    select.value=state.filter;
    for(const option of select.options)option.textContent=({timed:'Timed events',all:'All events','all-day':'All-day dates'})[option.value]+` (${state.counts[option.value]})`;
    const noun=filter==='timed'?'timed event':filter==='all-day'?'all-day date':'event';const kind=noun+(state.total===1?'':'s');
    count.textContent=`Showing ${state.visible.length} of ${state.total} ${kind}.`+(filter==='timed'&&state.counts['all-day']?` ${state.counts['all-day']} all-day ${state.counts['all-day']===1?'date is':'dates are'} available in the filter.`:'');
    list.innerHTML=state.visible.length?calendarSuggestionRows(state.visible,{timezone,format,esc}):'<div class="empty" role="listitem">'+(state.counts.all?'No calendar suggestions match this filter. Choose another filter to see available dates.':'No new calendar suggestions. Calendar events will appear here after the calendar sync runs.')+'</div>';
    footer.hidden=!state.hasMore;more.textContent=expanded?'Show fewer':`Show all ${state.total} ${kind}`;more.setAttribute('aria-expanded',String(expanded));
    return state;
  }
  function change(){filter=select.value;expanded=false;render();}
  function toggle(){expanded=!expanded;render();}
  function create(event){if(!onCreate)return;const button=event.target.closest?.('[data-suggest]');if(!button||!container.contains(button))return;const candidate=candidates.find(item=>String(uid(item))===button.dataset.suggest);if(candidate){event.stopPropagation();onCreate(candidate);}}
  select.addEventListener('change',change);more.addEventListener('click',toggle);container.addEventListener('click',create);
  render();
  return {update(next={}){if(Object.hasOwn(next,'candidates'))candidates=next.candidates;if(Object.hasOwn(next,'campaigns'))campaigns=next.campaigns;if(Object.hasOwn(next,'timezone'))timezone=next.timezone;return render();},destroy(){destroyed=true;select.removeEventListener('change',change);more.removeEventListener('click',toggle);container.removeEventListener('click',create);}};
}
