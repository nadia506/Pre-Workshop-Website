(function(){
'use strict';

const STORAGE_KEY='focus-daybook-v1';
const SNAP=15, HOUR_PX=52, PPM=HOUR_PX/60, MIN_DUR=15, DEFAULT_START_HOUR=5;

const $=s=>document.querySelector(s);
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const snap=m=>Math.round(m/SNAP)*SNAP;
const pad=n=>String(n).padStart(2,'0');
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function btn(text,cls){const b=el('button',cls||'btn',text);b.type='button';return b;}
function fmtTime(min){min=((min%1440)+1440)%1440;const h=Math.floor(min/60),m=min%60;return `${h%12||12}:${pad(m)} ${h<12?'AM':'PM'}`;}
function fmtHour(h){h=h%24;return `${h%12||12} ${h<12?'AM':'PM'}`;}
function hhmm(min){return `${pad(Math.floor(min/60))}:${pad(min%60)}`;}
function localKey(d){d=d||new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function parseKey(k){const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d);}
function longDate(k){return parseKey(k).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});}
function shortDate(k){return parseKey(k).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});}
function stamp(ts){return new Date(ts).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
const isTouchLayout=()=>window.matchMedia('(max-width:900px)').matches;

/* ---------- State ---------- */
function freshBackground(){return {answers:{}};}
function fresh(){return {v:1,name:'',tags:DEFAULT_TAGS.map((n,i)=>({id:uid(),name:n,hue:HUES[i%HUES.length]})),background:freshBackground(),days:{},activeDay:null,ui:{}};}
function newDay(key){return {date:key,blocks:[],ratings:{},reflection:{},startHour:DEFAULT_START_HOUR,submittedAt:null,submitCount:0,lastEditedAt:null};}
function load(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const s=JSON.parse(raw);if(s&&s.v===1&&s.days&&s.tags){if(!s.background)s.background=freshBackground();if(s.name==null)s.name=s.participantId||'';for(const k in s.days)for(const b of s.days[k].blocks||[])if(b.note==null){b.note=b.title||'';delete b.title;}migrateTags(s);return s;}}}catch(e){}return fresh();}
/* Saved state from an earlier version may still carry the old 12-tag default set; swap it for the current defaults. */
function migrateTags(s){
  const OLD=['Deep work','Meeting','Class / lecture','Reading','Writing / coding','Exercise','Social','Meal','Break','Chores / errands','Commute','Sleep'];
  const names=s.tags.map(t=>t.name);
  if(names.length!==OLD.length||!OLD.every(n=>names.includes(n)))return;
  const fresh=DEFAULT_TAGS.map((n,i)=>({id:uid(),name:n,hue:HUES[i%HUES.length]}));
  const byOldId={};for(const t of s.tags){const f=fresh.find(x=>x.name===t.name);byOldId[t.id]=f?f.id:null;}
  for(const k in s.days)for(const b of s.days[k].blocks||[])b.tagId=b.tagId?byOldId[b.tagId]||null:null;
  s.tags=fresh;
}
let state=load();
let sel=null;
let saveTimer=null,savedTimer=null;
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));flashSaved();}catch(e){}},150);}
function flashSaved(){const s=$('#saved');s.classList.add('show');clearTimeout(savedTimer);savedTimer=setTimeout(()=>s.classList.remove('show'),1200);}
function touch(day){day.lastEditedAt=Date.now();}
function dayKeys(){return Object.keys(state.days).sort();}
function activeDay(){return state.days[state.activeDay]||null;}
function tagById(id){return state.tags.find(t=>t.id===id)||null;}
function sortBlocks(day){day.blocks.sort((a,b)=>a.start-b.start);}
function bounds(day,b){const others=day.blocks.filter(x=>x.id!==b.id);let lower=0,upper=1440;for(const o of others){if(o.end<=b.start&&o.end>lower)lower=o.end;if(o.start>=b.end&&o.start<upper)upper=o.start;}return {lower,upper};}
function gapAt(day,t){let lower=0,upper=1440;for(const o of day.blocks){if(o.end<=t&&o.end>lower)lower=o.end;if(o.start>=t&&o.start<upper)upper=o.start;if(o.start<t&&o.end>t)return null;}return {lower,upper};}

/* ---------- Header / intro ---------- */
const pidInput=$('#pid');
try{const q=new URLSearchParams(location.search).get('name');if(q&&!state.name)state.name=q.trim();}catch(e){}
pidInput.value=state.name||'';
pidInput.addEventListener('input',()=>{state.name=pidInput.value.trim();pidInput.classList.remove('missing');save();});

