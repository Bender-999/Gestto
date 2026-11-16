/* Lógica de La Hoja: lectura del texto de la IA, reparto del tiempo,
   objetivos, sesión con temporizador y estadísticas. Sin DOM: se puede probar con node --test. */
const LV={1:'Alta',2:'Media',3:'Baja',0:'Fuera'},LVIN={alta:1,media:2,baja:3,fuera:0};
const MIN_CHUNK=15,FAR='9999-12-31',FORMATO='hoja-carga/1';
function slug(x){return String(x||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)}
function newState(){return {app:{v:2,days:[],mode:'prio',defH:4,maxH:8,useRitmo:false,order:[],run:null,lastDay:'',closed:{},sched:{},brkH:10,standby:30},subs:{},log:{}}}
function addDays(d,n){const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}
function monday(d){const x=new Date(d+'T00:00:00Z');return addDays(d,-((x.getUTCDay()+6)%7))}
function minDate(...l){const v=l.filter(Boolean).sort();return v[0]||''}
const isDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'');

/* Horario
   Un horario es una lista de franjas {ini:'HH:MM', fin:'HH:MM'} sin solapes y ordenadas.
   El horario habitual vive en app.sched[0..6] (lunes = 0) como {slots:[...]}.
   Cada día del calendario puede llevar sus propias franjas en day.slots.
   Las horas de estudio descuentan app.brkH minutos de descanso por hora de estudio. */
