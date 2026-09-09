// AEVUM — interactions, no libraries
(function(){
  "use strict";
  const $ = (s,c=document)=>c.querySelector(s);
  const $$ = (s,c=document)=>[...c.querySelectorAll(s)];

  /* Preloader */
  const pre = $('#preloader'), bar = $('#loadBar');
  let p = 0;
  const tick = setInterval(()=>{
    p = Math.min(100, p + Math.random()*22);
    bar.style.width = p + '%';
    if(p>=100){ clearInterval(tick); setTimeout(()=>pre.classList.add('done'), 350); }
  }, 160);

  /* Cursor glow */
  const glow = $('#cursorGlow');
  addEventListener('pointermove', e=>{
    glow.style.left = e.clientX+'px'; glow.style.top = e.clientY+'px';
  }, {passive:true});

  /* Nav hide + burger */
  const nav = $('#nav'), burger = $('#burger'), mMenu = $('#mobileMenu');
  let lastY = 0;
  addEventListener('scroll', ()=>{
    const y = scrollY;
    nav.classList.toggle('hide', y>400 && y>lastY);
    lastY = y;
  }, {passive:true});
  burger.addEventListener('click', ()=>{
    const open = mMenu.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
  });
  mMenu.addEventListener('click', e=>{ if(e.target.closest('a')) mMenu.classList.remove('open'); });

  /* Build minute track + batons on hero SVG */
  (function buildDial(){
    const mt = $('#minuteTrack'), bat = $('#batons');
    if(!mt) return;
    const NS='http://www.w3.org/2000/svg';
    for(let i=0;i<60;i++){
      const a = i*6*Math.PI/180, big=i%5===0;
      const r1 = big?104:109, r2=112;
      const l=document.createElementNS(NS,'line');
      l.setAttribute('x1',200+r1*Math.sin(a)); l.setAttribute('y1',280-r1*Math.cos(a));
      l.setAttribute('x2',200+r2*Math.sin(a)); l.setAttribute('y2',280-r2*Math.cos(a));
      l.setAttribute('stroke-width',big?2:1); l.setAttribute('opacity',big?.95:.45);
      l.setAttribute('stroke','#cbb37e'); mt.appendChild(l);
    }
    [20,40,50,55,65,70,80,100,110,130,140,160].forEach(deg=>{
      const a=deg*Math.PI/180, r=94;
      const rect=document.createElementNS(NS,'rect');
      rect.setAttribute('x',-3); rect.setAttribute('y',-12);
      rect.setAttribute('width',6); rect.setAttribute('height',16); rect.setAttribute('rx',1.5);
      rect.setAttribute('transform',`translate(${200+r*Math.sin(a)} ${280-r*Math.cos(a)}) rotate(${deg})`);
      bat.appendChild(rect);
    });
  })();

  /* Live time — hero hands + caption + date */
  const hH=$('#hourHand'), mH=$('#minHand'), sH=$('#secHand'), sub=$('#subHand'), heroT=$('#heroTime');
  function liveTime(){
    const n=new Date();
    const ms=n.getMilliseconds(), s=n.getSeconds()+ms/1000, m=n.getMinutes()+s/60, h=(n.getHours()%12)+m/60;
    if(sH) sH.style.transform=`rotate(${s*6}deg)`;
    if(mH) mH.style.transform=`rotate(${m*6}deg)`;
    if(hH) hH.style.transform=`rotate(${h*30}deg)`;
    if(sub) sub.style.transform=`rotate(${(s*6*2)%360}deg)`;
    if(heroT) heroT.textContent=n.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const d=$('#dateNum'); if(d) d.textContent=n.getDate();
    requestAnimationFrame(liveTime);
  }
  requestAnimationFrame(liveTime);

  /* Reveal on scroll + counters + bars */
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    if(!e.isIntersecting) return;
    e.target.classList.add('in');
    $$('[data-count]',e.target.parentElement||document).forEach(()=>{});
    io.unobserve(e.target);
  }),{threshold:.15});
  $$('.reveal').forEach(el=>io.observe(el));

  const cio=new IntersectionObserver(es=>es.forEach(e=>{
    if(!e.isIntersecting) return;
    const el=e.target, end=+el.dataset.count; let cur=0;
    const step=Math.max(1,Math.round(end/60));
    const t=setInterval(()=>{ cur=Math.min(end,cur+step); el.textContent=cur; if(cur>=end) clearInterval(t); },30);
    cio.unobserve(el);
  }),{threshold:.6});
  $$('[data-count]').forEach(el=>cio.observe(el));

  const bio=new IntersectionObserver(es=>es.forEach(e=>{
    if(e.isIntersecting){ $$('.bar span',e.target).forEach(s=>s.style.width=s.dataset.w+'%'); bio.unobserve(e.target); }
  }),{threshold:.4});
  const bars=$('.bars'); if(bars) bio.observe(bars);

  /* Tabs — calibre */
  const calData={
    bridge:{t:'Hand-bevelled bridge',d:'Solid German silver, frosted by hand, bevels polished to a black mirror. Signed by its finisher.',x:0},
    esc:{t:'Free-sprung escapement',d:'Silicon lever + variable-inertia balance. Regulated in 5 positions to −1/+3 s/day.',x:1},
    barrel:{t:'Twin barrel, 72 hours',d:'Two series-coupled barrels deliver flat torque for three full days. Winding feels like silk.',x:2}
  };
  $$('.tab').forEach(b=>b.addEventListener('click', ()=>{
    $$('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    const k=calData[b.dataset.tab];
    $('#calTitle').textContent=k.t; $('#calText').textContent=k.d;
    $('#calBridge').style.opacity=k.x===0?1:.25;
    $('#calExtra').style.opacity=k.x===0?0:1;
  }));

  /* Configurator */
  const state={model:'meridian',base:18400,metal:'Yellow Gold',add:0,strap:'Alligator · Noir',dial:'Onyx',c1:'#0d0e12',c2:'#000'};
  const dialNotes={Onyx:'Onyx lacquer — 7 layers, mirror-polished.',Glacier:'Glacier silver — sunray-brushed, rhodium-plated.',Champagne:'Champagne grand-feu enamel — fired at 830°C.',Aventurine:'Aventurine glass — copper stars suspended in midnight.',Burgundy:'Burgundy fumé — hand-lacquered gradient.'};
  const metalBorder={'Yellow Gold':'#c9ab6e','Rose Gold':'#d8a07a','Platinum':'#d7d7de'};
  const fmt=n=>'CHF '+n.toLocaleString('en-CH').replace(/,/g,',');
  function render(){
    const total=state.base+state.add;
    const names={meridian:'Meridian 41',noctis:'Noctis 39',aurelia:'Aurelia 36'};
    $('#configName').textContent=`${names[state.model]} · ${state.dial} · ${state.metal}`;
    $('#configPrice').textContent=fmt(total);
    const dial=$('#configDial');
    dial.style.background=`radial-gradient(circle at 32% 28%, ${state.c1}, ${state.c2} 70%)`;
    dial.style.borderColor=metalBorder[state.metal]||'#c9ab6e';
    dial.style.color=(state.dial==='Glacier'||state.dial==='Champagne')?'#3d2c0e':'#e9dcc0';
    $('#dialNote').textContent=dialNotes[state.dial]+` · ${state.strap}.`;
    // gentle sweep demo
    const now=new Date(); const m=now.getMinutes(), h=(now.getHours()%12)*30+m*.5;
    $('#cH').style.setProperty('--r',h+'deg'); $('#cM').style.setProperty('--r',(m*6)+'deg');
    $('#cH').style.transform=`translateX(-50%) rotate(${h}deg)`; $('#cM').style.transform=`translateX(-50%) rotate(${m*6}deg)`;
  }
  function pillGroup(id, fn){
    const g=$(id); if(!g) return;
    g.addEventListener('click', e=>{
      const b=e.target.closest('button'); if(!b) return;
      $$('button',g).forEach(x=>x.classList.remove('active')); b.classList.add('active'); fn(b); render();
    });
  }
  pillGroup('#modelPills', b=>{ state.model=b.dataset.model; state.base=+b.dataset.price; syncCard(b.dataset.model); });
  pillGroup('#metalPills', b=>{ state.metal=b.dataset.metal; state.add=+b.dataset.add; });
  pillGroup('#strapPills', b=>{ state.strap=b.dataset.strap; });
  $('#dialSwatches').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    $$('#dialSwatches button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    state.dial=b.dataset.dial; state.c1=b.dataset.c1; state.c2=b.dataset.c2; render();
  });
  $('#engraveInput').addEventListener('input', e=>{
    $('#engravePrev').textContent=e.target.value.trim()||'Your words, hand-engraved';
  });
  function syncCard(model){
    $$('#modelPills .pill').forEach(x=>x.classList.toggle('active',x.dataset.model===model));
    const btn=$(`#modelPills [data-model="${model}"]`); if(btn) state.base=+btn.dataset.price;
  }
  $$('[data-config]').forEach(b=>b.addEventListener('click', e=>{
    e.stopPropagation();
    syncCard(b.dataset.config); state.model=b.dataset.config; render();
    $('#atelier').scrollIntoView({behavior:'smooth'});
    toast(`Atelier loaded — ${b.dataset.config==='meridian'?'Meridian 41':b.dataset.config==='noctis'?'Noctis 39':'Aurelia 36'}`);
  }));
  $$('.card').forEach(c=>c.addEventListener('click', ()=>{
    syncCard(c.dataset.model); state.model=c.dataset.model; render();
    $('#atelier').scrollIntoView({behavior:'smooth'});
  }));
  render();

  /* Toast + modal */
  let toastT;
  function toast(msg){
    const t=$('#toast'); t.textContent=msg; t.classList.add('show');
    clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2600);
  }
  const modal=$('#modal');
  $('#reserveBtn').addEventListener('click', ()=>{
    const total=state.base+state.add;
    const names={meridian:'Meridian 41',noctis:'Noctis Éclipse',aurelia:'Aurelia Dorée'};
    $('#mTitle').textContent=names[state.model];
    $('#mDesc').textContent=`${state.dial} · ${state.metal} · ${state.strap} · “${$('#engraveInput').value||'—'}”`;
    $('#mPrice').textContent=fmt(total);
    $('#mRef').textContent='AV-'+total+'-'+Math.random().toString(36).slice(2,5).toUpperCase();
    modal.hidden=false;
  });
  $('#modalX').addEventListener('click', ()=>modal.hidden=true);
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.hidden=true; });
  addEventListener('keydown', e=>{ if(e.key==='Escape') modal.hidden=true; });
  $('#mGo').addEventListener('click', ()=>{ modal.hidden=true; $('#reserve').scrollIntoView({behavior:'smooth'}); });

  /* Testimonial slider */
  const track=$('#tTrack'); let idx=0;
  function cardsPerView(){ return innerWidth<1020?1:3; }
  function slide(d){
    const max=track.children.length-cardsPerView();
    idx=(idx+d+track.children.length)%(max+1);
    const w=track.children[0].getBoundingClientRect().width+18;
    track.style.transform=`translateX(${-idx*w}px)`;
  }
  $('#nextT').addEventListener('click', ()=>slide(1));
  $('#prevT').addEventListener('click', ()=>slide(-1));
  setInterval(()=>{ if(!document.hidden) slide(1); }, 6000);
  addEventListener('resize', ()=>{ idx=0; track.style.transform='translateX(0)'; });

  /* Countdown — next salon */
  const target=Date.now()+((12*24+8)*3600+24*60+10)*1000;
  setInterval(()=>{
    let s=Math.max(0,Math.floor((target-Date.now())/1000));
    const d=Math.floor(s/86400); s%=86400; const h=Math.floor(s/3600); s%=3600; const m=Math.floor(s/60); const sec=s%60;
    $('#countdown').textContent=`${d}d : ${String(h).padStart(2,'0')}h : ${String(m).padStart(2,'0')}m : ${String(sec).padStart(2,'0')}s`;
  },1000);

  /* Reserve form */
  $('#reserveForm').addEventListener('submit', e=>{
    e.preventDefault();
    const f=e.target, err=$('#formErr'), ok=$('#formOk');
    const name=f.name.value.trim(), email=f.email.value.trim();
    if(name.length<2){ err.textContent='Please tell us your name.'; f.name.focus(); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ err.textContent='That email doesn’t look complete — one more check?'; f.email.focus(); return; }
    err.textContent='';
    $('#okText').textContent=`${name.split(' ')[0]}, your ${f.city.value} ${f.ref.value} viewing request is noted. Concierge replies within 24h.`;
    ok.hidden=false; toast('Invitation requested — check your inbox soon');
    f.querySelector('button[type=submit]').textContent='Requested ✓';
  });
})();
