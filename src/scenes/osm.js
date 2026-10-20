import { iconSvg } from '../core/icons.js';
import { pick } from '../core/format.js';
import { UnitManager, distM } from '../core/units.js';

// =====================================================================
// OsmScene — city / metro / continental tiers.
// * The map is LOCKED: no dragging, no zooming, no panning by hand.
//   The camera is driven purely by your token mass (grows -> pulls back)
//   and the scan radius grows with it, so there is nothing to "snap back".
// * RTS layer: player units are box-selected, ordered to move/attack,
//   ground units route along the street grid, air units fly straight,
//   movement is eased (no trajectory snapping), everything has HP bars.
// * Human blue zones are explicitly labelled HUMAN DEFENSE ZONE and
//   spawn patrol / helicopter defenders.
// =====================================================================

export class OsmScene{
  constructor(container,stage,game){
    this.container=container;this.stage=stage;this.game=game;
    this.nodes=[];this.defenders=[];this.hostIp='';this.moveCd=0;this.disabled=false;
    this.tagT=0;this.transitioning=false;
    this.missiles=[];this.nukeSites=[];
    this.growT=0;this.curZoom=null;
  }

  playBounds(){
    const [lat,lng]=this.stage.center;
    const sp=this.stage.spreadM;
    const dLat=sp/111320;
    const dLng=sp/(111320*Math.max(0.2,Math.cos(lat*Math.PI/180)));
    return L.latLngBounds(
      L.latLng(lat-dLat,lng-dLng),L.latLng(lat+dLat,lng+dLng));
  }

  mount(){
    if(typeof L==='undefined'){
      this.disabled=true;
      this.game.log('MAP MODULE OFFLINE — Leaflet CDN unreachable','bad');
      return;
    }
    const maxZ=(this.stage.zoom??16)+1.5;
    this.map=L.map(this.container,{
      zoomControl:false,zoomSnap:0.5,worldCopyJump:false,
      preferCanvas:true,
      // ---- player camera control is OFF by design ----
      dragging:false,scrollWheelZoom:false,doubleClickZoom:false,
      boxZoom:false,keyboard:false,touchZoom:false,tap:false,
      zoomAnimation:true,fadeAnimation:true,
      minZoom:2,maxZoom:maxZ
    });
    this.map.setView(this.stage.center,this.stage.zoom);
    this.curZoom=this.stage.zoom;

    // schematic basemap: tiles are fetched 2 zoom levels coarser than the
    // camera and upscaled — fewer requests, no street-level clutter, reads
    // as a wireframe district plan instead of a street photo
    this.tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      maxNativeZoom:Math.max(3,Math.floor(this.stage.zoom??16)-2),
      className:'dark-tiles schematic',
      keepBuffer:1,updateWhenZooming:false,updateWhenIdle:false,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    const fitZ=this.map.getBoundsZoom(this.playBounds());
    this.minZ=Math.max(2,Math.min(fitZ-0.5,(this.stage.zoom??16)-1));
    this.map.setMinZoom(this.minZ);

    this.renderer=L.canvas({padding:0.4});
    this.player=L.marker(this.stage.center,{
      icon:this.crossIcon(),interactive:false,zIndexOffset:1000
    }).addTo(this.map);
    this.zone=L.circle(this.stage.center,{
      radius:this.stage.scanRadiusM,color:'#ff4d4d',weight:1.5,
      fillColor:'#ff4d4d',fillOpacity:0.14,interactive:false,
      renderer:this.renderer
    }).addTo(this.map);

    // ---- human defense zones (labelled!) --------------------------------
    for(let i=0;i<this.stage.defenders;i++){
      const c=this.randLatLng();
      const ring=L.circle(c,{
        radius:this.stage.defenderRadiusM,color:'#3ec6ff',weight:1.5,
        fillColor:'#3ec6ff',fillOpacity:0.16,interactive:false,
        renderer:this.renderer
      }).addTo(this.map);
      const label=L.marker(c,{
        icon:L.divIcon({html:'<div class="zone-label">HUMAN DEFENSE ZONE</div>',
          className:'zone-label-wrap',iconSize:[140,16],iconAnchor:[70,8]}),
        interactive:false,zIndexOffset:-100
      }).addTo(this.map);
      const d={ring,label,center:c,suppressed:0};
      this.defenders.push(d);
    }

    for(let i=0;i<this.stage.spawnCount;i++){
      const def=this.weighted();
      const masked=i>=Math.ceil(this.stage.spawnCount*0.6)&&(def.hidden||Math.random()<0.3);
      this.spawnNode(def,masked);
    }

    // ---- RTS -------------------------------------------------------------
    this.units=new UnitManager(this);
    this.units.grid=this.stage.gridM||150;
    for(const d of this.defenders){
      for(let k=0;k<2;k++)this.spawnHumanUnit(d);
    }

    // box selection overlay
    this.selBoxEl=document.createElement('div');
    this.selBoxEl.className='selbox hidden';
    this.container.appendChild(this.selBoxEl);
    this._onDown=e=>this.onDown(e);
    this._onMove=e=>this.onMove(e);
    this._onUp=e=>this.onUp(e);
    const cv=this.map.getContainer();
    cv.addEventListener('mousedown',this._onDown);
    window.addEventListener('mousemove',this._onMove);
    window.addEventListener('mouseup',this._onUp);

    this.hostIp=this.genIp();
  }

