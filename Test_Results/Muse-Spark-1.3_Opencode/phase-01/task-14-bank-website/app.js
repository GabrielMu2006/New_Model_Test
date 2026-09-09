const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const fmt = n => n.toLocaleString('en-US',{style:'currency',currency:'USD'});
const toast = (msg) => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),2800); };

// Mobile nav
const ham=$('#hamburger'), mm=$('#mobileMenu');
ham?.addEventListener('click',()=>{ const o=mm.classList.toggle('open'); ham.setAttribute('aria-expanded',o); });
$$('#mobileMenu a').forEach(a=>a.addEventListener('click',()=>mm.classList.remove('open')));
$('#heroDemoBtn')?.addEventListener('click',()=>{ document.querySelector('#demo').scrollIntoView({behavior:'smooth'}); });

// Login modal
const modal=$('#loginModal');
const openLogin=()=>{ modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); $('#loginUser')?.focus(); };
const closeLogin=()=>{ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); };
$('#loginBtn')?.addEventListener('click',openLogin);
$('#loginBtnMobile')?.addEventListener('click',()=>{mm.classList.remove('open');openLogin();});
$('#loginClose')?.addEventListener('click',closeLogin);
modal?.addEventListener('click',e=>{ if(e.target===modal) closeLogin(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeLogin(); });
$('#loginForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const u=$('#loginUser').value.trim(), p=$('#loginPass').value;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u)){ $('#loginErr').textContent='Enter a valid email address.'; return; }
  if(p.length<4){ $('#loginErr').textContent='Password must be at least 4 characters (demo only).'; return; }
  $('#loginErr').textContent='';
  closeLogin(); toast(`Welcome back! Signed in as ${u} (demo).`);
});
$('#loginSignup')?.addEventListener('click',closeLogin);

// Rates search
$('#rateSearch')?.addEventListener('input',e=>{
  const q=e.target.value.toLowerCase();
  $$('#ratesTable tbody tr').forEach(tr=>{ tr.style.display = tr.dataset.name.includes(q)?'':'none'; });
});

// Calculators
const tabs=$$('.tab'); let activeCalc='savings';
tabs.forEach(t=>t.addEventListener('click',()=>{
  tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active');
  activeCalc=t.dataset.tab;
  $$('.calc-panel').forEach(p=>p.classList.add('hidden'));
  $('#panel-'+activeCalc).classList.remove('hidden');
  updateCalc();
}));
function bindRange(id,out,fmtFn){ const r=$('#'+id),o=$('#'+out); const f=()=>{o.textContent=fmtFn(parseFloat(r.value));updateCalc();}; r.addEventListener('input',f); f(); }
bindRange('svPrincipal','svPrincipalOut',v=>fmt(v));
bindRange('svMonthly','svMonthlyOut',v=>fmt(v));
bindRange('svApy','svApyOut',v=>v.toFixed(2)+'%');
bindRange('svYears','svYearsOut',v=>v+' yrs');
bindRange('lnAmount','lnAmountOut',v=>fmt(v));
bindRange('lnApr','lnAprOut',v=>v.toFixed(2)+'%');
bindRange('lnTerm','lnTermOut',v=>v+' mo');
bindRange('mtPrice','mtPriceOut',v=>fmt(v));
bindRange('mtDown','mtDownOut',v=>v+'%');
bindRange('mtRate','mtRateOut',v=>v.toFixed(2)+'%');
$('#mtTerm')?.addEventListener('change',updateCalc);

