(() => {
  function safeFmt(n){
    if(!isFinite(n)) return '∞';
    const u=['','K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc'];
    let k=0;
    while(Math.abs(n)>=1000 && k<u.length-1){ n/=1000; k++; }
    return (k ? n.toFixed(n<10?2:n<100?1:0) : Math.floor(n).toLocaleString()) + u[k];
  }
  function ensurePatronV2(){
    state.pu = state.pu || {};
    state.eu = state.eu || {};
    state.patronSpent = state.patronSpent || 0;
    state.lifetimePatrons = Math.max(state.lifetimePatrons || 0, (state.patrons || 0) + (state.patronSpent || 0));
  }
  function lv(id){ ensurePatronV2(); return state.pu[id] || 0; }
  function ev(id){ ensurePatronV2(); return state.eu[id] || 0; }
  function patronPower(){
    ensurePatronV2();
    const l = Math.max(0, state.lifetimePatrons || state.patrons || 0);
    return Math.min(250, 1 + Math.log10(1 + l) * 0.55 + Math.sqrt(l) / 900);
  }
  function patronGainMult(){ return 1 + lv('patrons') * 0.05 + ev('yarn') * 0.01; }
  function profitShopMult(){ return (1 + lv('profit') * 0.07) * (1 + ev('royal') * 0.01); }
  function speedShopMult(){ return (1 + lv('speed') * 0.03) * (1 + ev('tower') * 0.005); }
  function managerDiscount(){ return Math.min(0.75, lv('discount') * 0.03); }
  function startingStash(){ return lv('stash') * lv('stash') * 5000; }
  function autoStaff(){
    const n = lv('auto');
    for(let i=0;i<n && i<state.b.length;i++){
      state.b[i].man = true;
      if(state.b[i].q) run(i);
    }
  }

  const SHOP = [
    ['profit','Fatter Purrfits','More profit for every business.',250000,1.90,150],
    ['speed','Faster Zoomies','Faster production for every business.',500000,2.00,125],
    ['stash','Starting Stash','Begin each new life with more cash.',125000,1.75,150],
    ['discount','Manager Discounts','Managers cost less.',750000,2.15,25],
    ['patrons','Bigger Fan Club','Earn more patrons on new lives.',1500000,2.25,75],
    ['auto','Auto-Cat Staff','Auto-manage more starter businesses.',5000000,4.00,10]
  ];
  const ENDLESS = [
    ['royal','Royal Scratching Post','Endless profit sink.',25000000,1.28],
    ['tower','Luxury Cat Tower','Endless speed sink.',40000000,1.32],
    ['yarn','Golden Yarn Fund','Endless patron-gain sink.',60000000,1.35]
  ];
  function normalCost(u){ return Math.max(1, Math.floor(u[3] * Math.pow(u[4], lv(u[0])))); }
  function endlessCost(u){ return Math.max(1, Math.floor(u[3] * Math.pow(u[4], ev(u[0])))); }

  const oldFresh = fresh;
  fresh = function(){
    const f = oldFresh();
    if(typeof state !== 'undefined'){
      ensurePatronV2();
      f.pu = JSON.parse(JSON.stringify(state.pu || {}));
      f.eu = JSON.parse(JSON.stringify(state.eu || {}));
      f.patronSpent = state.patronSpent || 0;
      f.lifetimePatrons = state.lifetimePatrons || ((state.patrons || 0) + (state.patronSpent || 0));
      f.cash += startingStash();
    }
    return f;
  };

  pMult = function(id){
    ensurePatronV2();
    let q = state.b[id].q, m = 1;
    [25,50,100,200,300,400].forEach(t => { if(q >= t) m *= 2; });
    UP.forEach(u => { if(state.up[u.id] && ((u.target === id && u.type === 'profit') || u.target === -1)) m *= u.mult; });
    return m * patronPower() * profitShopMult();
  };
  sMult = function(id){
    ensurePatronV2();
    let q = state.b[id].q, m = 1;
    [50,200].forEach(t => { if(q >= t) m *= 2; });
    UP.forEach(u => { if(state.up[u.id] && u.target === id && u.type === 'speed') m *= u.mult; });
    return m * speedShopMult();
  };

  openManagers = function(){
    ensurePatronV2();
    modalTitle.textContent='Managers';
    modalBody.innerHTML='<div class="patron-pill">Manager discount: '+Math.round(managerDiscount()*100)+'%</div>';
    DATA.forEach((b,i)=>{
      const o=state.b[i], price=Math.max(1,Math.floor(b.m*(1-managerDiscount()))), card=document.createElement('div');
      card.className='card'+(o.man?' done':'')+(state.cash<price&&!o.man?' locked':'');
      card.innerHTML='<div><b>'+b.mn+'</b><br><small>Automatically runs '+b.n+'</small><small class="patron-small">Base: '+fmt(b.m)+' | Current: '+fmt(price)+'</small></div>';
      const btn=document.createElement('button'); btn.className='btn'; btn.textContent=o.man?'Hired':fmt(price); btn.disabled=o.man||state.cash<price;
      if(!o.man) btn.onclick=()=>{ state.cash-=price; o.man=true; run(i); pop('Manager hired.'); openManagers(); render(); };
      card.appendChild(btn); modalBody.appendChild(card);
    });
    modal.classList.add('show');
  };

  function potentialPatrons(){ return Math.floor(Math.floor(Math.sqrt((state.total||0)/1000000)) * patronGainMult()); }
  function newLife(gain){
    if(gain<1) return pop('Need more purrfits before a new life.');
    ensurePatronV2();
    const pu=JSON.parse(JSON.stringify(state.pu||{})), eu=JSON.parse(JSON.stringify(state.eu||{}));
    const spent=state.patronSpent||0, unspent=state.patrons||0, life=Math.max(state.lifetimePatrons||0, unspent+spent);
    state=fresh(); state.pu=pu; state.eu=eu; state.patronSpent=spent; state.patrons=unspent+gain; state.lifetimePatrons=life+gain;
    autoStaff(); save(); modal.classList.remove('show'); pop('New life gained '+safeFmt(gain)+' patrons.'); render();
  }
  function buyUpgrade(id,endless){
    ensurePatronV2();
    const list=endless?ENDLESS:SHOP, u=list.find(x=>x[0]===id); if(!u) return;
    const level=endless?ev(id):lv(id), max=endless?Infinity:u[5], cost=endless?endlessCost(u):normalCost(u);
    if(level>=max || (state.patrons||0)<cost) return;
    state.patrons-=cost; state.patronSpent=(state.patronSpent||0)+cost;
    if(endless) state.eu[id]=level+1; else state.pu[id]=level+1;
    autoStaff(); save(); pop(u[1]+' upgraded.'); openPatronShop(); render();
  }
  function cardFor(u,endless){
    const id=u[0], level=endless?ev(id):lv(id), max=endless?'Endless':u[5], cost=endless?endlessCost(u):normalCost(u), maxed=!endless&&level>=u[5];
    const card=document.createElement('div'); card.className='card'+(maxed?' done':'')+(!maxed&&(state.patrons||0)<cost?' locked':'');
    card.innerHTML='<div><b>'+u[1]+'</b><br><small>'+u[2]+'</small><small class="patron-small">Level '+level+' / '+max+'</small></div>';
    const btn=document.createElement('button'); btn.className='btn'; btn.textContent=maxed?'Maxed':'Patrons '+safeFmt(cost); btn.disabled=maxed||(state.patrons||0)<cost;
    if(!maxed) btn.onclick=()=>buyUpgrade(id,endless); card.appendChild(btn); return card;
  }
  openPatronShop=function(){
    ensurePatronV2(); modalTitle.textContent='Patron Shop';
    modalBody.innerHTML='<div class="patron-pill">Unspent: '+safeFmt(state.patrons||0)+'</div><div class="patron-pill">Lifetime: '+safeFmt(state.lifetimePatrons||0)+'</div><div class="patron-pill">Power: x'+patronPower().toFixed(2)+'</div>';
    const grid=document.createElement('div'); grid.className='patron-grid';
    SHOP.forEach(u=>grid.appendChild(cardFor(u,false))); ENDLESS.forEach(u=>grid.appendChild(cardFor(u,true)));
    modalBody.appendChild(grid); const back=document.createElement('button'); back.className='btn ghost'; back.textContent='Back to Nine Lives'; back.onclick=openPrestige; modalBody.appendChild(back); modal.classList.add('show');
  };
  openPrestige=function(){
    ensurePatronV2(); const gain=potentialPatrons(); modalTitle.textContent='Nine Lives'; modalBody.innerHTML='';
    const wrap=document.createElement('div'); wrap.className='patron-menu';
    wrap.innerHTML='<div class="card"><div><b>Cash Out</b><br><small>Restart businesses and cash, but gain permanent patrons.</small><small class="patron-small">Potential: <b>'+safeFmt(gain)+'</b></small><small class="patron-small">Gain bonus: +'+Math.round((patronGainMult()-1)*100)+'%</small></div><button class="btn danger" id="cashOutBtn" '+(gain<1?'disabled':'')+'>Begin New Life</button></div><div class="card"><div><b>Patron Shop</b><br><small>Spend unspent patrons. Lifetime patron power stays.</small><small class="patron-small">Unspent: <b>'+safeFmt(state.patrons||0)+'</b> | Lifetime: <b>'+safeFmt(state.lifetimePatrons||0)+'</b> | Power: <b>x'+patronPower().toFixed(2)+'</b></small></div><button class="btn" id="patronShopBtn">Open Shop</button></div>';
    modalBody.appendChild(wrap); modal.classList.add('show'); document.getElementById('cashOutBtn').onclick=()=>newLife(gain); document.getElementById('patronShopBtn').onclick=openPatronShop;
  };
  const oldRender=render;
  render=function(){ ensurePatronV2(); autoStaff(); oldRender(); const p=document.getElementById('investors'); if(p) p.textContent=safeFmt(state.patrons||0); };
  ensurePatronV2(); autoStaff(); prestigeBtn.onclick=openPrestige; save(); render();
})();