const DAY_START=360,DAY_END=1440;
const toMin=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t||'');return m?+m[1]*60+ +m[2]:null};
const toTime=m=>{m=Math.round(m);return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const toClock=m=>{m=Math.round(m);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
function weekIdx(d){return (new Date(d+'T00:00:00Z').getUTCDay()+6)%7}
function brkK(app){return (60+(+app.brkH||0))/60}
function studyHours(app,ini,fin){
  const a=toMin(ini),b=toMin(fin);if(a===null||b===null||b<=a)return 0;
  return Math.round((b-a)/brkK(app)/60*4)/4;
}
function cleanSlots(slots){
  return (Array.isArray(slots)?slots:[]).map(x=>({ini:toMin(x.ini),fin:toMin(x.fin)})).filter(x=>x.ini!==null&&x.fin!==null&&x.fin>x.ini)
    .sort((a,b)=>a.ini-b.ini).reduce((o,x)=>{const p=o[o.length-1];if(p&&x.ini<p.fin){p.fin=Math.max(p.fin,x.fin)}else o.push(x);return o},[])
    .map(x=>({ini:toClock(x.ini),fin:toClock(x.fin)}));
}
function slotsHours(app,slots){return (slots||[]).reduce((a,x)=>a+studyHours(app,x.ini,x.fin),0)}
function schedSlots(app,i){const r=(app.sched||{})[i];return r&&Array.isArray(r.slots)?r.slots:[]}
function makeDay(app,d){
  const sl=schedSlots(app,weekIdx(d)),h=slotsHours(app,sl);
  if(h>0)return {d,h:Math.min(h,24),slots:sl.map(x=>({...x})),auto:true};
  return {d,h:Math.min(app.defH,app.maxH)};
}
/* Ajusta las franjas para que sumen h horas de estudio: estira o recorta la última franja y,
   si no cabe antes de las 24:00, adelanta la primera. h siempre queda como se pide. */
function withHours(app,x,h){
  const o={...x,h};
  if(!x.slots||!x.slots.length)return o;
  const k=brkK(app),sl=x.slots.map(s=>({ini:toMin(s.ini),fin:toMin(s.fin)}));
  let need=Math.round((h-slotsHours(app,x.slots))*60*k);
  while(need<0&&sl.length){const l=sl[sl.length-1],len=l.fin-l.ini;if(len+need>=15){l.fin+=need;need=0}else{need+=len;sl.pop()}}
  if(need>0&&sl.length){const l=sl[sl.length-1],add=Math.min(need,DAY_END-l.fin);l.fin+=add;need-=add}
  if(need>0&&sl.length){const f=sl[0],add=Math.min(need,f.ini-DAY_START);f.ini-=add}
  o.slots=sl.map(s=>({ini:toClock(Math.round(s.ini/5)*5),fin:toClock(Math.round(s.fin/5)*5)}));o.auto=true;
  return o;
}
/* Hora de reloj tras m minutos de estudio dentro de las franjas (con descansos). */
function clockAt(app,slots,m){
  const k=brkK(app);let left=m*k;
  for(const x of slots){const a=toMin(x.ini),b=toMin(x.fin),len=b-a;if(left<=len)return a+left;left-=len}
  const l=slots[slots.length-1];return toMin(l.fin)+left;
}
function dayBlocks(app,day,rows){
  const out=[],sl=day&&day.slots&&day.slots.length?day.slots:null;let t=0;
  for(const r of rows){
    let b=out[out.length-1];
    if(!b||b.sid!==r.it.sid){b={sid:r.it.sid,name:r.it.subName,m:0,rows:[],ini:sl?clockAt(app,sl,t+0.001):null,fin:null};out.push(b)}
    b.rows.push(r);b.m+=r.m;t+=r.m;
    if(sl)b.fin=clockAt(app,sl,t);
  }
  return out;
}
/* Datos guardados con la versión 1 (una franja por día con on/ini/fin) pasan a franjas. */
function migrateApp(app){
  if(!app)return app;
  const sc=app.sched||{},ns={};
  for(let i=0;i<7;i++){
    const r=sc[i]||sc[String(i)];
    if(r&&Array.isArray(r.slots))ns[i]={slots:cleanSlots(r.slots)};
    else if(r&&r.on&&r.ini&&r.fin)ns[i]={slots:cleanSlots([{ini:r.ini,fin:r.fin}])};
    else ns[i]={slots:[]};
  }
  app.sched=ns;
  app.days=(app.days||[]).map(x=>{
    if(x.slots){const o={...x,slots:cleanSlots(x.slots)};delete o.ini;delete o.fin;return o}
    const o={...x};delete o.ini;delete o.fin;
    if(x.ini&&x.fin&&toMin(x.fin)>toMin(x.ini))o.slots=[{ini:x.ini,fin:x.fin}];
    return o;
  });
  app.v=2;
  return app;
}

/* Lectura del texto */
function parseText(txt){
  const raw=String(txt||'');const a=raw.indexOf('{'),b=raw.lastIndexOf('}');
  if(a<0||b<=a)return {ok:false,errors:['No encuentro ningún bloque entre llaves { }. Pega el resultado completo de la IA.']};
  let o;try{o=JSON.parse(raw.slice(a,b+1))}catch(e){return {ok:false,errors:['El texto no es JSON válido: '+e.message+'. Pide a la IA que lo corrija.']}}
  if(Array.isArray(o.asignaturas)){
    const rs=o.asignaturas.map(normalize),e=rs.flatMap(r=>r.errors||[]);
    if(!rs.length)return {ok:false,errors:['La lista «asignaturas» está vacía.']};
    return e.length?{ok:false,errors:e}:{ok:true,subs:rs.map(r=>r.sub)};
  }
  const r=normalize(o);return r.ok?{ok:true,subs:[r.sub]}:r;
}
function normalize(o){
  const e=[],a=o.asignatura||o,lv=(v,d)=>{if(v===undefined||v===null||v==='')return d;const k=LVIN[String(v).toLowerCase()];if(k===undefined){e.push(`Prioridad desconocida: «${v}». Usa alta, media, baja o fuera.`);return d}return k};
  const dt=(v,w)=>{if(!v)return '';if(!isDate(v)){e.push(`${w}: la fecha «${v}» debe ir como AAAA-MM-DD.`);return ''}return v};
  if(!a.nombre)e.push('Falta el nombre de la asignatura o proyecto.');
  const id=slug(a.id||a.nombre);
  const s={id,nombre:String(a.nombre||''),tipo:a.tipo==='proyecto'?'proyecto':'asignatura',limite:dt(a.fecha_limite,'Fecha límite general'),prio:lv(a.prioridad,2),revDef:a.revision!==false,revPct:Math.max(0,+a.revision_reservada_pct||0),minDia:Math.max(0,+a.minimo_horas_dia||0),notas:String(a.notas||''),grupos:[]};
  if(a.grupos!==undefined&&!Array.isArray(a.grupos))e.push('«grupos» debe ser una lista.');
  const gids=new Set(),tids=new Set(),deps=[];
  (a.grupos||[]).forEach((g,gi)=>{
    const gn=g.nombre||('Grupo '+(gi+1)),gid=slug(g.id||gn);
    if(gids.has(gid))e.push(`Hay dos grupos con el identificador «${gid}».`);gids.add(gid);
    const tipo=['ejercicios','examen','bloque','recurrente'].includes(g.tipo)?g.tipo:'bloque';
    const G={id:gid,nombre:String(gn),tipo,prio:lv(g.prioridad,s.prio),freq:String(g.frecuencia||''),sim:!!g.simulacro,limite:dt(g.fecha_limite,`Grupo «${gn}»`),tareas:[]};
    if(tipo==='recurrente'){
      G.minSem=+g.minutos_por_semana||0;G.bloque=+g.minutos_por_bloque||60;G.det=String(g.detalle||'');G.rev=g.revision;
      if(G.minSem<=0)e.push(`Grupo recurrente «${gn}»: falta «minutos_por_semana».`);
      if(tids.has(gid))e.push(`Identificador repetido: «${gid}».`);tids.add(gid);
    }else{
      if(!Array.isArray(g.tareas)||!g.tareas.length)e.push(`Grupo «${gn}»: falta la lista «tareas».`);
      (g.tareas||[]).forEach((t,ti)=>{
        const tn=t.nombre||('Tarea '+(ti+1)),tid=slug(t.id||(gid+'-'+tn));
        if(tids.has(tid))e.push(`Identificador de tarea repetido: «${tid}».`);tids.add(tid);
        const min=+t.minutos;if(!(min>0))e.push(`Tarea «${tn}» de «${gn}»: «minutos» debe ser un número mayor que 0.`);
        const T={id:tid,nombre:String(tn),det:String(t.detalle||''),min:min||0,limite:dt(t.fecha_limite,`Tarea «${tn}»`),dep:(Array.isArray(t.depende_de)?t.depende_de:[]).map(slug)};
        if(t.prioridad!==undefined)T.prio=lv(t.prioridad,G.prio);
        if(t.revision===true||t.revision===false)T.rev=t.revision;
        if(t.dep_ok)T.dep_ok=true;
        G.tareas.push(T);T.dep.forEach(x=>deps.push([tid,x,tn]));
      });
    }
    s.grupos.push(G);
  });
  deps.forEach(([t,x,tn])=>{if(!tids.has(x))e.push(`Tarea «${tn}»: depende de «${x}», que no existe en esta asignatura.`)});
  const g=new Map();deps.forEach(([t,x])=>{if(!g.has(t))g.set(t,[]);g.get(t).push(x)});
  const seen=new Set(),path=new Set(),cyc=n=>{if(path.has(n))return true;if(seen.has(n))return false;seen.add(n);path.add(n);const r=(g.get(n)||[]).some(cyc);path.delete(n);return r};
  if([...g.keys()].some(cyc))e.push('Las dependencias forman un círculo: ninguna tarea podría empezar.');
  return e.length?{ok:false,errors:e}:{ok:true,sub:s};
}
function emptyProgress(){return {lvl:{},mins:{},done:{},real:{},target:'',pct:0,activa:true}}
function emptySub(nombre,limite){return {id:slug(nombre),nombre:String(nombre).trim(),tipo:'asignatura',limite:isDate(limite)?limite:'',prio:2,revDef:true,revPct:0,minDia:0,notas:'',grupos:[]}}
function taskCount(s){return s.grupos.reduce((a,g)=>a+(g.tipo==='recurrente'?1:g.tareas.length),0)}
function subState(S,s,today){
  if(s.activa===false)return 'pausa';
  const has=taskCount(s)>0,near=s.limite&&s.limite>=today&&s.limite<=addDays(today,+S.app.standby||30);
  if(has)return 'activa';
  return near?'sin-tareas':'espera';
}
function addManual(S,sid,o,now){
  const s=S.subs[sid];let g=s.grupos.find(x=>x.manual);
  if(!g){g={id:'manuales',nombre:'Añadidas a mano',tipo:'bloque',prio:s.prio,freq:'',sim:false,limite:'',tareas:[],manual:true};s.grupos.push(g)}
  const id='m-'+now.toString(36),t={id,nombre:String(o.nombre||'Tarea').trim(),det:o.det||'',min:+o.min||0,limite:'',dep:[],prio:o.prio??s.prio,manual:true};
  if(o.extra){t.extra=true;t.rev=false}
  g.tareas.push(t);return sid+'/'+id;
}
function removeManual(S,key){
  const [sid,id]=key.split('/'),s=S.subs[sid],g=s&&s.grupos.find(x=>x.manual);if(!g)return;
  g.tareas=g.tareas.filter(t=>t.id!==id);delete s.done[key];delete s.real[key];delete s.mins[key];delete s.lvl[key];
  if(!g.tareas.length)s.grupos=s.grupos.filter(x=>x!==g);
}
function taskIndex(s){const m=new Map();s.grupos.filter(g=>!g.manual).forEach(g=>{if(g.tipo==='recurrente')m.set(g.id,{nombre:g.nombre,min:g.minSem,g:g.nombre});g.tareas.forEach(t=>m.set(t.id,{nombre:t.nombre,min:t.min,g:g.nombre}))});return m}
function diffSub(old,nw){
  const a=old?taskIndex(old):new Map(),b=taskIndex(nw),added=[],removed=[],changed=[];
  for(const [k,v] of b){const o=a.get(k);if(!o)added.push(v.nombre);else if(o.min!==v.min)changed.push(`${v.nombre}: ${o.min} → ${v.min} min`)}
  for(const [k,v] of a)if(!b.has(k)){const key=old.id+'/'+k;removed.push({nombre:v.nombre,done:!!(old.done&&old.done[key])})}
  return {added,removed,changed,keep:[...b.keys()].filter(k=>a.has(k)).length};
}
function applySub(S,nw){
  const old=S.subs[nw.id],base=old?{lvl:old.lvl,mins:old.mins,done:old.done,real:old.real,target:old.target,pct:old.pct,activa:old.activa}:emptyProgress();
  if(old){const b=taskIndex(nw);for(const k of Object.keys(base.mins)){const id=k.split('/').slice(1).join('/');if(!b.has(id))delete base.mins[k]}}
  const man=old?old.grupos.filter(g=>g.manual):[];
  S.subs[nw.id]={...nw,...base,minDia:nw.minDia||(old&&old.minDia)||0,grupos:[...nw.grupos,...man]};
  if(!S.app.order.includes(nw.id))S.app.order.push(nw.id);
}

function exportSub(s){
  const lv=l=>({1:'alta',2:'media',3:'baja',0:'fuera'})[l];
  return {formato:FORMATO,asignatura:{id:s.id,nombre:s.nombre,tipo:s.tipo,prioridad:lv(s.prio),fecha_limite:s.limite||null,revision:s.revDef,revision_reservada_pct:s.revPct||0,notas:s.notas||undefined,minimo_horas_dia:s.minDia||undefined,grupos:s.grupos.filter(g=>!g.manual).map(g=>g.tipo==='recurrente'?{id:g.id,nombre:g.nombre,tipo:g.tipo,prioridad:lv(g.prio),minutos_por_semana:g.minSem,minutos_por_bloque:g.bloque,detalle:g.det||undefined}:{id:g.id,nombre:g.nombre,tipo:g.tipo,prioridad:lv(g.prio),frecuencia:g.freq||undefined,simulacro:g.sim||undefined,fecha_limite:g.limite||undefined,tareas:g.tareas.map(t=>({id:t.id,nombre:t.nombre,detalle:t.det||undefined,minutos:+s.mins[s.id+'/'+t.id]||t.min,prioridad:t.prio===undefined?undefined:lv(t.prio),fecha_limite:t.limite||undefined,depende_de:t.dep.length?t.dep:undefined,revision:t.rev}))})}};
}

/* Tareas */
function allSegs(S){return Object.keys(S.log).sort().flatMap(k=>S.log[k])}
function weeksOf(S){return [...new Set(S.app.days.map(x=>monday(x.d)))].sort()}
function buildItems(S,today){
  const out=[],active=S.app.order.filter(id=>S.subs[id]&&S.subs[id].activa!==false);
  const rank=[...active].sort((a,b)=>S.subs[a].prio-S.subs[b].prio||S.app.order.indexOf(a)-S.app.order.indexOf(b));
  for(const sid of active){
    const s=S.subs[sid],sr=rank.indexOf(sid);
    s.grupos.forEach((g,gi)=>{
      const lim=minDate(g.limite,s.limite),gk=sid+'/g:'+g.id;
      const base={sid,subName:s.nombre,gid:g.id,gName:g.nombre,gi,sr};
      if(g.tipo==='recurrente'){
        for(const w of weeksOf(S)){
          const n=Math.max(1,Math.ceil(g.minSem/g.bloque));
          for(let k=0;k<n;k++){
            const key=`${sid}/${g.id}@${w}#${k+1}`,m=k<n-1?g.bloque:g.minSem-g.bloque*(n-1),done=s.done[key];
            const limit=minDate(addDays(w,7),lim);
            if(!done&&limit<=today)continue;
            out.push({...base,key,ti:k,name:`${g.nombre} · ${k+1} de ${n}`,det:g.det||'Bloque de la semana del '+w.slice(8)+'/'+w.slice(5,7),m:+s.mins[key]||m,base:m,lvl:s.lvl[gk]??g.prio,limit,notBefore:w,deps:[],rev:g.rev??s.revDef,done:done||''});
          }
        }
      }else if(g.sim){
        const pend=g.tareas.filter(t=>!s.done[sid+'/'+t.id]),list=pend.length?pend:g.tareas,m=list.reduce((a,t)=>a+(+s.mins[sid+'/'+t.id]||t.min),0);
        out.push({...base,key:gk,ti:0,unit:true,children:list.map(t=>sid+'/'+t.id),name:g.nombre+' · simulacro',det:list.length+' partes con un solo temporizador',m,base:m,lvl:s.lvl[gk]??g.prio,limit:lim,notBefore:'',deps:[],rev:s.revDef,done:pend.length?'':(s.done[sid+'/'+g.tareas[0].id]||'x')});
      }else g.tareas.forEach((t,ti)=>{
        const key=sid+'/'+t.id;
        out.push({...base,key,ti,name:g.nombre+' · '+t.nombre,det:t.det,m:+s.mins[key]||t.min,base:t.min,lvl:s.lvl[key]??t.prio??g.prio,limit:minDate(t.limite,lim),notBefore:'',deps:t.dep.map(x=>sid+'/'+x),rev:t.rev??s.revDef,done:s.done[key]||'',libre:!!t.extra&&!t.min,extra:!!t.extra,manual:!!t.manual});
      });
    });
  }
  return out;
}
function cmpItems(a,b){return a.lvl-b.lvl||(a.limit||FAR).localeCompare(b.limit||FAR)||a.sr-b.sr||a.gi-b.gi||a.ti-b.ti}
function pace(S,sid){
  let e=0,r=0;const s=S.subs[sid];if(!s)return {ritmo:1,logged:false};
  for(const it of buildItems(S,'0000-00-00'))if(it.sid===sid&&it.done&&s.real[it.key]){e+=it.m;r+=s.real[it.key]}
  return {ritmo:e?r/e:1,logged:e>0};
}
function allocate(S,today,opt){
  opt=opt||{};
  const app=S.app,src=opt.days||app.days,days=[...src].sort((a,b)=>a.d<b.d?-1:1).map(x=>({d:x.d,h:+x.h||0,closed:!!app.closed[x.d]||x.d<today}));
  const segs=allSegs(S),study={},spent={};
  const subDay={};
  for(const x of segs){if(x.t!=='d'&&x.t!=='r')continue;const m=(x.e-x.s)/60000;study[x.d]=(study[x.d]||0)+m;spent[x.k]=(spent[x.k]||0)+m;subDay[x.d+'|'+x.a]=(subDay[x.d+'|'+x.a]||0)+m}
  const rem={},plan={},orphan=[];
  days.forEach(x=>{rem[x.d]=x.closed?0:Math.max(0,x.h*60-Math.round(study[x.d]||0));plan[x.d]=[]});
  const items=buildItems(S,today),factor={};
  for(const sid of app.order)factor[sid]=app.useRitmo?pace(S,sid).ritmo:1;
  const doneKeys=new Set();
  for(const it of items){
    if(!it.done)continue;doneKeys.add(it.key);
    const s=S.subs[it.sid],m=+s.real[it.key]||it.m,row={it,m,part:0,parts:1,done:true};
    if(plan[it.done]){plan[it.done].push(row);const dd=days.find(x=>x.d===it.done);if(!dd.closed&&!study[it.done])rem[it.done]=Math.max(0,rem[it.done]-m)}else orphan.push(row);
  }
  const cap=Object.values(rem).reduce((a,b)=>a+b,0);
  const pend=items.filter(i=>!i.done&&i.lvl>0&&!i.libre).sort(cmpItems).map(it=>{
    const s=S.subs[it.sid],b=Math.round(it.m*(1+(s.revPct||0)/100)*factor[it.sid]);
    let q=spent[it.key]||0;
    const left=q?Math.max(5,Math.round(b-q)):b;
    return {it:{...it},total:left,left};
  });
  const byKey=new Map(pend.map(p=>[p.it.key,p]));
  for(let i=0,ch=true;ch&&i<pend.length;i++){ch=false;for(const p of pend)for(const k of p.it.deps){const q=byKey.get(k);if(q&&p.it.limit&&(!q.it.limit||p.it.limit<q.it.limit)){q.it.limit=p.it.limit;ch=true}}}
  pend.sort((a,b)=>cmpItems(a.it,b.it));
  const open=days.filter(x=>!x.closed).map(x=>x.d),chunks=new Map();
  const depsOk=p=>p.it.deps.every(k=>{const q=byKey.get(k);return !q||q.left===0});
  const elig=(p,d,r)=>p.left>0&&(!p.it.notBefore||p.it.notBefore<=d)&&(!p.it.limit||d<p.it.limit)&&depsOk(p)&&(p.it.unit?r>=p.left:r>=Math.min(MIN_CHUNK,p.left));
  const take=(p,d,n)=>{plan[d].push({it:p.it,m:n,total:p.total,part:0,parts:1});p.left-=n;rem[d]-=n;if(!chunks.has(p.it.key))chunks.set(p.it.key,[]);chunks.get(p.it.key).push(plan[d][plan[d].length-1])};
  const srOf={},warn={},sids=app.order.filter(id=>S.subs[id]&&S.subs[id].activa!==false);
  items.forEach(i=>{srOf[i.sid]=i.sr});
  const ranked=[...sids].sort((x,y)=>(srOf[x]??99)-(srOf[y]??99));
  const lims=[...new Set(pend.map(p=>p.it.limit).filter(Boolean))].sort();
  const fill=(sid,b,d,reserve)=>{
    let guard=300;
    while(b>=1&&guard--){
      const r=rem[d]-reserve,p=pend.find(x=>x.it.sid===sid&&elig(x,d,r));
      if(!p)break;
      const n=Math.min(p.left,r);if(n<=0)break;
      take(p,d,n);b-=n;
    }
  };
  open.forEach((d,oi)=>{
    const act=ranked.filter(id=>pend.some(p=>p.it.sid===id&&elig(p,d,rem[d])));
    let budget=act.map(id=>Math.max(0,(+S.subs[id].minDia||0)*60-(subDay[d+'|'+id]||0)));
    const tot=budget.reduce((a,b)=>a+b,0);
    if(tot>rem[d]+.5){warn[d]={tot,cap:rem[d],subs:act.filter((_,i)=>budget[i]>0)};budget=act.map(()=>0)}
    if(app.mode==='pct'){
      const extra=rem[d]-budget.reduce((a,b)=>a+b,0),w=act.map(id=>+S.subs[id].pct||0),tw=w.reduce((a,b)=>a+b,0);
      budget=budget.map((b,i)=>b+(tw?extra*w[i]/tw:extra/(act.length||1)));
    }
    act.forEach((id,i)=>fill(id,budget[i],d,budget.slice(i+1).reduce((a,b)=>a+b,0)));
    if(app.mode==='pct'){
      for(let round=0;round<8&&rem[d]>=MIN_CHUNK;round++){
        const a2=ranked.filter(id=>pend.some(p=>p.it.sid===id&&elig(p,d,rem[d])));
        if(!a2.length)break;
        const pool=rem[d],w=a2.map(id=>+S.subs[id].pct||0),tw=w.reduce((a,b)=>a+b,0);
        a2.forEach((id,i)=>fill(id,Math.max(MIN_CHUNK,tw?pool*w[i]/tw:pool/a2.length),d,0));
        if(rem[d]===pool)break;
      }
      return;
    }
    let guard=500;
    while(rem[d]>=MIN_CHUNK&&guard--){
      let D='',slack=Infinity;
      for(const L of lims){
        const work=pend.reduce((a,p)=>a+(p.it.lvl<=2&&p.it.limit&&p.it.limit<=L?p.left:0),0);
        if(!work)continue;
        let c=0;for(let j=oi;j<open.length;j++)if(open[j]<L)c+=rem[open[j]];
        slack=Math.min(slack,c-work);
        if(c-work<MIN_CHUNK){D=L;break}
      }
      let p=D?pend.filter(x=>x.it.limit&&x.it.limit<=D).sort((a,b)=>cmpItems(a.it,b.it)).find(x=>elig(x,d,rem[d])):null;
      const urgent=!!p;
      if(!p)p=pend.find(x=>elig(x,d,rem[d]));
      if(!p)break;
      take(p,d,Math.min(p.left,rem[d],urgent||p.it.unit?Infinity:Math.max(MIN_CHUNK,slack)));
    }
  });
  const dayList=days.map(x=>x.d);
  for(const d of open){
    const first=[...new Set(plan[d].map(r=>r.it.sid))].sort((x,y)=>(srOf[x]??99)-(srOf[y]??99)),merged=[];
    for(const r of plan[d]){const o=merged.find(y=>y.it.key===r.it.key&&!y.done&&!r.done);if(o){o.m+=r.m;const c=chunks.get(r.it.key);c.splice(c.indexOf(r),1)}else merged.push(r)}
    plan[d]=first.flatMap(sid=>merged.filter(r=>r.it.sid===sid));
  }
  for(const [,c] of chunks){c.sort((a,b)=>0);if(c.length>1)c.forEach((r,i)=>{r.part=i+1;r.parts=c.length;r.nextDay=null})}
  for(const d of dayList)for(const r of plan[d])if(r.part&&r.part<r.parts){const c=chunks.get(r.it.key),nx=c[r.part];r.nextDay=dayList.find(x=>plan[x].includes(nx))}
  const lost=pend.filter(p=>p.left>0).map(p=>({it:p.it,left:p.left,late:!!p.it.limit&&open.some(d=>d>=p.it.limit)}));
  const late=lost.filter(l=>l.late);
  return {days,plan,rem,cap,pend,lost,late,orphan,items,spent,study,byKey,warn};
}

/* Objetivos */
function ladder(S,sid,al){
  const list=al.pend.filter(p=>p.it.sid===sid).sort((a,b)=>cmpItems(a.it,b.it)),rows=[];let cum=0,miss=0;
  for(const p of list){
    const key=p.it.gid+':'+p.it.lvl;let r=rows[rows.length-1];
    if(!r||r.key!==key){r={key,gid:p.it.gid,name:p.it.gName,lvl:p.it.lvl,n:0,ok:0,m:0,cum:0,miss:0};rows.push(r)}
    r.n++;r.m+=p.total;cum+=p.total;r.cum=cum;if(p.left===0)r.ok++;miss+=p.left;r.miss=miss;
  }
  return rows;
}
function targetRow(s,rows){if(!rows.length)return null;return rows.find(r=>r.key===s.target)||[...rows].reverse().find(r=>r.lvl<=2)||rows[rows.length-1]}
function objectives(S,al){
  const out=[];let need=0,miss=0;
  for(const sid of S.app.order){
    const s=S.subs[sid];if(!s||s.activa===false)continue;
    const rows=ladder(S,sid,al),t=targetRow(s,rows),n=t?t.cum:0,m=t?t.miss:0;
    out.push({sid,s,rows,t,need:n,miss:m,ok:rows.filter(r=>r.ok===r.n).length});need+=n;miss+=m;
  }
  return {list:out,need,miss};
}
function okWith(S,today,days){return objectives(S,allocate(S,today,{days})).miss===0}
function changes(from,to){
  const ch=[];
  for(const x of [...to].sort((a,b)=>a.d<b.d?-1:1)){const o=from.find(y=>y.d===x.d);if(!o)ch.push({d:x.d,from:0,to:x.h});else if(o.h!==x.h)ch.push({d:x.d,from:o.h,to:x.h})}
  return ch;
}
function proposeStretch(S,today){
  const maxH=+S.app.maxH||8,base=S.app.days,can=x=>x.d>=today&&!S.app.closed[x.d];
  const at=L=>base.map(x=>can(x)&&x.h<maxH?withHours(S.app,x,Math.max(x.h,Math.min(maxH,L))):{...x});
  if(!okWith(S,today,at(maxH)))return {ok:false,days:at(maxH),changes:changes(base,at(maxH))};
  let lo=0,hi=Math.round(maxH*4);
  while(hi-lo>1){const m=(lo+hi)>>1;if(okWith(S,today,at(m/4)))hi=m;else lo=m}
  const d=at(hi/4);return {ok:true,days:d,changes:changes(base,d)};
}
function proposeNew(S,today){
  const base=S.app.days,defH=Math.min(+S.app.defH||4,+S.app.maxH||8);
  const lims=S.app.order.map(i=>S.subs[i]&&S.subs[i].activa!==false&&S.subs[i].limite).filter(Boolean).sort();
  const end=lims[lims.length-1]||addDays(today,60),free=[];
  for(let d=addDays(today,1);d<end&&free.length<90;d=addDays(d,1))if(!base.some(x=>x.d===d))free.push(d);
  const at=(k,lastH)=>[...base.map(x=>({...x})),...free.slice(0,k).map((d,i)=>{const n=makeDay(S.app,d);return i===k-1&&lastH?withHours(S.app,n,Math.min(lastH,n.h)):n})];
  if(!free.length||!okWith(S,today,at(free.length)))return {ok:false,days:at(free.length),changes:changes(base,at(free.length))};
  let lo=0,hi=free.length;
  while(hi-lo>1){const m=(lo+hi)>>1;if(okWith(S,today,at(m)))hi=m;else lo=m}
  let a=0,b=Math.round(makeDay(S.app,free[hi-1]).h*4);
  while(b-a>1){const m=(a+b)>>1;if(okWith(S,today,at(hi,m/4)))b=m;else a=m}
  const d=at(hi,b/4);return {ok:true,days:d,changes:changes(base,d)};
}

/* Sesión */
function findItem(S,key,today){return buildItems(S,today).find(i=>i.key===key)||null}
function nextKey(S,today,prev,skip){
  const al=allocate(S,today),rows=(al.plan[today]||[]).filter(r=>!r.done&&r.it.key!==skip),cur=prev&&rows.find(r=>r.it.sid===prev);
  if(cur)return cur.it;
  if(rows[0])return rows[0].it;

  const p=al.pend.find(x=>x.it.key!==skip&&(!x.it.notBefore||x.it.notBefore<=today)&&(!x.it.limit||today<x.it.limit));
  return p?p.it:null;
}
function pushSeg(S,seg){const k=seg.d.slice(0,7);(S.log[k]=S.log[k]||[]).push(seg)}
function closeSeg(S,now){
  const r=S.app.run;if(!r||!['do','review','break','pause'].includes(r.phase))return;
  const e=Math.max(now,r.since);
  if(e>r.since)pushSeg(S,{t:{do:'d',review:'r',break:'b',pause:'p'}[r.phase],k:r.key,a:r.sid,d:r.day,s:r.since,e});
}
function startDay(S,day,now){
  if(S.app.run)return;
  if(!S.app.days.some(x=>x.d===day))S.app.days.push(makeDay(S.app,day));
  delete S.app.closed[day];
  const it=nextKey(S,day,null);
  S.app.run={day,phase:it?'do':'free',key:it?it.key:'',sid:it?it.sid:'',since:now,back:null};
}
function goBreak(S,now){const r=S.app.run;if(!r||r.phase==='break'||r.phase==='free'||r.phase==='pause')return;closeSeg(S,now);r.back=r.phase;r.phase='break';r.since=now}
function resumeWork(S,now){const r=S.app.run;if(!r||r.phase!=='break')return;closeSeg(S,now);r.phase=r.back;r.back=null;r.since=now}
function goPause(S,now){const r=S.app.run;if(!r||r.phase==='pause')return;closeSeg(S,now);r.pb={phase:r.phase,back:r.back};r.phase='pause';r.back=null;r.since=now}
function unpause(S,now){const r=S.app.run;if(!r||r.phase!=='pause')return;closeSeg(S,now);r.phase=r.pb.phase;r.back=r.pb.back;r.pb=null;r.since=now}
function carryOver(S,today,now){
  const r=S.app.run;if(!r)return;
  if(!S.app.days.some(x=>x.d===today))S.app.days.push(makeDay(S.app,today));
  S.app.closed[r.day]=true;delete S.app.closed[today];r.day=today;
  if(r.phase==='pause'||r.phase==='break'){const b=r.pb?r.pb.phase:r.back;r.phase=b&&b!=='break'?b:(r.pb&&r.pb.back)||'do';r.back=null;r.pb=null}
  r.since=now;
}
function freeLog(S,r){return allSegs(S).filter(x=>x.k===r.key&&(x.t==='d'||x.t==='r')).reduce((a,x)=>a+(x.e-x.s)/60000,0)}
function closeLibre(S){const r=S.app.run;if(!r||!r.key)return;const it=findItem(S,r.key,r.day);if(it&&it.libre&&!it.done){const m=freeLog(S,r);if(m>0)markDone(S,it,r.day,m);else removeManual(S,r.key)}}
function startExtra(S,sid,nombre,now){
  const r=S.app.run;if(!r)return;closeSeg(S,now);closeLibre(S);
  const key=addManual(S,sid,{nombre,extra:true},now);
  r.key=key;r.sid=sid;r.phase='do';r.back=null;r.pb=null;r.since=now;
}
function markDone(S,it,day,mins){
  const s=S.subs[it.sid];
  if(it.unit){const keys=it.children,t=keys.reduce((a,k)=>a+(+s.mins[k]||0),0);keys.forEach(k=>{s.done[k]=day;if(mins)s.real[k]=Math.max(1,Math.round(mins/keys.length))});if(mins)s.real[it.key]=Math.max(1,Math.round(mins))}
  else{s.done[it.key]=day;if(mins)s.real[it.key]=Math.max(1,Math.round(mins))}
}
function unmarkDone(S,it){const s=S.subs[it.sid];(it.unit?it.children:[it.key]).forEach(k=>{delete s.done[k]});delete s.real[it.key]}
function finishTask(S,now){
  const r=S.app.run,it=findItem(S,r.key,r.day);
  if(it){const total=freeLog(S,r);markDone(S,it,r.day,total)}
  const n=nextKey(S,r.day,r.sid);
  r.key=n?n.key:'';r.sid=n?n.sid:'';r.phase=n?'do':'free';r.back=null;r.since=now;
}
function nextStep(S,now){
  const r=S.app.run;if(!r)return;
  if(r.phase==='break'){closeSeg(S,now);r.phase=r.back;r.back=null;r.since=now}
  const it=findItem(S,r.key,r.day);
  if(r.phase==='do'){closeSeg(S,now);if(it&&it.rev){r.phase='review';r.since=now}else finishTask(S,now)}
  else if(r.phase==='review'){closeSeg(S,now);finishTask(S,now)}
}
function endDay(S,now){const r=S.app.run;if(!r)return;closeSeg(S,now);closeLibre(S);S.app.closed[r.day]=true;S.app.lastDay=r.day;S.app.run=null}
function discardRun(S){const r=S.app.run;if(!r)return;closeLibre(S);S.app.closed[r.day]=true;S.app.lastDay=r.day;S.app.run=null}
function switchTask(S,key,now){const r=S.app.run;if(!r)return;closeSeg(S,now);closeLibre(S);r.pb=null;r.key=key;r.sid=key.split('/')[0];r.phase='do';r.back=null;r.since=now}
function trimRun(S,mins,now){const r=S.app.run;if(r)r.since=Math.min(now,r.since+mins*60000)}
function clock(S,now,today){
  const r=S.app.run,cur=r?Math.max(0,now-r.since):0;let doM=0,rev=0,sDay=0,bDay=0;
  for(const x of allSegs(S)){
    const ms=x.e-x.s;
    if(r&&x.k===r.key){if(x.t==='d')doM+=ms;if(x.t==='r')rev+=ms}
    if(r&&x.d===r.day){if(x.t==='b')bDay+=ms;else if(x.t!=='p')sDay+=ms}
  }
  if(r){if(r.phase==='do'){doM+=cur;sDay+=cur}if(r.phase==='review'){rev+=cur;sDay+=cur}if(r.phase==='break')bDay+=cur}
  const it=r&&r.key?findItem(S,r.key,r.day):null;
  return {cur,doM,rev,sDay,bDay,left:it?it.m*60000-doM:0,it};
}
function fmtClock(ms){
  const a=Math.floor(Math.abs(ms)/1000),h=Math.floor(a/3600),m=Math.floor(a/60)%60,x=a%60,p=n=>String(n).padStart(2,'0');
  return (ms<0&&a>0?'−':'')+(h?h+':'+p(m):p(m))+':'+p(x);
}

/* Datos */
function stats(S,today,now,scope){
  const c={log:{},app:{run:S.app.run&&{...S.app.run}}};
  for(const k of Object.keys(S.log))c.log[k]=[...S.log[k]];
  if(c.app.run)closeSeg(c,now);
  let log=allSegs(c).sort((a,b)=>a.s-b.s);
  if(scope)log=log.filter(x=>x.a===scope);
  const dmap={},day=d=>dmap[d]||(dmap[d]={d,plan:0,dom:0,rev:0,brk:0,tasks:0,logged:false,bySub:{}});
  if(!scope)for(const x of S.app.days)day(x.d).plan=(+x.h||0)*60;
  const stints=[],breaks=[];let cur=0,pd=null,paus=0;const m=x=>(x.e-x.s)/60000;
  for(const x of log){
    const o=day(x.d);o.logged=true;
    if(x.t==='p'){paus+=m(x);continue}
    if(x.t==='b'){o.brk+=m(x);breaks.push(m(x));if(cur)stints.push(cur);cur=0}
    else{if(pd&&pd!==x.d&&cur){stints.push(cur);cur=0}cur+=m(x);if(x.t==='d')o.dom+=m(x);else o.rev+=m(x);o.bySub[x.a]=(o.bySub[x.a]||0)+m(x)}
    pd=x.d;
  }
  if(cur)stints.push(cur);
  const items=buildItems(S,'0000-00-00').filter(i=>!scope||i.sid===scope);
  const sum=(l,f)=>l.reduce((a,x)=>a+f(x),0),rows={};let over=0,nt=0,estT=0,domT=0,extraMin=0,extraN=0;
  for(const it of items){
    if(!it.done)continue;if(dmap[it.done]||it.done!=='x')day(it.done).tasks+=it.unit?1:1;
    const l=log.filter(x=>x.k===it.key&&(x.t==='d'||x.t==='r'));if(!l.length)continue;
    const d=sum(l.filter(x=>x.t==='d'),m),r=sum(l.filter(x=>x.t==='r'),m);
    if(it.extra){extraMin+=d+r;extraN++;continue}
    const nm=scope?it.gName:it.subName,o=rows[nm]||(rows[nm]={name:nm,n:0,est:0,dom:0,rev:0});
    o.n++;o.est+=it.m;o.dom+=d;o.rev+=r;nt++;estT+=it.m;domT+=d;if(d>it.m)over++;
  }
  const days=Object.values(dmap).sort((a,b)=>a.d<b.d?-1:1),counted=days.filter(o=>o.d<today||S.app.closed[o.d]||o.logged);
  const dom=sum(days,o=>o.dom),rev=sum(days,o=>o.rev),brk=sum(days,o=>o.brk),bySub={};
  for(const x of log)if(x.t==='d'||x.t==='r')bySub[x.a]=(bySub[x.a]||0)+m(x);
  return {days,dom,rev,brk,paus,extraMin,extraN,study:dom+rev,planned:sum(counted,o=>o.plan),stints,breaks,rows:Object.values(rows),over,nt,estT,domT,bySub,
    meanStint:stints.length?sum(stints,x=>x)/stints.length:0,maxStint:stints.length?Math.max(...stints):0,meanBreak:breaks.length?sum(breaks,x=>x)/breaks.length:0};
}
function fmt(m){m=Math.round(Math.abs(m));const h=Math.floor(m/60),n=m%60;return h&&n?h+' h '+String(n).padStart(2,'0'):h?h+' h':n+' min'}
function dec(x,d){return x.toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d})}
function nh(x){return x%1?dec(x,2).replace(/0$/,''):String(x)}
function hh(x){return nh(x)+' h'}


export {DAY_START,DAY_END,FAR,FORMATO,LVIN,LV,MIN_CHUNK,addDays,addManual,allSegs,allocate,applySub,brkK,buildItems,carryOver,changes,cleanSlots,clock,clockAt,closeLibre,closeSeg,cmpItems,dayBlocks,dec,diffSub,discardRun,emptyProgress,emptySub,endDay,exportSub,findItem,finishTask,fmt,fmtClock,freeLog,goBreak,goPause,hh,isDate,ladder,makeDay,markDone,migrateApp,minDate,monday,newState,nextKey,nextStep,nh,normalize,objectives,okWith,pace,parseText,proposeNew,proposeStretch,pushSeg,removeManual,resumeWork,schedSlots,slotsHours,slug,startDay,startExtra,stats,studyHours,subState,switchTask,targetRow,taskCount,taskIndex,toClock,toMin,toTime,trimRun,unmarkDone,unpause,weekIdx,weeksOf,withHours};