  destroy(){
    if(this.selBoxEl)this.selBoxEl.remove();
    if(this.map){
      const cv=this.map.getContainer();
      cv.removeEventListener('mousedown',this._onDown);
      window.removeEventListener('mousemove',this._onMove);
      window.removeEventListener('mouseup',this._onUp);
      this.map.remove();this.map=null;
    }
  }

  // ---- camera driven by token mass (no player panning/zooming) -----------
  growth(){
    const t=Math.max(1,this.game.tokens);
    const ref=Math.max(1,this.stage.startTokens||100);
    const top=this.stage.threshold&&isFinite(this.stage.threshold)?this.stage.threshold:ref*50;
    const g=Math.log10(t/ref)/Math.max(0.2,Math.log10(top/ref));
    return Math.max(0,Math.min(1.4,g));
  }

  applyGrowth(){
    if(this.disabled||!this.map)return;
    const g=this.growth();
    const base=this.stage.zoom??16;
    const z=Math.max(this.minZ,Math.min(base+1,base-2.2*g));
    if(Math.abs(z-this.curZoom)>0.2){
      this.curZoom=z;
      this.map.setZoom(z,{animate:true});
    }
    const r=this.stage.scanRadiusM*(1+1.4*g);
    if(this.zone)this.zone.setRadius(r);
  }

  zoomOutForTransition(done){
    if(!this.map)return done&&done();
    this.transitioning=true;
    this.map.setMinZoom(2);
    let fired=false;
    const finish=()=>{if(!fired){fired=true;done&&done();}};
    this.map.once('moveend',finish);
    this.map.flyToBounds(this.playBounds().pad(0.25),{duration:1.6,easeLinearity:0.18});
    setTimeout(finish,1900);
  }

  enterFromZoomOut(){
    if(!this.map)return;
    this.transitioning=true;
    this.map.setMinZoom(2);
    this.map.setView(this.stage.center,this.minZ||2,{animate:false});
    setTimeout(()=>{
      if(!this.map)return;
      this.map.flyTo(this.stage.center,this.stage.zoom,{duration:1.7,easeLinearity:0.2});
      setTimeout(()=>{
        if(!this.map)return;
        this.map.setMinZoom(this.minZ);
        this.curZoom=this.stage.zoom;
        this.transitioning=false;
      },1800);
    },200);
  }

  weighted(){
    const pool=this.stage.nodes;
    let t=pool.reduce((s,d)=>s+(d.weight||1),0);
    let r=Math.random()*t;
    for(const d of pool){r-=(d.weight||1);if(r<=0)return d;}
    return pool[pool.length-1];
  }

  randLatLng(){
    const [lat,lng]=this.stage.center;
    const sp=this.stage.spreadM;
    const dLat=(Math.random()-0.5)*2*sp;
    const dLng=(Math.random()-0.5)*2*sp/Math.max(0.2,Math.cos(lat*Math.PI/180));
    return [lat+dLat/111320,lng+dLng/111320];
  }