/* ---------- Days ---------- */
function renderDayChips(){
  const c=$('#dayChips');c.innerHTML='';
  for(const k of dayKeys()){
    const d=state.days[k];
    const b=btn('','daychip'+(k===state.activeDay?' on':''));
    b.append(el('span','dc-date',shortDate(k)));
    const st=el('span','dc-status');
    if(d.submittedAt){const edited=d.lastEditedAt&&d.lastEditedAt>d.submittedAt;st.textContent=edited?'edited':'submitted';st.classList.add(edited?'st-edited':'st-done');}
    if(st.textContent)b.append(st);
    b.onclick=()=>{state.activeDay=k;sel=null;save();renderDayChips();renderDay();};
    c.append(b);
  }
}
$('#addDayBtn').onclick=()=>{const f=$('#addDayForm');f.hidden=!f.hidden;if(!f.hidden){$('#newDate').value=localKey();$('#newDate').focus();}};
$('#addDayGo').onclick=()=>{
  const v=$('#newDate').value;if(!v)return;
  if(!state.days[v])state.days[v]=newDay(v);
  state.activeDay=v;sel=null;$('#addDayForm').hidden=true;save();renderDayChips();renderDay();
};
$('#removeDay').onclick=()=>{
  const day=activeDay();if(!day)return;
  const rb=$('#removeDay');
  if(rb.dataset.arm){delete state.days[day.date];delete rb.dataset.arm;rb.textContent='Remove this day';const keys=dayKeys();state.activeDay=keys[keys.length-1]||null;sel=null;save();renderDayChips();renderDay();return;}
  rb.dataset.arm='1';rb.textContent='Really remove this day? Click again to confirm';
  setTimeout(()=>{if(rb.dataset.arm){delete rb.dataset.arm;rb.textContent='Remove this day';}},4000);
};

/* ---------- Day rendering ---------- */
const tl=$('#tl'),lane=$('#lane'),hoursEl=$('#hours');
function renderDay(){
  const day=activeDay();
  $('#daySection').hidden=!day;$('#emptyState').hidden=!!day;
  if(!day)return;
  $('#dayTitle').textContent=longDate(day.date);
  renderDayStatus();
  if(day.blocks.some(b=>b.start<day.startHour*60))day.startHour=0;
  renderExpand();renderHours();renderBlocks();renderNow();renderInspector();renderForms();
  $('#submitMsg').textContent='';$('#submitMsg').className='msg';$('#dataBox').hidden=true;
}
function renderDayStatus(){
  const day=activeDay();const s=$('#dayStatus');
  if(!day.submittedAt){s.innerHTML='';return;}
  const edited=day.lastEditedAt&&day.lastEditedAt>day.submittedAt;
  s.innerHTML=edited?`<b class="edited">Edited since submitting</b> · last submitted ${stamp(day.submittedAt)}. Submit again to send the latest version.`:`<b>Submitted</b> ${stamp(day.submittedAt)}. You can still make changes and submit again.`;
}
function renderExpand(){
  const day=activeDay();const b=$('#expand');
  const hasEarly=day.blocks.some(x=>x.start<DEFAULT_START_HOUR*60);
  if(day.startHour>0){b.textContent='Show midnight – 5 AM';b.hidden=false;}
  else if(!hasEarly){b.textContent='Hide midnight – 5 AM';b.hidden=false;}
  else b.hidden=true;
  b.onclick=()=>{day.startHour=day.startHour>0?0:DEFAULT_START_HOUR;save();renderExpand();renderHours();renderBlocks();renderNow();};
}
function renderHours(){
  const day=activeDay();hoursEl.innerHTML='';
  const n=24-day.startHour;tl.style.height=n*HOUR_PX+'px';
  for(let i=0;i<=n;i++){
    const row=el('div','hour');row.style.top=i*HOUR_PX+'px';
    row.append(el('span','hour-label',fmtHour(day.startHour+i)));
    if(i<n)row.append(el('div','half'));
    hoursEl.append(row);
  }
}
let nowTimer=null;
function renderNow(){
  const day=activeDay();const n=$('#now');clearInterval(nowTimer);
  if(!day||day.date!==localKey()){n.hidden=true;return;}
  const tick=()=>{const d=new Date();const m=d.getHours()*60+d.getMinutes();const top=(m-day.startHour*60)*PPM;if(top<0){n.hidden=true;return;}n.hidden=false;n.style.top=top+'px';};
  tick();nowTimer=setInterval(tick,60000);
}
function renderBlocks(){
  const day=activeDay();if(!day)return;sortBlocks(day);lane.innerHTML='';
  const startMin=day.startHour*60;
  for(const b of day.blocks)lane.append(blockEl(day,b,startMin));
}
function blockEl(day,b,startMin){
  const tag=tagById(b.tagId);
  const d=el('div','block');d.dataset.id=b.id;d.tabIndex=0;d.setAttribute('role','group');
  d.setAttribute('aria-label',(tag?tag.name:'Untagged block')+(b.note?', '+b.note:'')+', '+fmtTime(b.start)+' to '+fmtTime(b.end));
  d.style.top=(b.start-startMin)*PPM+'px';
  const h=(b.end-b.start)*PPM-2;d.style.height=h+'px';
  if(tag)d.style.setProperty('--h',tag.hue);else d.classList.add('untagged');
  if(b.id===sel)d.classList.add('selected');
  const compact=h<40;if(compact)d.classList.add('compact');
  const body=el('div','b-body');
  const timeText=fmtTime(b.start)+' – '+fmtTime(b.end);
  if(compact){
    body.append(el('span','b-ct',tag?tag.name:'Choose a tag'),el('span','b-time',timeText));
    if(b.note)body.append(el('span','b-note-c',b.note));
  }else{
    const head=el('div','b-head');head.append(el('span','b-tagname',tag?tag.name:'Choose a tag'),el('span','b-time',timeText));body.append(head);
    if(tag){
      const inp=document.createElement('input');inp.className='b-note';inp.value=b.note||'';inp.placeholder='Add a note (optional)';inp.setAttribute('aria-label','Note');inp.autocomplete='off';
      inp.addEventListener('input',()=>{b.note=inp.value;touch(day);save();const t=$('#insp-note');if(t&&document.activeElement!==t)t.value=inp.value;});
      inp.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();inp.blur();}e.stopPropagation();});
      body.append(inp);
    }else{
      const chips=el('div','b-chips');
      for(const t of state.tags){const c=btn(t.name,'b-chip');c.style.setProperty('--h',t.hue);c.onclick=()=>setTag(day,b,t.id,true);chips.append(c);}
      body.append(chips);
    }
  }
  d.append(body);
  d.append(el('div','grip grip-top'),el('div','grip grip-bot'));
  return d;
}
/* Set a block's tag. With focusNote, move the cursor into the block's note afterwards (desktop only). */
function setTag(day,b,tagId,focusNote){
  b.tagId=tagId;touch(day);save();sel=b.id;renderBlocks();renderInspector();
  if(focusNote&&lastPointerType==='mouse'){const n=lane.querySelector(`.block[data-id="${b.id}"] .b-note`);if(n)n.focus();}
}
let lastPointerType='mouse';
document.addEventListener('pointerdown',e=>{lastPointerType=e.pointerType||'mouse';},true);