function drawChart(points){
  const c=$('#calcChart'), ctx=c.getContext('2d');
  const W=c.width,H=c.height; ctx.clearRect(0,0,W,H);
  const max=Math.max(...points,1);
  // grid
  ctx.strokeStyle='#e3e9f0'; ctx.lineWidth=1;
  for(let i=1;i<4;i++){ ctx.beginPath(); ctx.moveTo(0,H*i/4); ctx.lineTo(W,H*i/4); ctx.stroke(); }
  // area
  const grad=ctx.createLinearGradient(0,0,0,H); grad.addColorStop(0,'rgba(18,58,99,.35)'); grad.addColorStop(1,'rgba(18,58,99,.02)');
  ctx.beginPath(); points.forEach((p,i)=>{ const x=i/(points.length-1)*W, y=H-8-(p/max)*(H-30); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
  ctx.strokeStyle='#0b2a4a'; ctx.lineWidth=3; ctx.stroke();
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
}
function updateCalc(){
  const label=$('#calcLabel'),main=$('#calcMain'),sub=$('#calcSub'),br=$('#calcBreak');
  if(activeCalc==='savings'){
    const P=+$('#svPrincipal').value, M=+$('#svMonthly').value, apy=+$('#svApy').value/100, yrs=+$('#svYears').value;
    const r=apy/12; let bal=P; const pts=[bal];
    for(let i=0;i<yrs*12;i++){ bal=bal*(1+r)+M; if(i%12===11||i===yrs*12-1) pts.push(bal); }
    const contrib=P+M*yrs*12, interest=bal-contrib;
    label.textContent='Projected balance'; main.textContent=fmt(bal);
    sub.textContent=`You’ll contribute ${fmt(contrib)} and earn ${fmt(interest)} in interest.`;
    br.innerHTML=`<span>💰 Contributions: <b>${fmt(contrib)}</b></span><span>📈 Interest: <b>${fmt(interest)}</b></span><span>📅 ${yrs} yrs @ ${(apy*100).toFixed(2)}% APY</span>`;
    drawChart(pts);
  } else if(activeCalc==='loan'){
    const A=+$('#lnAmount').value, apr=+$('#lnApr').value/100, n=+$('#lnTerm').value, r=apr/12;
    const pay = r? A*r/(1-Math.pow(1+r,-n)) : A/n;
    const total=pay*n, interest=total-A;
    label.textContent='Monthly payment'; main.textContent=fmt(pay);
    sub.textContent=`${n} payments · ${fmt(total)} total · ${fmt(interest)} interest.`;
    br.innerHTML=`<span>🏦 Loan: <b>${fmt(A)}</b></span><span>💳 Total interest: <b>${fmt(interest)}</b></span><span>📊 APR ${(apr*100).toFixed(2)}%</span>`;
    const pts=[]; let b=A; for(let i=0;i<=n;i+=Math.max(1,Math.floor(n/24))){ pts.push(Math.max(0,b)); b=b*(1+r)-pay; } pts.push(0);
    drawChart(pts.reverse());
  } else {
    const price=+$('#mtPrice').value, downPct=+$('#mtDown').value, rate=+$('#mtRate').value/100, yrs=+$('#mtTerm').value;
    const down=price*downPct/100, loan=price-down, r=rate/12, n=yrs*12;
    const pay = r? loan*r/(1-Math.pow(1+r,-n)) : loan/n;
    const total=pay*n+down, interest=total-price;
    label.textContent='Est. monthly payment (P&I)'; main.textContent=fmt(pay);
    sub.textContent=`${fmt(loan)} loan after ${fmt(down)} down · ${yrs}-yr fixed @ ${(rate*100).toFixed(2)}%. Excl. tax & insurance.`;
    br.innerHTML=`<span>🏠 Price: <b>${fmt(price)}</b></span><span>💵 Down: <b>${fmt(down)} (${downPct}%)</b></span><span>📈 Lifetime interest: <b>${fmt(interest)}</b></span>`;
    drawChart([loan,loan*.85,loan*.65,loan*.45,loan*.25,0]);
  }
}
updateCalc();

// Demo banking with localStorage
const KEY='meridian-demo-v1';
const defaults={checking:8412.55,savings:16393.62,tx:[
  {n:'Payroll — Meridian Labs',d:'Sept 6 · Direct deposit',a:4820},
  {n:'Mortgage autopay',d:'Sept 5 · Home loan',a:-1894},
  {n:'Whole Foods',d:'Sept 4 · Groceries',a:-132.18},
  {n:'Transfer to Savings',d:'Sept 3 · Auto-save rule',a:-500,tag:'internal'},
  {n:'Bluebird Café',d:'Sept 2 · Dining',a:-6.40},
  {n:'Dividend — Savings interest',d:'Sept 1 · 4.60% APY',a:61.22},
]};
let state;
try{ state=JSON.parse(localStorage.getItem(KEY))||structuredClone(defaults); }catch{ state=structuredClone(defaults); }
function save(){ localStorage.setItem(KEY,JSON.stringify(state)); }
function renderDemo(filter=''){
  $('#checkingBal').textContent=fmt(state.checking);
  $('#savingsBal').textContent=fmt(state.savings);
  const list=$('#txList'); list.innerHTML='';
  state.tx.filter(t=>(t.n+t.d).toLowerCase().includes(filter.toLowerCase())).forEach(t=>{
    const li=document.createElement('li');
    li.innerHTML=`<div><strong></strong><small></small></div><b></b>`;
    li.querySelector('strong').textContent=(t.a<0?'':'+')+(t.n);
    li.querySelector('small').textContent=t.d;
    const b=li.querySelector('b'); b.textContent=(t.a<0?'−':'+')+fmt(Math.abs(t.a)).slice(0); b.textContent=(t.a<0?'-':'+')+fmt(Math.abs(t.a));
    b.className=t.a<0?'neg':'pos2';
    list.appendChild(li);
  });
  if(!list.children.length){ list.innerHTML='<li><span class="muted">No transactions match.</span></li>'; }
}
renderDemo();
$('#txFilter')?.addEventListener('input',e=>renderDemo(e.target.value));
$('#tSend')?.addEventListener('click',()=>{
  const from=$('#tFrom').value, to=$('#tTo').value, amt=parseFloat($('#tAmount').value);
  const err=$('#tErr'); err.textContent='';
  if(from===to){ err.textContent='Choose two different accounts.'; return; }
  if(!amt||amt<=0){ err.textContent='Enter an amount greater than $0.'; return; }
  if(state[from]<amt){ err.textContent=`Insufficient funds in ${from}. (Demo balance ${fmt(state[from])})`; return; }
  state[from]-=amt; state[to]+=amt;
  const label=`Transfer ${from} → ${to}`;
  state.tx.unshift({n:label,d:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})+' · Demo transfer',a:0,skip:true});
  // record as two-sided note but adjust single list entry:
  state.tx[0]={n:label,d:'Just now · Demo transfer',a:amt,note:`${fmt(amt)} moved`};
  save(); renderDemo($('#txFilter').value); $('#tAmount').value='';
  toast(`${fmt(amt)} transferred ${from} → ${to} (demo).`);
});
$('#resetDemo')?.addEventListener('click',()=>{ state=structuredClone(defaults); save(); renderDemo(); toast('Demo data reset.'); });