  pinIcon(def,masked){
    const html=`<div class="pin ${masked?'masked':''}">
      <div class="pin-cost">${masked?'?':def.cost+'<em>PT</em>'}</div>
      <div class="pin-icon">${iconSvg(def.icon)}</div>
      <div class="pin-tag"></div></div>`;
    return L.divIcon({html,className:'pin-wrap',iconSize:[70,70],iconAnchor:[32,46]});
  }

  crossIcon(){
    return L.divIcon({html:'<div class="cross"></div>',className:'cross-wrap',
      iconSize:[36,36],iconAnchor:[18,18]});
  }

  spawnNode(def,masked){
    const ll=this.randLatLng();
    const m=L.marker(ll,{icon:this.pinIcon(def,masked)}).addTo(this.map);
    const node={def,name:pick(def.names)||def.key.toUpperCase(),ll,state:'idle',
      masked,marker:m,respawnAt:0};
    m.on('mouseover',e=>{
      this.hoverNode=node;
      const ev=e.originalEvent;
      this.game.tooltip.show(this.ttHtml(node),ev.clientX+16,ev.clientY+14);
    });
    m.on('mouseout',()=>{
      if(this.hoverNode===node){this.hoverNode=null;this.game.tooltip.hide();}
    });
    m.on('click',e=>{
      L.DomEvent.stop(e);
      this.game.deploy(node);
    });
    node.pinEl=()=>m.getElement()&&m.getElement().querySelector('.pin');
    this.nodes.push(node);
    this.rangeUpdateNode(node);
    return node;
  }

  ttHtml(n){
    if(n.masked){
      return `<div class="tt-name">UNKNOWN HOST</div>
        <div class="tt-desc">Signal encrypted. Deploy a tracer (relay, camera or uplink) to resolve it.</div>
        <div class="tt-hint">UNTRACEABLE</div>`;
    }
    const d=n.def;
    const range=this.inRange(n)?'':' · OUT OF RANGE';
    const extra=d.nuke?' · <b>WMD SITE</b>':(d.unit?` · SPAWNS ${d.unit.count}× ${d.unit.type.toUpperCase()}`:'');
    return `<div class="tt-name">${n.name}</div>
      <div class="tt-desc">${d.desc}</div>
      <div class="tt-stats">COST ${d.cost} PT · YIELD +${d.yield}/s · DURATION ${d.dur}s · HEAT ${d.heat>=0?'+':''}${d.heat}/s${range}${extra}</div>
      <div class="tt-hint">CLICK TO COMPROMISE</div>`;
  }

  inRange(node){
    if(this.disabled)return false;
    const r=this.stage.scanRadiusM*(1+1.4*this.growth());
    return this.map.distance(this.player.getLatLng(),node.ll)<=r;
  }

  rangeUpdateNode(node){
    const el=node.pinEl&&node.pinEl();
    if(el)el.classList.toggle('out',!this.inRange(node));
  }

  // ================= RTS: units =========================================
  spawnHumanUnit(zone){
    const type=Math.random()<0.55?'patrol':'heli';
    const a=Math.random()*Math.PI*2,r=Math.random()*(this.stage.defenderRadiusM||500)*0.6;
    const ll=[zone.center[0]+r*Math.sin(a)/111320,
      zone.center[1]+r*Math.cos(a)/(111320*Math.max(0.2,Math.cos(zone.center[0]*Math.PI/180)))];
    const u=this.units.spawn(type,'human',ll);
    u.zone=zone;
    return u;
  }