/* ---------- Selection ---------- */
function select(id,opts){
  opts=opts||{};
  if(sel===id&&!opts.force){return;}
  sel=id;renderBlocks();renderInspector();
  if(!id)return;
  const elB=lane.querySelector(`.block[data-id="${id}"]`);
  if(!elB)return;
  if(opts.focusNote){
    const inline=elB.querySelector('.b-note');
    const target=inline||$('#insp-note');
    if(target){target.focus();if(target.value)target.setSelectionRange(target.value.length,target.value.length);}
  }
  if(isTouchLayout()){
    const r=elB.getBoundingClientRect();const want=window.innerHeight*0.16;
    if(r.top>window.innerHeight*0.36||r.top<0)window.scrollBy({top:r.top-want,behavior:'smooth'});
  }
}
document.addEventListener('pointerdown',e=>{
  if(!sel)return;
  if(e.target.closest('#lane,#inspector,#tagmgr'))return;
  select(null);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sel&&!e.target.closest('input,textarea,select'))select(null);});

/* ---------- Pointer interaction on the lane ---------- */
let drag=null,pending=null;
function laneMin(clientY){const r=lane.getBoundingClientRect();const day=activeDay();return clamp((clientY-r.top)/PPM+day.startHour*60,0,1440);}
lane.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  const day=activeDay();if(!day)return;
  const grip=e.target.closest('.grip');const blockEl=e.target.closest('.block');
  if(grip&&blockEl){startDrag(e,grip.classList.contains('grip-top')?'resize-top':'resize-bot',blockEl);return;}
  if(blockEl){
    const id=blockEl.dataset.id;const isSel=id===sel;
    if(e.target.classList.contains('b-chip'))return;
    if(e.target.classList.contains('b-note')&&isSel)return;
    if(e.pointerType==='touch'&&!isSel){pending={type:'select',id,x:e.clientX,y:e.clientY};return;}
    startDrag(e,'move',blockEl);return;
  }
  if(e.pointerType==='touch'){pending={type:'create',x:e.clientX,y:e.clientY};return;}
  startDrag(e,'create',null);
});
lane.addEventListener('pointermove',e=>{
  if(pending){if(Math.hypot(e.clientX-pending.x,e.clientY-pending.y)>8)pending=null;return;}
  if(!drag||e.pointerId!==drag.pid)return;
  const dy=e.clientY-drag.startY;
  if(!drag.moved){if(Math.abs(dy)<5&&Math.abs(e.clientX-drag.startX)<5)return;drag.moved=true;document.body.classList.add('dragging');if(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.block'))document.activeElement.blur();}
  e.preventDefault();
  const day=activeDay();const o=drag.orig;
  if(drag.type==='move'){
    const dur=o.end-o.start;const ns=clamp(snap(o.start+dy/PPM),drag.lower,drag.upper-dur);
    drag.cur={start:ns,end:ns+dur};applyDragStyle(day);
  }else if(drag.type==='resize-bot'){
    const ne=clamp(snap(o.end+dy/PPM),o.start+MIN_DUR,drag.upper);drag.cur={start:o.start,end:ne};applyDragStyle(day);
  }else if(drag.type==='resize-top'){
    const ns=clamp(snap(o.start+dy/PPM),drag.lower,o.end-MIN_DUR);drag.cur={start:ns,end:o.end};applyDragStyle(day);
  }else if(drag.type==='create'){
    const t=clamp(snap(laneMin(e.clientY)),drag.lower,drag.upper);
    let s=Math.min(drag.t0,t),en=Math.max(drag.t0,t);if(en-s<SNAP)en=s+SNAP;en=Math.min(en,drag.upper);
    drag.cur={start:s,end:en};
    if(!drag.el){drag.el=el('div','block ghost');drag.el.append(el('div','b-body'));lane.append(drag.el);}
    drag.el.style.top=(s-day.startHour*60)*PPM+'px';drag.el.style.height=(en-s)*PPM-2+'px';
    drag.el.firstChild.textContent=fmtTime(s)+' – '+fmtTime(en);
  }
});
function applyDragStyle(day){
  const {start,end}=drag.cur;const elB=drag.el;
  elB.style.top=(start-day.startHour*60)*PPM+'px';elB.style.height=(end-start)*PPM-2+'px';
  const t=elB.querySelector('.b-time');if(t)t.textContent=fmtTime(start)+' – '+fmtTime(end);
}
/* After a touch tap re-lays out the page (the bottom sheet appears under the finger), the browser's follow-up click must not land on whatever is now there. */
let swallowUntil=0;
document.addEventListener('click',e=>{if(Date.now()<swallowUntil){e.stopPropagation();e.preventDefault();}},true);
function endPointer(e){
  const day=activeDay();
  if(pending&&e.type==='pointerup'){
    const p=pending;pending=null;
    if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<=8){
      swallowUntil=Date.now()+500;
      if(p.type==='select')select(p.id);
      else createAt(laneMin(p.y),true);
    }
    return;
  }
  pending=null;
  if(!drag||e.pointerId!==drag.pid)return;
  const d=drag;drag=null;document.body.classList.remove('dragging');
  try{lane.releasePointerCapture(d.pid);}catch(err){}
  if(d.type==='create'){
    if(d.el)d.el.remove();
    if(e.type!=='pointerup')return;
    if(!d.moved){createAt(d.rawT,false);return;}
    const b={id:uid(),start:d.cur.start,end:d.cur.end,note:'',tagId:null};
    day.blocks.push(b);touch(day);save();select(b.id,{force:true});
    return;
  }
  const b=day.blocks.find(x=>x.id===d.id);if(!b)return;
  if(d.moved&&d.cur&&e.type==='pointerup'){
    b.start=d.cur.start;b.end=d.cur.end;
    touch(day);save();renderBlocks();renderInspector();
  }else if(d.moved){renderBlocks();}
  else{
    const wasSel=sel===b.id;
    select(b.id,{focusNote:!wasSel&&e.pointerType==='mouse'&&!!b.tagId});
  }
}
lane.addEventListener('pointerup',endPointer);
lane.addEventListener('pointercancel',endPointer);
function startDrag(e,type,blockEl){
  const day=activeDay();
  drag={type,pid:e.pointerId,startY:e.clientY,startX:e.clientX,moved:false,el:blockEl,cur:null};
  if(blockEl){
    const b=day.blocks.find(x=>x.id===blockEl.dataset.id);if(!b){drag=null;return;}
    drag.id=b.id;drag.orig={start:b.start,end:b.end};
    Object.assign(drag,bounds(day,b));
  }else{
    const raw=laneMin(e.clientY);const g=gapAt(day,raw);
    if(!g||g.upper-g.lower<SNAP){drag=null;return;}
    drag.rawT=raw;drag.lower=g.lower;drag.upper=g.upper;drag.t0=clamp(snap(raw),g.lower,g.upper-SNAP);
  }
  try{lane.setPointerCapture(e.pointerId);}catch(err){}
}
function createAt(raw,fromTouch){
  const day=activeDay();const g=gapAt(day,raw);if(!g||g.upper-g.lower<SNAP){toast('No room here. Shorten a neighbouring block first.');return;}
  const s=clamp(Math.floor(raw/SNAP)*SNAP,g.lower,g.upper-SNAP);
  const en=Math.min(s+60,g.upper);
  const b={id:uid(),start:s,end:en,note:'',tagId:null};
  day.blocks.push(b);touch(day);save();
  if(day.startHour>0&&s<day.startHour*60){day.startHour=0;renderExpand();renderHours();}
  select(b.id,{force:true});
}
lane.addEventListener('keydown',e=>{
  const blockEl=e.target.closest('.block');if(!blockEl||e.target.tagName==='INPUT')return;
  const day=activeDay();const b=day.blocks.find(x=>x.id===blockEl.dataset.id);if(!b)return;
  if(e.key==='Enter'){select(b.id,{focusNote:true,force:true});e.preventDefault();return;}
  if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
  e.preventDefault();const dir=e.key==='ArrowUp'?-SNAP:SNAP;const {lower,upper}=bounds(day,b);
  if(e.shiftKey){b.end=clamp(b.end+dir,b.start+MIN_DUR,upper);}
  else{const dur=b.end-b.start;b.start=clamp(b.start+dir,lower,upper-dur);b.end=b.start+dur;}
  touch(day);save();renderBlocks();renderInspector();
  const again=lane.querySelector(`.block[data-id="${b.id}"]`);if(again)again.focus();
});

/* ---------- Inspector ---------- */
function field(label){const f=el('div','field');f.append(el('div','lbl',label));return f;}
function timeSelect(min,max,value,step){
  const s=document.createElement('select');step=step||SNAP;
  for(let m=min;m<=max;m+=step){const o=document.createElement('option');o.value=m;o.textContent=m===1440?'12:00 AM (end of day)':fmtTime(m);s.append(o);}
  s.value=value;return s;
}
function scaleRow(cfg,value,onPick){
  const wrap=el('div','scale');const btns=el('div','scale-btns');btns.setAttribute('role','group');
  for(let v=cfg.min;v<=cfg.max;v++){
    const b=btn(String(v),'scale-btn'+(value===v?' on':''));b.setAttribute('aria-pressed',value===v?'true':'false');
    b.onclick=()=>onPick(value===v?null:v);btns.append(b);
  }
  const anchors=el('div','scale-anchors');anchors.append(el('span','',cfg.lo),el('span','',cfg.hi));
  wrap.append(btns,anchors);return wrap;
}
function renderInspector(){
  const insp=$('#inspector');const day=activeDay();
  const b=day?day.blocks.find(x=>x.id===sel):null;
  document.body.classList.toggle('has-sel',!!b);
  insp.innerHTML='';
  if(!b){
    const hp=el('div','hintpanel');
    hp.append(el('div','eyebrow','Building your timeline'));
    const ul=el('ul');
    for(const t of ['Tap an empty spot to add a block, then choose what kind of activity it was.','Add a short note if it helps, e.g. "Wrote intro section".','Drag a block to move it. Drag its top or bottom edge to change its length.','Blocks can’t overlap. Shorten a neighbour to make room.'])ul.append(el('li','',t));
    hp.append(ul);
    const lg=el('div','legend');for(const t of state.tags){const c=el('span','chip',t.name);c.style.setProperty('--h',t.hue);lg.append(c);}
    hp.append(el('div','eyebrow','Tags'),lg);
    const eb=btn('Edit tags','btn-sm');eb.onclick=openTagMgr;hp.append(eb);
    insp.append(hp);return;
  }
  const head=el('div','insp-head');head.append(el('h3','','Edit block'));
  const done=btn('Done','btn-sm btn-primary');done.onclick=()=>select(null);head.append(done);insp.append(head);

  const f3=field('What kind of activity?');const chips=el('div','chips');
  for(const t of state.tags){const c=btn(t.name,'chip'+(t.id===b.tagId?' on':''));c.style.setProperty('--h',t.hue);c.setAttribute('aria-pressed',t.id===b.tagId?'true':'false');c.onclick=()=>setTag(day,b,t.id,false);chips.append(c);}
  const edit=btn('Edit tags…','chip chip-ghost');edit.onclick=openTagMgr;chips.append(edit);
  f3.append(chips);insp.append(f3);

  const f1=field('Note (optional)');
  const ti=document.createElement('input');ti.id='insp-note';ti.value=b.note||'';ti.placeholder='Optional';ti.autocomplete='off';
  ti.addEventListener('input',()=>{b.note=ti.value;touch(day);save();const inline=lane.querySelector(`.block[data-id="${b.id}"] .b-note`);if(inline)inline.value=ti.value;});
  ti.addEventListener('keydown',e=>{if(e.key==='Enter')ti.blur();});
  f1.append(ti);insp.append(f1);

  const f2=field('When');const row=el('div','time-row');
  const st=timeSelect(0,1440-SNAP,b.start),e2=timeSelect(SNAP,1440,b.end);
  st.setAttribute('aria-label','Start time');e2.setAttribute('aria-label','End time');
  st.onchange=()=>{const {lower}=bounds(day,b);b.start=clamp(+st.value,lower,b.end-MIN_DUR);afterTimeChange(day,b);};
  e2.onchange=()=>{const {upper}=bounds(day,b);b.end=clamp(+e2.value,b.start+MIN_DUR,upper);afterTimeChange(day,b);};
  row.append(st,el('span','to','to'),e2);f2.append(row);insp.append(f2);

  const foot=el('div','insp-foot');const d1=btn('Delete block','btn-danger-ghost btn-sm');
  d1.onclick=()=>{foot.innerHTML='';foot.append(el('span','help','Delete this block?'));const y=btn('Delete','btn-danger btn-sm');y.onclick=()=>{day.blocks=day.blocks.filter(x=>x.id!==b.id);touch(day);save();sel=null;renderBlocks();renderInspector();};const n=btn('Keep','btn-sm');n.onclick=()=>renderInspector();foot.append(y,n);};
  foot.append(d1);insp.append(foot);
}
function afterTimeChange(day,b){
  if(b.start<day.startHour*60){day.startHour=0;renderExpand();renderHours();}
  touch(day);save();renderBlocks();renderInspector();
}

/* ---------- Tag manager ---------- */
const tagmgr=$('#tagmgr');
function openTagMgr(){tagmgr.hidden=false;renderTagList();setTimeout(()=>$('#tagNew').focus(),0);}
function closeTagMgr(){tagmgr.hidden=true;renderBlocks();renderInspector();}
$('#tagClose').onclick=closeTagMgr;$('#tagBackdrop').onclick=closeTagMgr;$('#editTags').onclick=openTagMgr;
function renderTagList(){
  const list=$('#tagList');list.innerHTML='';
  for(const t of state.tags){
    const r=el('div','tag-row');const dot=el('span','dot');dot.style.setProperty('--h',t.hue);
    const inp=document.createElement('input');inp.value=t.name;inp.setAttribute('aria-label','Tag name');
    inp.oninput=()=>{t.name=inp.value;save();};inp.onblur=()=>{if(!inp.value.trim()){t.name='Untitled tag';inp.value=t.name;save();}};
    const del=btn('Delete','btn-ghost btn-sm');
    del.onclick=()=>{if(del.dataset.arm){state.tags=state.tags.filter(x=>x.id!==t.id);for(const k in state.days)for(const b of state.days[k].blocks)if(b.tagId===t.id)b.tagId=null;save();renderTagList();return;}del.dataset.arm='1';del.textContent='Confirm';del.classList.add('btn-danger-ghost');setTimeout(()=>{if(del.dataset.arm){delete del.dataset.arm;del.textContent='Delete';del.classList.remove('btn-danger-ghost');}},3000);};
    r.append(dot,inp,del);list.append(r);
  }
}
function addTag(){const i=$('#tagNew');const n=i.value.trim();if(!n)return;state.tags.push({id:uid(),name:n,hue:HUES[state.tags.length%HUES.length]});i.value='';save();renderTagList();}
$('#tagAdd').onclick=addTag;$('#tagNew').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addTag();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tagmgr.hidden)closeTagMgr();});