// Branches
const branches=[
  {city:'New York — Midtown',addr:'400 Harbor Ave, NY 10001',hrs:'Mon–Fri 9–6 · Sat 9–1',tags:['branch','atm','advisor'],zip:'10001'},
  {city:'Brooklyn — Park Slope',addr:'88 7th Ave, Brooklyn 11215',hrs:'Mon–Fri 9–5 · Drive-thru',tags:['branch','atm'],zip:'11215'},
  {city:'Austin — Downtown',addr:'600 Congress Ave, Austin 78701',hrs:'Mon–Fri 9–6 · Sat 10–2',tags:['branch','atm','business'],zip:'78701'},
  {city:'Denver — LoDo',addr:'1500 Wynkoop St, Denver 80202',hrs:'Mon–Fri 9–5',tags:['branch','atm'],zip:'80202'},
  {city:'Seattle — Capitol Hill',addr:'415 15th Ave E, Seattle 98112',hrs:'Mon–Sat 9–6',tags:['atm','coffee ☕'],zip:'98112'},
  {city:'Chicago — Loop',addr:'200 W Madison St, Chicago 60606',hrs:'Mon–Fri 8:30–5:30',tags:['branch','atm','safe deposit'],zip:'60606'},
];
function renderBranches(q=''){
  const g=$('#branchGrid'); g.innerHTML='';
  branches.filter(b=>(b.city+b.addr+b.zip).toLowerCase().includes(q.toLowerCase())).forEach(b=>{
    const d=document.createElement('div'); d.className='card';
    d.innerHTML=`<h3></h3><p class="muted"></p><p></p><div></div>`;
    d.querySelector('h3').textContent='📍 '+b.city;
    d.querySelectorAll('p')[0].textContent=b.addr;
    d.querySelectorAll('p')[1].textContent='🕘 '+b.hrs;
    const tagWrap=d.querySelector('div'); b.tags.forEach(t=>{ const s=document.createElement('span'); s.className='pill-sm'; s.textContent=t; tagWrap.appendChild(s); });
    g.appendChild(d);
  });
  if(!g.children.length) g.innerHTML='<p class="muted">No locations found. Try “Austin” or “10001”.</p>';
}
renderBranches();
$('#branchSearch')?.addEventListener('input',e=>renderBranches(e.target.value));