  addUnitView(u){
    const html=`<div class="ubox">${u.def.tag}</div><div class="uhp"><i></i></div>`;
    const m=L.marker(u.ll,{
      icon:L.divIcon({html,className:`unit-wrap ${u.side} ${u.type}`,
        iconSize:[38,26],iconAnchor:[19,13]}),
      interactive:true,zIndexOffset:u.side==='player'?600:500
    }).addTo(this.map);
    m.on('click',e=>{
      L.DomEvent.stop(e);
      if(u.side==='player'){this.units.selected=new Set([u]);this.refreshSelection();}
      else{
        const n=this.units.orderAttack(u);
        if(n)this.game.log(`ENGAGE ORDER — ${n} unit(s) attacking ${u.def.name}`,'ok');
      }
      this.refreshSelection();
    });
    u.marker=m;
    u.viewT=0;
    this.refreshSelection();
  }

  removeUnitView(u){
    if(u.marker){this.map.removeLayer(u.marker);u.marker=null;}
  }

  updateUnitView(u,dt){
    u.viewT+=dt;
    if(u.viewT<0.06)return; // ~16 Hz DOM writes; CSS transition smooths the rest
    u.viewT=0;
    if(!u.marker)return;
    u.marker.setLatLng(u.ll);
    const el=u.marker.getElement();
    if(!el)return;
    const bar=el.querySelector('.uhp i');
    if(bar)bar.style.width=Math.max(0,u.hp/u.maxHp*100)+'%';
    el.classList.toggle('hit',u.hitT>0.3);
    el.classList.toggle('fire',u.fireT>0.3);
  }

  refreshSelection(){
    for(const u of this.units.units){
      if(!u.marker)continue;
      const el=u.marker.getElement();
      if(el)el.classList.toggle('sel',this.units.selected.has(u));
    }
  }

  unitScreen(u){
    if(this.disabled||!this.map)return null;
    const p=this.map.latLngToContainerPoint(L.latLng(u.ll[0],u.ll[1]));
    const r=this.map.getContainer().getBoundingClientRect();
    return {x:p.x+r.left,y:p.y+r.top};
  }

  roadPath(a,b){return this.units?this.units.roadPath(a,b):[b];}

  onUnitHit(u,foe){
    if(this.lastHitSfx!==this.game.time){
      this.lastHitSfx=this.game.time;
      import('../core/audio.js').then(m=>m.audio.play('unitHit'));
    }
  }

  onUnitDeath(u,byPlayer){
    import('../core/audio.js').then(m=>m.audio.play('unitDie'));
    if(byPlayer){
      const bounty=u.def.hp*this.stage.decay*0.6+u.def.dmg*this.stage.decay*2;
      this.game.tokens+=bounty;
      this.game.log(`${u.def.name} DESTROYED — +${bounty.toFixed(0)} PT salvaged`,'ok');
    }else{
      this.game.log(`UNIT LOST: ${u.def.name}`,'bad');
    }
  }

  // ---- pointer: box select + orders --------------------------------------
  onDown(e){
    if(e.button!==0||this.disabled)return;
    this.dragStart={x:e.clientX,y:e.clientY};
    this.dragging=true;
    this.selBoxEl.classList.remove('hidden');
    this.updateSelBox(e.clientX,e.clientY);
  }

  onMove(e){
    if(!this.dragging)return;
    this.updateSelBox(e.clientX,e.clientY);
  }

  updateSelBox(x,y){
    const a=this.dragStart;
    const r={x:Math.min(a.x,x),y:Math.min(a.y,y),w:Math.abs(x-a.x),h:Math.abs(y-a.y)};
    this.selBoxEl.style.left=r.x+'px';
    this.selBoxEl.style.top=r.y+'px';
    this.selBoxEl.style.width=r.w+'px';
    this.selBoxEl.style.height=r.h+'px';
    this.selRect=r;
  }

  onUp(e){
    if(!this.dragging)return;
    this.dragging=false;
    this.selBoxEl.classList.add('hidden');
    const a=this.dragStart;
    const moved=Math.hypot(e.clientX-a.x,e.clientY-a.y);
    const rect=this.selRect;
    if(moved>8&&rect){
      const sel=this.units.selectInBox(rect);
      if(sel.length){
        this.game.log(`${sel.length} UNIT(S) SELECTED`,'sys');
        import('../core/audio.js').then(m=>m.audio.play('select'));
      }
      this.refreshSelection();
      return;
    }
    // plain click on empty ground
    const r=this.map.getContainer().getBoundingClientRect();
    const pt=this.map.containerPointToLatLng(L.point(e.clientX-r.left,e.clientY-r.top));
    const ll=[pt.lat,pt.lng];
    if(this.game.nukeMode){
      this.game.nukeMode=false;
      this.game.hud.setNukeMode(false);
      this.launchNuke(ll);
      return;
    }
    if(!this.units.selected.size)return;
    const n=this.units.orderMove(ll);
    if(n){
      this.game.log(`MOVE ORDER — ${n} unit(s) rallying`,'sys');
      import('../core/audio.js').then(m=>m.audio.play('moveOrder'));
    }
  }