/* ---------- Question rendering (background survey, day ratings, reflection) ---------- */
const isScaleQ=cfg=>cfg.type==='scale'||(cfg.type==null&&cfg.max!=null);
/* Renders one question into a .q element. `store` is the object holding answers; `onChange` runs after each edit. */
function questionEl(cfg,store,idPrefix,onChange){
  const q=el('div','q');q.id=idPrefix+'-'+cfg.key;q.append(el('div','lbl',cfg.label));
  if(isScaleQ(cfg)){
    const mount=el('div');
    const draw=()=>{mount.innerHTML='';mount.append(scaleRow(cfg,store[cfg.key]??null,v=>{store[cfg.key]=v;q.classList.remove('missing');onChange();draw();}));};
    draw();q.append(mount);
  }else{
    const ta=document.createElement('textarea');ta.value=store[cfg.key]||'';ta.id=idPrefix+'-input-'+cfg.key;ta.setAttribute('aria-label',cfg.label);
    if(cfg.placeholder)ta.placeholder=cfg.placeholder;
    ta.oninput=()=>{store[cfg.key]=ta.value;q.classList.remove('missing');onChange();};
    q.append(ta);
  }
  return q;
}
function renderForms(){
  const day=activeDay();
  const after=()=>{touch(day);save();renderDayChips();renderDayStatus();};
  const sc=$('#scales');sc.innerHTML='';
  for(const cfg of DAY_SCALES)sc.append(questionEl(cfg,day.ratings,'q',after));
  const rq=$('#reflectionQs');rq.innerHTML='';
  $('#reflection').hidden=!REFLECTION.length;
  for(const cfg of REFLECTION)rq.append(questionEl(cfg,day.reflection,'r',after));
}