// Open-account wizard
let step=1;
const openForm=$('#openForm');
function setStep(n){
  step=Math.min(3,Math.max(1,n));
  $$('#openForm .step').forEach(s=>s.classList.toggle('hidden',+s.dataset.step!==step));
  $$('.steps li').forEach(li=>li.classList.toggle('active',+li.dataset.s<=step));
  $('#wizBack').disabled=step===1;
  $('#wizNext').textContent=step===3?'Submit application':'Continue';
  if(step===3){
    const fd=new FormData(openForm);
    $('#openReview').innerHTML=`<b>${fd.get('first')||''} ${fd.get('last')||''}</b> · ${fd.get('email')||''} · ${fd.get('phone')||''}<br>Account: <b>${fd.get('acct')}</b> · Initial deposit: <b>${fmt(+fd.get('deposit')||0)}</b>`;
  }
  $('#openErr').textContent='';
}
$('#wizBack')?.addEventListener('click',()=>setStep(step-1));
$('#wizNext')?.addEventListener('click',()=>{
  const err=$('#openErr');
  if(step===1){
    const f=openForm.first.value.trim(), l=openForm.last.value.trim(), em=openForm.email.value.trim(), ph=openForm.phone.value.trim();
    if(!f||!l){ err.textContent='Please enter your first and last name.'; return; }
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){ err.textContent='Enter a valid email address.'; return; }
    if(ph.replace(/\D/g,'').length<7){ err.textContent='Enter a valid phone number.'; return; }
    setStep(2);
  } else if(step===2){
    if((+openForm.deposit.value||0)<0){ err.textContent='Deposit can’t be negative.'; return; }
    setStep(3);
  } else {
    if(!$('#agree').checked){ err.textContent='Please tick the consent box (demo only, no real account).'; return; }
    err.textContent='';
    const fd=new FormData(openForm);
    toast(`Thanks ${fd.get('first')||'friend'}! Your ${fd.get('acct')} application was received (demo).`);
    openForm.reset(); setStep(1);
  }
});
$$('[data-acct]')?.forEach(a=>a.addEventListener('click',()=>{
  const v=a.dataset.acct==='credit'?'checking':a.dataset.acct;
  const radio=openForm.querySelector(`input[name=acct][value=${v}]`); if(radio) radio.checked=true;
}));
setStep(1);

// Contact
$('#contactForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  if(!f.get('cname')||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.get('cemail'))||!f.get('cmsg')){
    $('#contactErr').textContent='Please complete name, valid email, and message.'; return;
  }
  $('#contactErr').textContent=''; e.target.reset();
  toast('Message sent! We’ll reply within 1 business day (demo).');
});

$('#toTop')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