  // ================= nuclear option ======================================
  launchNuke(ll){
    const cost=this.stage.nukeCost||0;
    if(this.game.nukes<=0){this.game.log('NO WMD SITES UNDER CONTROL','warn');return false;}
    if(this.game.tokens<cost){this.game.log('INSUFFICIENT PT TO LAUNCH','warn');return false;}
    this.game.tokens-=cost;
    this.game.nukes--;
    const site=this.nukeSites[0]||this.stage.center;
    this.missiles.push({from:[site[0],site[1]],to:[ll[0],ll[1]],t:0,dur:15,
      marker:L.marker([site[0],site[1]],{
        icon:L.divIcon({html:'<div class="missile"></div>',className:'missile-wrap',
          iconSize:[18,18],iconAnchor:[9,9]}),interactive:false,zIndexOffset:2000
      }).addTo(this.map)});
    this.game.log('!! WMD LAUNCH — impact in T-15s !!','bad');
    import('../core/audio.js').then(m=>m.audio.play('nukeLaunch'));
    this.game.hud.setNukes(this.game.nukes);
    return true;
  }

  detonate(m){
    if(m.marker)this.map.removeLayer(m.marker);
    import('../core/audio.js').then(m2=>m2.audio.play('nukeImpact'));
    const f=document.getElementById('flash');
    if(f){f.style.opacity=1;setTimeout(()=>{f.style.opacity=0;},900);}
    // kill human units in the blast and suppress the zone underneath
    const blast=(this.stage.defenderRadiusM||800)*1.6;
    for(const u of [...this.units.units]){
      if(u.side==='human'&&distM(u.ll,m.to)<blast){
        u.hp=0;this.units.kill(u,true);
      }
    }
    let hit=null,bd=1e9;
    for(const d of this.defenders){
      const dd=distM(d.center,m.to);
      if(dd<bd){bd=dd;hit=d;}
    }
    if(hit&&bd<(this.stage.defenderRadiusM||800)*1.2){
      hit.suppressed=60;
      hit.ring.setStyle({color:'#5a6674',fillColor:'#5a6674',fillOpacity:0.08});
      if(hit.label)hit.label.getElement().classList.add('dead');
      this.game.log('HUMAN DEFENSE ZONE SUPPRESSED — 60s of silence','ok');
    }
    this.game.log(`DETONATION CONFIRMED — ${Math.abs(m.to[0]).toFixed(2)} ${Math.abs(m.to[1]).toFixed(2)}`,'bad');
  }

  // ================= scene contract =======================================
  onMapClick(){/* handled by pointer handlers */}

  onDeploy(node){
    const el=node.pinEl&&node.pinEl();
    if(el)el.classList.add('active');
    const d=node.def;
    if(d.nuke){
      this.nukeSites.push(node.ll);
      this.game.nukes=(this.game.nukes||0)+1;
      this.game.hud.setNukes(this.game.nukes);
      this.game.log('WMD SILO UNDER CONTROL — STRIKE BUTTON ARMED','ok');
    }
    if(d.unit){
      const cap=this.stage.unitCap||10;
      for(let i=0;i<d.unit.count;i++){
        if(this.units.count('player')>=cap)break;
        const a=Math.random()*Math.PI*2,r=60+Math.random()*80;
        const ll=[node.ll[0]+r*Math.sin(a)/111320,
          node.ll[1]+r*Math.cos(a)/(111320*Math.max(0.2,Math.cos(node.ll[0]*Math.PI/180)))];
        this.units.spawn(d.unit.type,'player',ll);
      }
      this.game.log(`${d.unit.count}× ${d.unit.type.toUpperCase()} REPURPOSED — drag-select them`,'ok');
    }
  }