/* ---------- Background survey (once per participant, sent with every day submission) ---------- */
const bgPanel=$('#background');
function bgMissing(){return BACKGROUND.filter(q=>{const v=state.background.answers[q.key];return isScaleQ(q)?v==null:!(v&&String(v).trim());});}
function renderBackground(){
  const bg=state.background;
  const wrap=$('#bgQs');wrap.innerHTML='';
  for(const cfg of BACKGROUND)wrap.append(questionEl(cfg,bg.answers,'bg',()=>{const d=activeDay();if(d){touch(d);renderDayChips();renderDayStatus();}save();renderBackgroundStatus();}));
  bgPanel.open=bgMissing().length>0;
  renderBackgroundStatus();
}
function renderBackgroundStatus(){
  const s=$('#bgStatus');const n=BACKGROUND.length,m=bgMissing().length;
  s.innerHTML=m===0?'<b>Answered</b>':m===n?'Not yet answered':`${n-m} of ${n} answered`;
}
function backgroundAnswers(){return Object.fromEntries(BACKGROUND.map(q=>[q.key,state.background.answers[q.key]??(isScaleQ(q)?null:'')]));}

/* ---------- Export ---------- */
function nameSlug(){return (state.name||'anon').trim().replace(/[^\w-]+/g,'_').slice(0,40)||'anon';}
function fileBase(day){return `day_${nameSlug()}_${day.date}`;}
function exportDay(day,submitCount){
  sortBlocks(day);
  return {
    schema:'day-reconstruction/2',name:state.name||null,date:day.date,
    submittedAt:new Date().toISOString(),submitCount:submitCount==null?day.submitCount:submitCount,
    exportedAt:new Date().toISOString(),
    blocks:day.blocks.map(b=>{const t=tagById(b.tagId);return {start:hhmm(b.start),end:hhmm(b.end),startMin:b.start,endMin:b.end,durationMin:b.end-b.start,tag:t?t.name:null,note:b.note||''};}),
    ratings:Object.fromEntries(DAY_SCALES.map(s=>[s.key,day.ratings[s.key]??null])),
    reflection:Object.fromEntries(REFLECTION.map(r=>[r.key,day.reflection[r.key]??(isScaleQ(r)?null:'')])),
    background:backgroundAnswers(),
    tags:state.tags.map(t=>t.name),
  };
}
let downloadsNs;
async function getDownloads(){
  if(downloadsNs!==undefined)return downloadsNs;
  try{downloadsNs=(window.claude&&typeof window.claude.use==='function')?await window.claude.use('downloads'):null;}catch(e){downloadsNs=null;}
  return downloadsNs;
}
async function saveFile(filename,data){
  const dl=await getDownloads();
  if(dl){
    try{await dl.save({filename,data});return 'saved';}
    catch(err){const c=err&&err.code;if(c==='declined')return 'declined';if(c==='rate_limited')return 'busy';return 'failed';}
  }
  try{
    const blob=data instanceof Blob?data:new Blob([data],{type:filename.endsWith('.json')?'application/json':'application/octet-stream'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);return 'maybe';
  }catch(e){return 'failed';}
}
function showData(obj){
  const box=$('#dataBox');box.hidden=false;$('#dataText').value=JSON.stringify(obj,null,2);$('#copyMsg').textContent='';
}
$('#copyBtn').onclick=async()=>{
  const ta=$('#dataText');const m=$('#copyMsg');
  try{await navigator.clipboard.writeText(ta.value);m.textContent='Copied.';}
  catch(e){ta.focus();ta.select();m.textContent='Select all and copy.';}
};
async function submitDay(){
  const day=activeDay();if(!day)return;
  const msg=$('#submitMsg');msg.className='msg';
  const problems=[];
  if(!state.name){problems.push('Enter your name at the top.');pidInput.classList.add('missing');}
  if(!day.blocks.length)problems.push('Add at least one block to your timeline.');
  const untagged=day.blocks.filter(b=>!b.tagId);
  if(untagged.length)problems.push('Choose a tag for every block ('+untagged.length+' still without one).');
  const missing=DAY_SCALES.filter(s=>day.ratings[s.key]==null);
  for(const s of missing){const q=$('#q-'+s.key);if(q)q.classList.add('missing');}
  if(missing.length)problems.push('Rate your day overall (the '+(missing.length===1?'question':'questions')+' outlined in red).');
  const bgMiss=bgMissing();
  for(const q of bgMiss){const e=$('#bg-'+q.key);if(e)e.classList.add('missing');}
  if(bgMiss.length){bgPanel.open=true;problems.push('Answer the "About your work" '+(bgMiss.length===1?'question':'questions')+' outlined in red.');}
  if(problems.length){msg.className='msg err';msg.textContent=problems.join(' ');
    if(untagged.length&&state.name&&day.blocks.length){select(untagged[0].id,{force:true});const u=lane.querySelector(`.block[data-id="${untagged[0].id}"]`);if(u)u.scrollIntoView({behavior:'smooth',block:'center'});return;}
    const first=!state.name?pidInput:(!day.blocks.length?tl:(missing.length?$('#q-'+missing[0].key):$('#bg-'+bgMiss[0].key)));if(first)first.scrollIntoView({behavior:'smooth',block:'center'});return;}
  const attemptCount=(day.submitCount||0)+1;
  const data=exportDay(day,attemptCount);
  if(SHEET_ENDPOINT){
    const sb=$('#submitBtn');sb.disabled=true;msg.textContent='Sending…';
    const ok=await postToSheet(data);
    sb.disabled=false;
    if(ok){
      day.submittedAt=Date.now();day.submitCount=attemptCount;
      if(day.lastEditedAt&&day.lastEditedAt>day.submittedAt)day.lastEditedAt=day.submittedAt;
      save();renderDayChips();renderDayStatus();
      msg.className='msg ok';msg.textContent='Submitted. Your answers have been sent to the study team. Thank you!';
      $('#dataBox').hidden=true;$('#dlDayBtn').hidden=true;bgPanel.open=false;return;
    }
    msg.className='msg err';msg.textContent='We couldn’t reach the server, so nothing was sent. Your answers are still saved on this device: check your connection and press Submit again, or download the file and email it to the study team.';
    $('#dlDayBtn').hidden=false;showData(data);return;
  }
  day.submittedAt=Date.now();day.submitCount=attemptCount;
  if(day.lastEditedAt&&day.lastEditedAt>day.submittedAt)day.lastEditedAt=day.submittedAt;
  save();renderDayChips();renderDayStatus();
  const res=await saveFile(fileBase(day)+'.json',JSON.stringify(data,null,2));
  showData(data);$('#dlDayBtn').hidden=false;
  if(res==='saved'||res==='maybe'){msg.className='msg ok';msg.textContent='Submitted. Your data file is '+fileBase(day)+'.json. Please send it to the study team.';}
  else if(res==='declined'){msg.className='msg err';msg.textContent='The download was cancelled. Press Submit again, or copy your data as text below.';}
  else{msg.className='msg err';msg.textContent='The download didn’t work here. Copy your data as text below.';}
}
async function postToSheet(data){
  const body=JSON.stringify(Object.assign({token:SHEET_TOKEN},data));
  try{
    /* text/plain keeps this a "simple" request (no CORS preflight), which is what Apps Script web apps accept. */
    const res=await fetch(SHEET_ENDPOINT,{method:'POST',body,headers:{'Content-Type':'text/plain;charset=utf-8'},redirect:'follow'});
    if(!res.ok)return false;
    const j=await res.json();return j&&j.ok===true;
  }catch(e){return false;}
}
$('#submitBtn').onclick=submitDay;
$('#dlDayBtn').onclick=async()=>{
  const day=activeDay();if(!day)return;const msg=$('#submitMsg');
  const data=exportDay(day,day.submitCount||0);
  const res=await saveFile(fileBase(day)+'.json',JSON.stringify(data,null,2));
  showData(data);
  msg.className=res==='declined'||res==='failed'?'msg err':'msg ok';
  msg.textContent=res==='declined'?'Download cancelled.':res==='failed'?'The download didn’t work here. Copy your data as text below.':'Downloaded '+fileBase(day)+'.json.';
};
$('#dlAll').onclick=async()=>{
  const all={schema:'day-reconstruction/all/2',name:state.name||null,exportedAt:new Date().toISOString(),background:backgroundAnswers(),days:dayKeys().map(k=>exportDay(state.days[k]))};
  const res=await saveFile(`day_${nameSlug()}_all.json`,JSON.stringify(all,null,2));
  if(activeDay()){showData(all);$('#dataBox').open=true;}
  toast(res==='declined'?'Download cancelled.':res==='failed'?'Download isn’t available here; copy the text instead.':'Download started.');
};
$('#clearAll').onclick=()=>{$('#clearConfirm').hidden=false;};
$('#clearNo').onclick=()=>{$('#clearConfirm').hidden=true;};
$('#clearYes').onclick=()=>{state=fresh();sel=null;try{localStorage.removeItem(STORAGE_KEY);}catch(e){}$('#clearConfirm').hidden=true;pidInput.value='';init();};

/* ---------- Toast ---------- */
let toastTimer=null;
function toast(text){const t=$('#toast');t.textContent=text;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},2600);}

/* ---------- Init ---------- */
function init(){
  if(!dayKeys().length){const k=localKey();state.days[k]=newDay(k);state.activeDay=k;}
  if(!state.activeDay||!state.days[state.activeDay]){const keys=dayKeys();state.activeDay=keys[keys.length-1];}
  save();renderBackground();renderDayChips();renderDay();
}
init();
})();
