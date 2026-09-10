(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const SCALE = 50; // screen units per metre
  const SNAP = 10;  // 20 cm grid

  const starter = {
    walls: [
      {id:'w1', x1:190,y1:120,x2:780,y2:120,t:.18,label:'North wall'},
      {id:'w2', x1:780,y1:120,x2:780,y2:570,t:.18,label:'East wall'},
      {id:'w3', x1:780,y1:570,x2:190,y2:570,t:.18,label:'South wall'},
      {id:'w4', x1:190,y1:570,x2:190,y2:120,t:.18,label:'West wall'},
      {id:'w5', x1:500,y1:120,x2:500,y2:390,t:.14,label:'Interior wall'},
      {id:'w6', x1:500,y1:390,x2:780,y2:390,t:.14,label:'Interior wall'},
      {id:'w7', x1:190,y1:390,x2:390,y2:390,t:.14,label:'Interior wall'}
    ],
    openings: [
      {id:'o1',type:'door',wallId:'w3',ratio:.72,width:1.1,label:'Entry door'},
      {id:'o2',type:'door',wallId:'w5',ratio:.72,width:.9,label:'Door'},
      {id:'o3',type:'window',wallId:'w1',ratio:.22,width:1.6,label:'Window'},
      {id:'o4',type:'window',wallId:'w2',ratio:.52,width:1.4,label:'Window'}
    ]
  };

  let state = structuredClone(starter);
  let tool = 'select';
  let selected = null;
  let drawing = null;
  let dragging = null;
  let zoom = 1;
  let history = [JSON.stringify(state)];
  let historyIndex = 0;

  const $ = s => document.querySelector(s);
  const svg = $('#plan');
  const wallsG = $('#walls');
  const openingsG = $('#openings');
  const dimsG = $('#dimensions');
  const labelsG = $('#labels');
  const fillsG = $('#roomFills');
  const draftG = $('#draft');
  const viewport = $('#viewport');

  function el(name, attrs = {}, parent) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k,v]) => node.setAttribute(k, v));
    if (parent) parent.appendChild(node);
    return node;
  }

  const snap = n => Math.round(n / SNAP) * SNAP;
  const length = w => Math.hypot(w.x2-w.x1, w.y2-w.y1);
  const metres = px => (px / SCALE).toFixed(1);
  const getWall = id => state.walls.find(w => w.id === id);

  function point(evt) {
    const p = svg.createSVGPoint();
    p.x = evt.clientX; p.y = evt.clientY;
    const result = p.matrixTransform(svg.getScreenCTM().inverse());
    return {x:snap(result.x), y:snap(result.y)};
  }

  function openingGeometry(o) {
    const w = getWall(o.wallId);
    if (!w) return null;
    const dx=w.x2-w.x1, dy=w.y2-w.y1, len=Math.hypot(dx,dy), ux=dx/len, uy=dy/len;
    const cx=w.x1+dx*o.ratio, cy=w.y1+dy*o.ratio, half=o.width*SCALE/2;
    return {w, len, ux, uy, cx, cy, x1:cx-ux*half,y1:cy-uy*half,x2:cx+ux*half,y2:cy+uy*half};
  }

  function render() {
    wallsG.replaceChildren(); openingsG.replaceChildren(); dimsG.replaceChildren(); labelsG.replaceChildren(); fillsG.replaceChildren();

    if (state.walls.length >= 4) {
      el('path',{d:'M190 120H780V570H190Z',fill:'#f8f6f0',opacity:'.72'},fillsG);
    }

    state.walls.forEach(w => {
      const g=el('g',{'class':`wall-group ${selected?.id===w.id?'selected':''}`,'data-id':w.id},wallsG);
      el('line',{x1:w.x1,y1:w.y1,x2:w.x2,y2:w.y2,'class':'wall-hit'},g);
      el('line',{x1:w.x1,y1:w.y1,x2:w.x2,y2:w.y2,'class':'wall-line','stroke-width':w.t*SCALE},g);
      g.addEventListener('pointerdown', e => { e.stopPropagation(); if(tool==='select') select({type:'wall',id:w.id}); });
      renderDimension(w);
    });

    state.openings.forEach(o => {
      const geo=openingGeometry(o); if(!geo) return;
      const g=el('g',{'class':`opening ${o.type} ${selected?.id===o.id?'selected':''}`,'data-id':o.id},openingsG);
      el('line',{x1:geo.x1,y1:geo.y1,x2:geo.x2,y2:geo.y2,'class':'cut'},g);
      if(o.type==='window') {
        const nx=-geo.uy*4, ny=geo.ux*4;
        el('line',{x1:geo.x1+nx,y1:geo.y1+ny,x2:geo.x2+nx,y2:geo.y2+ny,'class':'frame'},g);
        el('line',{x1:geo.x1-nx,y1:geo.y1-ny,x2:geo.x2-nx,y2:geo.y2-ny,'class':'frame'},g);
      } else {
        const swing= o.width*SCALE;
        el('line',{x1:geo.x1,y1:geo.y1,x2:geo.x1-geo.uy*swing,y2:geo.y1+geo.ux*swing,'class':'frame'},g);
        el('path',{d:`M${geo.x2} ${geo.y2} A${swing} ${swing} 0 0 0 ${geo.x1-geo.uy*swing} ${geo.y1+geo.ux*swing}`,'class':'frame','stroke-width':'1.5'},g);
      }
      g.addEventListener('pointerdown', e => {
        e.stopPropagation();
        if(tool==='select') { select({type:'opening',id:o.id}); dragging={id:o.id}; g.setPointerCapture(e.pointerId); }
      });
    });

    renderRoomLabels();
    $('#elementCount').textContent=`${state.walls.length} wall${state.walls.length===1?'':'s'} · ${state.openings.length} opening${state.openings.length===1?'':'s'}`;
    const outer = state.walls.slice(0,4);
    if(outer.length===4) $('#areaValue').textContent=`${((length(outer[0])/SCALE)*(length(outer[1])/SCALE)).toFixed(1)} m²`;
    updateHistoryButtons();
  }

  function renderDimension(w) {
    const dx=w.x2-w.x1,dy=w.y2-w.y1,len=Math.hypot(dx,dy); if(len<1)return;
    const nx=-dy/len,ny=dx/len;
    const side=(Math.abs(dx)>Math.abs(dy) && w.y1>350)||(Math.abs(dy)>=Math.abs(dx)&&w.x1<400)?1:-1;
    const off=22*side, a={x:w.x1+nx*off,y:w.y1+ny*off}, b={x:w.x2+nx*off,y:w.y2+ny*off};
    const g=el('g',{},dimsG);
    el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,'class':'dimension-line'},g);
    el('line',{x1:a.x-nx*5,y1:a.y-ny*5,x2:a.x+nx*5,y2:a.y+ny*5,'class':'dimension-line'},g);
    el('line',{x1:b.x-nx*5,y1:b.y-ny*5,x2:b.x+nx*5,y2:b.y+ny*5,'class':'dimension-line'},g);
    const angle=Math.atan2(dy,dx)*180/Math.PI;
    const readable=(angle>90||angle<-90)?angle+180:angle;
    const t=el('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2-4,'class':'dimension-text',transform:`rotate(${readable} ${(a.x+b.x)/2} ${(a.y+b.y)/2})`},g);
    t.textContent=`${metres(len)} m`;
  }

  function roomLabel(x,y,name,size) {
    const t=el('text',{x,y,'class':'room-label'},labelsG);
    const a=el('tspan',{x,y,'class':'name'},t); a.textContent=name;
    const b=el('tspan',{x,dy:17,'class':'size'},t); b.textContent=size;
  }
  function renderRoomLabels(){
    if(state.walls.length<4)return;
    roomLabel(345,260,'Living','24.8 m²');
    roomLabel(640,255,'Kitchen','18.4 m²');
    roomLabel(345,480,'Dining','14.2 m²');
    roomLabel(640,480,'Studio','12.6 m²');
  }

  function select(item) {
    selected=item; render(); updateProperties();
  }

  function updateProperties() {
    const empty=$('#emptySelection'), form=$('#propertyForm'), del=$('#deleteBtn');
    if(!selected){empty.classList.remove('hidden');form.classList.add('hidden');del.disabled=true;return;}
    empty.classList.add('hidden');form.classList.remove('hidden');del.disabled=false;
    const obj=selected.type==='wall'?getWall(selected.id):state.openings.find(o=>o.id===selected.id);
    if(!obj){selected=null;updateProperties();return;}
    $('#lengthInput').value=selected.type==='wall'?metres(length(obj)):obj.width;
    $('#propertyLabel').textContent=selected.type==='wall'?'Length':'Width';
    $('#thicknessField').classList.toggle('hidden',selected.type!=='wall');
    if(selected.type==='wall')$('#thicknessInput').value=obj.t;
    $('#labelInput').value=obj.label||'';
  }

  function setTool(next) {
    tool=next; drawing=null; draftG.replaceChildren();
    document.querySelectorAll('.tool').forEach(b=>{const on=b.dataset.tool===tool;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
    svg.className.baseVal=`tool-${tool}`;
    const hints={select:'Select and move elements',wall:'Drag to draw a wall',door:'Click a wall to place a door',window:'Click a wall to place a window'};
    $('#modeHint').lastChild.textContent=hints[tool];
    $('#modeHint span').style.background=tool==='select'?'var(--sage)':'var(--accent)';
    if(innerWidth<=760)$('#sidebar').classList.remove('open');
  }

  function nearestWall(p,max=30) {
    let best=null;
    state.walls.forEach(w=>{
      const dx=w.x2-w.x1,dy=w.y2-w.y1,l2=dx*dx+dy*dy;
      const ratio=Math.max(0,Math.min(1,((p.x-w.x1)*dx+(p.y-w.y1)*dy)/l2));
      const x=w.x1+ratio*dx,y=w.y1+ratio*dy,d=Math.hypot(p.x-x,p.y-y);
      if(d<=max&&(!best||d<best.d))best={w,ratio,d};
    }); return best;
  }

  function onPointerDown(e) {
    if(e.button!==0)return;
    const p=point(e);
    if(tool==='wall'){
      drawing={start:p,end:p}; svg.setPointerCapture(e.pointerId); drawDraft();
    } else if(tool==='door'||tool==='window'){
      const near=nearestWall(p);
      if(!near){showToast('Place openings directly on a wall');return;}
      const id=`o${Date.now()}`;
      state.openings.push({id,type:tool,wallId:near.w.id,ratio:near.ratio,width:tool==='door'?.9:1.4,label:tool==='door'?'Door':'Window'});
      commit(); select({type:'opening',id}); showToast(`${tool[0].toUpperCase()+tool.slice(1)} added`);
    } else if(e.target===svg||e.target.tagName==='rect'||e.target.closest('#roomFills')) select(null);
  }

  function onPointerMove(e) {
    const raw=point(e);
    if(drawing){
      let p=raw;
      if(!e.shiftKey){const dx=Math.abs(p.x-drawing.start.x),dy=Math.abs(p.y-drawing.start.y);if(dx>dy)p.y=drawing.start.y;else p.x=drawing.start.x;}
      drawing.end=p;drawDraft();
      const rect=viewport.getBoundingClientRect(); $('#crosshairLabel').style.left=`${e.clientX-rect.left}px`;$('#crosshairLabel').style.top=`${e.clientY-rect.top}px`;
    }
    if(dragging){
      const o=state.openings.find(o=>o.id===dragging.id), near=nearestWall(raw,55); if(!o||!near)return;
      o.wallId=near.w.id;o.ratio=near.ratio;render();
    }
  }

  function onPointerUp(e) {
    if(drawing){
      const {start,end}=drawing; const len=Math.hypot(end.x-start.x,end.y-start.y);
      drawing=null;draftG.replaceChildren();$('#crosshairLabel').classList.add('hidden');
      if(len>=20){const id=`w${Date.now()}`;state.walls.push({id,x1:start.x,y1:start.y,x2:end.x,y2:end.y,t:.18,label:'Wall'});commit();select({type:'wall',id});}
      else showToast('Drag farther to draw a wall');
    }
    if(dragging){dragging=null;commit();}
  }

  function drawDraft(){
    draftG.replaceChildren();const {start,end}=drawing;
    el('line',{x1:start.x,y1:start.y,x2:end.x,y2:end.y,'class':'draft-line'},draftG);
    el('circle',{cx:start.x,cy:start.y,r:6,'class':'draft-node'},draftG);el('circle',{cx:end.x,cy:end.y,r:6,'class':'draft-node'},draftG);
    const d=Math.hypot(end.x-start.x,end.y-start.y);const label=$('#crosshairLabel');label.textContent=`${metres(d)} m`;label.classList.remove('hidden');
  }

  function commit(){
    history=history.slice(0,historyIndex+1);history.push(JSON.stringify(state));historyIndex++;
    $('#saveStatus').textContent='Saving…';setTimeout(()=>$('#saveStatus').textContent='All changes saved',420);render();
  }
  function travel(dir){
    const next=historyIndex+dir;if(next<0||next>=history.length)return;historyIndex=next;state=JSON.parse(history[next]);selected=null;render();updateProperties();
  }
  function updateHistoryButtons(){$('#undoBtn').disabled=historyIndex===0;$('#redoBtn').disabled=historyIndex===history.length-1;}
  function removeSelected(){
    if(!selected)return;
    if(selected.type==='wall'){state.walls=state.walls.filter(w=>w.id!==selected.id);state.openings=state.openings.filter(o=>o.wallId!==selected.id)}
    else state.openings=state.openings.filter(o=>o.id!==selected.id);
    selected=null;commit();updateProperties();showToast('Element deleted');
  }
  function updateZoom(next){zoom=Math.max(.6,Math.min(1.6,next));svg.style.transform=`scale(${zoom})`;$('#zoomValue').textContent=`${Math.round(zoom*100)}%`;}
  let toastTimer; function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}

  document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
  svg.addEventListener('pointerdown',onPointerDown);svg.addEventListener('pointermove',onPointerMove);svg.addEventListener('pointerup',onPointerUp);svg.addEventListener('pointercancel',onPointerUp);
  $('#undoBtn').addEventListener('click',()=>travel(-1));$('#redoBtn').addEventListener('click',()=>travel(1));$('#deleteBtn').addEventListener('click',removeSelected);
  $('#zoomIn').addEventListener('click',()=>updateZoom(zoom+.1));$('#zoomOut').addEventListener('click',()=>updateZoom(zoom-.1));$('#fitBtn').addEventListener('click',()=>updateZoom(1));
  $('#sidebarToggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('#clearBtn').addEventListener('click',()=>{state={walls:[],openings:[]};selected=null;commit();updateProperties();showToast('New blank plan ready')});
  $('#exportBtn').addEventListener('click',()=>{
    const copy=svg.cloneNode(true);
    copy.querySelector('#draft')?.remove();
    copy.querySelectorAll('.selected').forEach(node=>node.classList.remove('selected'));
    const exportStyle=document.createElementNS(NS,'style');
    exportStyle.textContent='.wall-line{stroke:#353936;stroke-linecap:square}.wall-hit{stroke:transparent}.opening .cut{stroke:#f4f2ec;stroke-width:16}.opening .frame{stroke:#72877b;stroke-width:5;fill:none}.opening.door .frame{stroke:#d66832}.dimension-line{stroke:#989a95;stroke-width:1;fill:none}.dimension-text{font:10px sans-serif;fill:#656862;text-anchor:middle;paint-order:stroke;stroke:#f4f2ec;stroke-width:5px}.room-label{text-anchor:middle}.room-label .name{font:600 11px sans-serif;letter-spacing:.7px;fill:#777a74}.room-label .size{font:italic 10px serif;fill:#989a95}';
    copy.prepend(exportStyle);
    const source=new XMLSerializer().serializeToString(copy);const blob=new Blob([source],{type:'image/svg+xml'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='lake-house-floor-plan.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);showToast('Floor plan exported');
  });
  $('#lengthInput').addEventListener('change',e=>{
    if(!selected)return;const value=Math.max(.5,+e.target.value||.5);
    if(selected.type==='wall'){const w=getWall(selected.id),len=length(w),ratio=value*SCALE/len;w.x2=w.x1+(w.x2-w.x1)*ratio;w.y2=w.y1+(w.y2-w.y1)*ratio}else state.openings.find(o=>o.id===selected.id).width=value;commit();updateProperties();
  });
  $('#thicknessInput').addEventListener('change',e=>{if(selected?.type==='wall'){getWall(selected.id).t=Math.max(.1,Math.min(.5,+e.target.value));commit();updateProperties()}});
  $('#labelInput').addEventListener('change',e=>{if(selected){const o=selected.type==='wall'?getWall(selected.id):state.openings.find(o=>o.id===selected.id);o.label=e.target.value;commit()}});
  window.addEventListener('keydown',e=>{
    if(e.target.matches('input'))return;
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();travel(e.shiftKey?1:-1);return}
    const keys={v:'select',w:'wall',d:'door',n:'window'};if(keys[e.key.toLowerCase()])setTool(keys[e.key.toLowerCase()]);
    if((e.key==='Delete'||e.key==='Backspace')&&selected)removeSelected();if(e.key==='Escape'){drawing=null;draftG.replaceChildren();$('#crosshairLabel').classList.add('hidden');select(null)}
  });

  setTool('select');render();updateProperties();
})();