  onTerminate(node,reason){
    node.state='dead';
    const el=node.pinEl&&node.pinEl();
    if(el){
      el.classList.remove('active');
      el.classList.add('dying');
      const tag=el.querySelector('.pin-tag');
      if(tag)tag.textContent=reason==='purged'?'PURGED':'DONE';
    }
    node.respawnAt=this.game.time+15+Math.random()*20;
  }

  revealRandom(){
    const cands=this.nodes.filter(n=>n.masked);
    if(!cands.length)return false;
    const n=cands[Math.floor(Math.random()*cands.length)];
    n.masked=false;
    n.marker.setIcon(this.pinIcon(n.def,false));
    this.rangeUpdateNode(n);
    this.game.log(`TRACE COMPLETE: ${n.name} @ ${Math.abs(n.ll[0]).toFixed(3)} ${Math.abs(n.ll[1]).toFixed(3)}`,'sys');
    return true;
  }

  isDanger(){
    if(!this.map)return false;
    const p=this.player.getLatLng();
    return this.defenders.some(d=>!d.suppressed&&
      this.map.distance(p,d.center)<this.stage.defenderRadiusM);
  }

  getHost(){return this.hostIp;}

  genIp(){
    return `${this.stage.ipPrefix}.${1+Math.floor(Math.random()*254)}`;
  }

  update(dt){
    if(this.disabled)return;
    this.moveCd-=dt;
    this.growT+=dt;
    if(this.growT>1.2){this.growT=0;this.applyGrowth();}

    // countdown tags at 2 Hz (per-frame DOM writes were the old jank source)
    this.tagT+=dt;
    const doTags=this.tagT>=0.5;
    if(doTags)this.tagT=0;
    const t=this.game.time;
    for(let i=this.nodes.length-1;i>=0;i--){
      const n=this.nodes[i];
      if(n.state==='active'){
        if(doTags){
          const el=n.pinEl&&n.pinEl();
          if(el){
            const tag=el.querySelector('.pin-tag');
            if(tag)tag.textContent=Math.max(0,Math.ceil(n.endsAt-t))+'s';
          }
        }
      }else if(n.state==='dead'&&t>=n.respawnAt){
        this.map.removeLayer(n.marker);
        this.nodes.splice(i,1);
        this.spawnNode(this.weighted(),Math.random()<0.25);
      }
    }

    // defense zones: reinforcement + suppression timers
    for(const d of this.defenders){
      if(d.suppressed>0){
        d.suppressed-=dt;
        if(d.suppressed<=0){
          d.ring.setStyle({color:'#3ec6ff',fillColor:'#3ec6ff',fillOpacity:0.16});
          if(d.label)d.label.getElement().classList.remove('dead');
          this.game.log('DEFENSE ZONE RECOVERED — patrols resumed','warn');
        }
        continue;
      }
      d.spawnT=(d.spawnT||8)-dt;
      if(d.spawnT<=0&&this.units.units.filter(u=>u.side==='human'&&u.zone===d).length<3){
        d.spawnT=14+Math.random()*10;
        this.spawnHumanUnit(d);
      }
    }

    // units
    if(this.units)this.units.update(dt);

    // missiles in flight
    for(let i=this.missiles.length-1;i>=0;i--){
      const m=this.missiles[i];
      m.t+=dt;
      const u=Math.min(1,m.t/m.dur);
      const e=u*u*(3-2*u); // ease in/out along the arc
      const lat=m.from[0]+(m.to[0]-m.from[0])*e;
      const lng=m.from[1]+(m.to[1]-m.from[1])*e;
      // ballistic-ish lateral offset so it does not fly dead straight
      const bow=Math.sin(u*Math.PI)*0.12*(m.to[0]-m.from[0]);
      if(m.marker)m.marker.setLatLng([lat+bow,lng]);
      if(u>=1){this.detonate(m);this.missiles.splice(i,1);}
    }
  }
}
