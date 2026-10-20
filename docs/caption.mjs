// Shared by the publisher and browser preview so captions cannot drift.
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const advertisingLimits = {foodDetails:160,rsvpUrl:2048,rsvpDeadline:Infinity,audience:200,cost:100,preparation:250,speaker:200,benefit:250,accessibilityContact:200};
export function validateAdvertising(advertising) {
  if (advertising === undefined) return;
  assert(advertising && typeof advertising === 'object' && !Array.isArray(advertising), 'Advertising must be an object');
  for (const [key,value] of Object.entries(advertising)) {
    assert(Object.hasOwn(advertisingLimits,key), `Unknown advertising field: ${key}`);
    assert(typeof value === 'string', `Advertising ${key} must be a string`);
    assert(value.length <= advertisingLimits[key], `Advertising ${key} exceeds ${advertisingLimits[key]} characters`);
    if (!value.trim()) continue;
    if (key === 'rsvpUrl') {
      let url; try { url = new URL(value); } catch { throw new Error('Advertising RSVP URL must be HTTPS without credentials'); }
      assert(url.protocol === 'https:' && !url.username && !url.password, 'Advertising RSVP URL must be HTTPS without credentials');
    }
    if (key === 'rsvpDeadline') {
      const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
      assert(match && Number.isFinite(Date.parse(value)), 'Advertising RSVP deadline must be an ISO datetime with timezone offset');
      const date = new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])));
      assert(date.getUTCMonth() === Number(match[2])-1 && date.getUTCDate() === Number(match[3]), 'Advertising RSVP deadline has an invalid calendar date');
    }
  }
}
export function advertisingLines(c, config) {
  validateAdvertising(c.advertising);
  const a = c.advertising || {};
  const filled = key => a[key]?.trim() || '';
  return [
    c.food === true ? `Food provided!${filled('foodDetails') ? ` ${filled('foodDetails')}` : ''}` : '',
    filled('rsvpUrl') ? `RSVP: ${filled('rsvpUrl')}` : '',
    filled('rsvpDeadline') ? `RSVP by: ${new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,dateStyle:'full',timeStyle:'short'}).format(new Date(a.rsvpDeadline))}` : '',
    ...[['audience','Audience'],['cost','Cost'],['preparation','Bring / dress'],['speaker','Speaker'],['benefit','Why attend'],['accessibilityContact','Accessibility contact']].map(([key,label]) => filled(key) ? `${label}: ${filled(key)}` : '')
  ].filter(Boolean);
}
export function captionFor(c, config) {
  const type = config.eventTypes?.find(t=>t.id===c.type);
  const lines = advertisingLines(c,config);
  const food = c.food === true ? lines.shift() : '';
  const template = type?.captionTemplate || config.captionTemplate || '{title}\n{description}\n{when}\n{location}\n{food}\n{hashtags}';
  const values = { title:c.title, description:c.description || '', when:new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,dateStyle:'full',timeStyle:'short'}).format(new Date(c.start)), location:typeof c.location==='string'?c.location:c.location?.name || '', food, advertising:lines.join('\n'), hashtags:(config.hashtags||[]).map(tag=>tag.startsWith('#')?tag:`#${tag}`).join(' '), chapterName:config.chapterName };
  const extras = [...(!template.includes('{food}') && c.advertising?.foodDetails?.trim() && food ? [food] : []), ...(!template.includes('{advertising}') ? lines : [])].join('\n');
  let extended = template;
  values.extraAdvertising = extras;
  if (extras) extended = template.includes('{hashtags}') ? template.replace('{hashtags}', '{extraAdvertising}\n{hashtags}') : `${template}\n{extraAdvertising}`;
  const caption = extended.split(/\r?\n/).flatMap(line => {
    const rendered = line.replace(/\{(\w+)\}/g,(_,k)=>values[k]??'').trim();
    return line.trim() && !rendered ? [] : [rendered];
  }).join('\n').replace(/\n{3,}/g,'\n\n').trim();
  assert(caption.length <= 2200, 'Instagram caption exceeds 2200 characters; shorten the description or advertising details');
  return caption;
}
