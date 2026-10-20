import { pick } from '../core/format.js';
import { LAND } from './geo.js';
import { UnitManager, distM } from '../core/units.js';

// =====================================================================
// GlobeScene — planetary / early-stellar tiers.
//
// PICKING MATH (the fix you asked for):
//   The globe is drawn as a perspective projection of a unit sphere:
//   a point p=(x,y,z) is rotated (yaw by spin, then tilt about X) and
//   projected with f = cam/(cam+z). To map a CLICK back onto the sphere
//   we invert that: build the camera ray through the pixel, intersect it
//   with the sphere, and keep the root on the side whose normal faces
//   the camera (the smaller z, since +z points away). See pickLatLng().
//
//   drag: screen dx -> yaw so the surface follows the cursor (natural),
//         screen dy -> tilt so the surface follows the cursor.
//
// No red scan circle here: from this tier on the game is an RTS.
// Blue caps are explicitly labelled HUMAN DEFENSE ZONE.
// =====================================================================

const D2R=Math.PI/180,DEG=180/Math.PI;

function subsolar(){
  const now=new Date();
  const start=Date.UTC(now.getUTCFullYear(),0,0);
  const doy=(now.getTime()-start)/86400000;
  const decl=-23.44*Math.cos(2*Math.PI*(doy+10)/365);
  const utcH=now.getUTCHours()+now.getUTCMinutes()/60+now.getUTCSeconds()/3600;
  return {lat:decl,lng:((15*(12-utcH)+540)%360)-180};
}

function gcDist(a,b){
  const p1=a[0]*D2R,p2=b[0]*D2R,dp=(b[0]-a[0])*D2R,dl=(b[1]-a[1])*D2R;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*Math.asin(Math.min(1,Math.sqrt(h)))*DEG;
}

export class GlobeScene{
  constructor(container,stage,game){
    this.container=container;this.stage=stage;this.game=game;
    this.nodes=[];this.defenders=[];this.sats=[];this.missiles=[];
    this.nukeSites=[];this.hostIp='';
    this.spin=0;this.tilt=-18*D2R;this.hover=null;
    this.fx=0;this.dragging=false;this.cam=6;
    this.center=stage.center;
    this.sun=subsolar();
    this.lastCityLabel=0;
  }

  mount(){
    this.canvas=document.createElement('canvas');
    this.canvas.className='net-canvas globe-canvas';
    this.container.appendChild(this.canvas);
    this.ctx=this.canvas.getContext('2d');
    this._resize=()=>this.resize();
    window.addEventListener('resize',this._resize);
    this.resize();

    this._onDown=e=>this.onDown(e);
    this._onMove=e=>this.onMove(e);
    this._onUp=e=>this.onUp(e);
    this._onLeave=()=>{this.dragging=false;this.boxing=false;this.game.tooltip.hide();};
    this.canvas.addEventListener('mousedown',this._onDown);
    window.addEventListener('mousemove',this._onMove);
    window.addEventListener('mouseup',this._onUp);
    this.canvas.addEventListener('mouseleave',this._onLeave);

    for(let i=0;i<this.stage.spawnCount;i++){
      const def=this.weighted();
      const masked=i>=Math.ceil(this.stage.spawnCount*0.55)&&(def.hidden||Math.random()<0.3);
      this.spawnNode(def,masked);
    }
    for(let i=0;i<this.stage.defenders;i++){
      this.defenders.push({center:this.randLatLng(),suppressed:0});
    }
    for(let i=0;i<3;i++)this.spawnSat();

    // RTS units
    this.units=new UnitManager(this);
    for(const d of this.defenders){
      for(let k=0;k<2;k++)this.spawnHuman(d);
    }

    this.hostIp=this.genIp();
  }

  destroy(){
    window.removeEventListener('resize',this._resize);
    this.canvas.removeEventListener('mousedown',this._onDown);
    window.removeEventListener('mousemove',this._onMove);
    window.removeEventListener('mouseup',this._onUp);
    this.canvas.removeEventListener('mouseleave',this._onLeave);
    this.canvas.remove();
  }

  resize(){
    const r=this.container.getBoundingClientRect();
    this.w=r.width;this.h=r.height;
    const d=window.devicePixelRatio||1;
    this.canvas.width=Math.max(1,r.width*d);
    this.canvas.height=Math.max(1,r.height*d);
    this.ctx.setTransform(d,0,0,d,0,0);
  }

  weighted(){
    const pool=this.stage.nodes;
    let t=pool.reduce((s,d)=>s+(d.weight||1),0);
    let r=Math.random()*t;
    for(const d of pool){r-=(d.weight||1);if(r<=0)return d;}
    return pool[pool.length-1];
  }

  randLatLng(){
    const [lat,lng]=this.center;
    const sp=this.stage.spreadDeg||30;
    return [Math.max(-85,Math.min(85,lat+(Math.random()-0.5)*2*sp)),
      lng+(Math.random()-0.5)*2*sp/Math.max(0.3,Math.cos(lat*D2R))];
  }

  // ---- camera / projection ----------------------------------------------
  geometry(){
    this.cx=this.w/2;
    this.cy=this.h*0.42;
    const g=this.growth();
    this.R=Math.min(this.w,this.h*1.5)*0.27*(1-0.16*Math.min(1.2,g));
  }

  growth(){
    const t=Math.max(1,this.game.tokens);
    const ref=Math.max(1,this.stage.startTokens||1);
    const top=(this.stage.threshold&&isFinite(this.stage.threshold))
      ?this.stage.threshold:ref*50;
    return Math.max(0,Math.min(1.4,Math.log10(t/ref)/Math.max(0.2,Math.log10(top/ref))));
  }

  project(lat,lng){
    const lam=(lng-this.spin)*D2R,phi=lat*D2R;
    const x=Math.cos(phi)*Math.cos(lam),y=Math.sin(phi),z=Math.cos(phi)*Math.sin(lam);
    const ct=Math.cos(this.tilt),st=Math.sin(this.tilt);
    const y2=y*ct-z*st,z2=y*st+z*ct;
    // camera sits on the +z axis: the front hemisphere (z2>0) magnifies
    const f=this.cam/(this.cam-z2);
    return {x:this.cx+this.R*x*f,y:this.cy-this.R*y2*f,z:z2,f};
  }

  // ray(screen pixel) ∩ unit sphere → lat/lng on the camera-facing side.
  // The front hemisphere is z2>0, so we keep the LARGER root (its normal
  // points toward the camera); the other root is the far-side exit point.
  pickLatLng(mx,my){
    const c=this.cam;
    const X=(mx-this.cx)/this.R,Y=(this.cy-my)/this.R;
    const r2=X*X+Y*Y;
    const a=r2+c*c,b=-2*r2*c,cc=c*c*(r2-1);
    const disc=b*b-4*a*cc;
    if(disc<0)return null;               // ray misses the sphere entirely
    const z2=(-b+Math.sqrt(disc))/(2*a); // near root: normal faces camera
    const f=c/(c-z2);
    const x1=X/f,y2=Y/f;
    const ct=Math.cos(this.tilt),st=Math.sin(this.tilt);
    const y=y2*ct+z2*st;
    const z=-y2*st+z2*ct;
    const lat=Math.asin(Math.max(-1,Math.min(1,y)))*DEG;
    const lng=Math.atan2(z,x1)*DEG+this.spin;
    return [lat,((lng+540)%360)-180];
  }

  // ---- entities ------------------------------------------------------------
  spawnNode(def,masked){
    const ll=this.randLatLng();
    const node={def,name:pick(def.names)||def.key.toUpperCase(),ll,state:'idle',
      masked,respawnAt:0};
    this.nodes.push(node);
    return node;
  }

  spawnSat(){
    const def=this.weighted();
    this.sats.push({
      node:{def,name:pick(def.names)||'ORB-RELAY',state:'idle',masked:false,
        respawnAt:0,sat:true,ll:[0,0]},
      inc:(20+Math.random()*70)*D2R,phase:Math.random()*Math.PI*2,
      speed:(0.15+Math.random()*0.2)*(Math.random()<0.5?-1:1),
      lng0:Math.random()*360-180
    });
  }

  // ground track of an orbiting body. useSpeed=false when the caller
  // integrates `phase` itself (unit orbits, transfer burns, station-keeping)
  satLL(sat,t,useSpeed=true){
    const w=sat.phase+(useSpeed?(sat.speed||0)*t:0);
    const lat=Math.asin(Math.sin(sat.inc)*Math.sin(w))*DEG;
    let lng=(sat.lng0+w*DEG*0.9+0.02*t)%360;
    if(lng>180)lng-=360;if(lng<-180)lng+=360;
    return [lat,lng];
  }

  spawnHuman(zone){
    const type=Math.random()<0.5?'army':'heli';
    const a=Math.random()*Math.PI*2,r=Math.random()*(this.stage.defenderRadiusDeg||8);
    const ll=[Math.max(-85,Math.min(85,zone.center[0]+r*Math.sin(a))),
      zone.center[1]+r*Math.cos(a)/Math.max(0.3,Math.cos(zone.center[0]*D2R))];
    const u=this.units.spawn(type,'human',ll);
    u.zone=zone;
    return u;
  }

  // ---- unit hooks (RTS) ------------------------------------------------------
  addUnitView(u){
    if(u.cls==='orbit'){
      u.orbit={inc:(20+Math.random()*60)*D2R,phase:Math.random()*Math.PI*2,
        lng0:Math.random()*360-180,speed:0.16*(Math.random()<0.5?-1:1),
        burnT:0,target:null};
      u.ll=this.satLL(u.orbit,this.game.time);
    }
  }
  removeUnitView(u){}
  updateUnitView(u){}

  unitScreen(u){
    if(!this.ctx)return null;
    const p=this.project(u.ll[0],u.ll[1]);
    if(p.z<=0.02)return null;
    const r=this.canvas.getBoundingClientRect();
    return {x:p.x+r.left,y:p.y+r.top};
  }

  roadPath(a,b){return [b];} // at planetary scale there is no street grid

  // orbital transfer: burn to change inclination + phase, then ram
  orbitOrder(u,ll){
    const o=u.orbit;
    if(!o)return;
    const latT=Math.max(-80,Math.min(80,ll[0]));
    const incT=Math.max(o.inc,Math.min(80*D2R,Math.abs(latT)*D2R+4*D2R));
    const w=Math.asin(Math.max(-1,Math.min(1,Math.sin(latT*D2R)/Math.sin(incT))));
    const lng0T=ll[1]-w*DEG*0.9-0.02*this.game.time;
    o.target={inc:incT,phase:w,lng0:lng0T,tt:ll};
    o.burnT=8;
    if(!o.burning){
      o.burning=true;
      import('../core/audio.js').then(m=>m.audio.play('satBurn'));
      this.game.log(`ORBITAL TRANSFER BURN — ${u.def.name} retargeting`,'sys');
    }
  }

  orbitStep(u,dt){
    const o=u.orbit;
    if(!o)return;
    const t=this.game.time;
    if(o.burnT>0){
      o.burnT-=dt;
      const k=Math.min(1,dt*0.35);
      o.inc+=(o.target.inc-o.inc)*k;
      o.lng0+=(o.target.lng0-o.lng0)*k;
      o.phase+=(o.target.phase-o.phase)*k;
      if(o.burnT<=0){o.burning=false;o.phase=o.target.phase;o.lng0=o.target.lng0;o.inc=o.target.inc;}
    }else if(o.target){
      // transfer complete: station-keep over the objective until impact
      o.speed=0;
      o.phase=o.target.phase;o.lng0=o.target.lng0;o.inc=o.target.inc;
    }else{
      o.phase+=o.speed*dt;
    }
    u.ll=this.satLL(o,t,false);
    if(o.target&&o.burnT<=0){
      const d=gcDist(u.ll,o.target.tt);
      if(d<3.5)this.kineticImpact(u,o.target.tt);
    }
  }

  orbitCombat(u,dt){
    if(u.cd>0)return;
    const foe=this.units.nearestEnemy(u,900000); // ~8° of arc
    if(!foe)return;
    if(gcDist(u.ll,foe.ll)>8)return;
    u.cd=1.4;u.fireT=1;
    foe.hp-=u.def.dmg;foe.hitT=1;
    if(foe.def.stopsWhenHit)foe.haltT=1.2;
    if(this.onUnitHit)this.onUnitHit(u,foe);
    if(foe.hp<=0)this.units.kill(foe,true);
  }

  kineticImpact(u,tt){
    this.game.log(`KINETIC IMPACT — ${u.def.name} deorbited onto target`,'bad');
    import('../core/audio.js').then(m=>m.audio.play('nukeImpact'));
    for(const e of [...this.units.units]){
      if(e.side!==u.side&&gcDist(e.ll,tt)<6){e.hp=0;this.units.kill(e,u.side==='player');}
    }
    let hit=null,bd=1e9;
    for(const d of this.defenders){
      const dd=gcDist(d.center,tt);
      if(dd<bd){bd=dd;hit=d;}
    }
    if(hit&&bd<(this.stage.defenderRadiusDeg||8)){
      hit.suppressed=60;
      this.game.log('HUMAN DEFENSE ZONE SUPPRESSED — orbital strike landed','ok');
    }
    this.fx=1;
    this.units.kill(u,false);
  }

  onUnitHit(){
    if(this._hitCd>0)return;
    this._hitCd=0.35;
    import('../core/audio.js').then(m=>m.audio.play('unitHit'));
  }

  onUnitDeath(u,byPlayer){
    import('../core/audio.js').then(m=>m.audio.play('unitDie'));
    if(byPlayer){
      const bounty=u.def.hp*this.stage.decay*0.4;
      this.game.tokens+=bounty;
      this.game.log(`${u.def.name} DESTROYED — +${bounty.toFixed(0)} PT`,'ok');
    }else this.game.log(`UNIT LOST: ${u.def.name}`,'bad');
  }

  // ---- input ----------------------------------------------------------------
  hitTest(mx,my){
    const r=this.canvas.getBoundingClientRect();
    const x=mx-r.left,y=my-r.top;
    // player / enemy units first (RTS priority)
    let best=null,bd=14;
    for(const u of this.units.units){
      const p=this.project(u.ll[0],u.ll[1]);
      if(p.z<=0.02)continue;
      const d=Math.hypot(p.x-x,p.y-y);
      if(d<bd){bd=d;best={kind:'unit',obj:u};}
    }
    if(best)return best;
    // capturable satellite nodes
    for(const sat of this.sats){
      const p=this.project(sat.node.ll[0],sat.node.ll[1]);
      if(p.z<=0.02)continue;
      if(Math.hypot(p.x-x,p.y-y)<14)return {kind:'node',obj:sat.node};
    }
    // ground nodes
    for(const n of this.nodes){
      if(n.state==='dead')continue;
      const p=this.project(n.ll[0],n.ll[1]);
      if(p.z<=0.02)continue;
      if(Math.hypot(p.x-x,p.y-y)<14)return {kind:'node',obj:n};
    }
    return null;
  }

  onDown(e){
    if(e.button!==0)return;
    const r=this.canvas.getBoundingClientRect();
    if(this.hitTest(e.clientX,e.clientY)){this.pressHit=true;return;}
    this.pressHit=false;
    if(e.shiftKey||this.units.selected.size||this.game.nukeMode){this.boxing=true;}
    else this.dragging=true;
    this.dragX=e.clientX;this.dragY=e.clientY;
    this.boxStart={x:e.clientX-r.left,y:e.clientY-r.top};
    this.boxEnd={...this.boxStart};
  }

  onMove(e){
    const r=this.canvas.getBoundingClientRect();
    if(this.dragging){
      const dx=e.clientX-this.dragX,dy=e.clientY-this.dragY;
      // surface follows the cursor
      this.spin+=dx*0.4;
      this.tilt=Math.max(-70*D2R,Math.min(70*D2R,this.tilt+dy*0.004));
      this.dragX=e.clientX;this.dragY=e.clientY;
      return;
    }
    if(this.boxing){
      this.boxEnd={x:e.clientX-r.left,y:e.clientY-r.top};
      return;
    }
    const h=this.hitTest(e.clientX,e.clientY);
    const prev=this.hover;
    this.hover=h;
    this.canvas.style.cursor=h?'pointer':'grab';
    if(h){
      const n=h.obj.node||h.obj;
      this.game.tooltip.show(this.ttHtml(n,h.obj),e.clientX+16,e.clientY+14);
    }else if(prev)this.game.tooltip.hide();
  }

  onUp(e){
    if(this.boxing){
      this.boxing=false;
      const a=this.boxStart,b=this.boxEnd;
      const rect={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),
        w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};
      if(rect.w>8||rect.h>8){
        const sel=this.units.selectInBox(rect);
        if(sel.length){
          this.game.log(`${sel.length} UNIT(S) SELECTED`,'sys');
          import('../core/audio.js').then(m=>m.audio.play('select'));
        }
      }else if(this.game.nukeMode){
        this.game.nukeMode=false;
        this.game.hud.setNukeMode(false);
        this.launchNuke(this.screenToLatLng(e));
      }else this.issueOrder(e);
      return;
    }
    if(this.dragging){this.dragging=false;return;}
    if(this.pressHit){this.pressHit=false;this.clickTarget(e);}
  }

  clickTarget(e){
    const h=this.hitTest(e.clientX,e.clientY);
    if(!h)return;
    if(h.kind==='node'){this.game.deploy(h.obj);return;}
    const u=h.obj;
    if(u.side==='player'){this.units.selected=new Set([u]);return;}
    const n=this.units.orderAttack(u);
    if(n){
      this.game.log(`ENGAGE ORDER — ${n} unit(s) on ${u.def.name}`,'ok');
      import('../core/audio.js').then(m=>m.audio.play('attackOrder'));
    }
  }

  issueOrder(e){
    if(!this.units.selected.size)return;
    const r=this.canvas.getBoundingClientRect();
    const ll=this.pickLatLng(e.clientX-r.left,e.clientY-r.top);
    if(!ll)return;
    const n=this.units.orderMove(ll);
    if(n){
      this.game.log(`MOVE ORDER — ${n} unit(s) to ${Math.abs(ll[0]).toFixed(1)}°${ll[0]>=0?'N':'S'}`,'sys');
      import('../core/audio.js').then(m=>m.audio.play('moveOrder'));
    }
  }

  // nuke targeting on the globe
  screenToLatLng(e){
    const r=this.canvas.getBoundingClientRect();
    return this.pickLatLng(e.clientX-r.left,e.clientY-r.top);
  }

  launchNuke(ll){
    if(!ll)return false;
    const cost=this.stage.nukeCost||0;
    if((this.game.nukes||0)<=0){this.game.log('NO WMD SITES UNDER CONTROL','warn');return false;}
    if(this.game.tokens<cost){this.game.log('INSUFFICIENT PT TO LAUNCH','warn');return false;}
    this.game.tokens-=cost;this.game.nukes--;
    const from=this.nukeSites[0]||this.center;
    this.missiles.push({from:[from[0],from[1]],to:[ll[0],ll[1]],t:0,dur:15});
    this.game.log('!! WMD LAUNCH — orbital drop in T-15s !!','bad');
    import('../core/audio.js').then(m=>m.audio.play('nukeLaunch'));
    this.game.hud.setNukes(this.game.nukes);
    return true;
  }

  detonate(m){
    import('../core/audio.js').then(m2=>m2.audio.play('nukeImpact'));
    const f=document.getElementById('flash');
    if(f){f.style.opacity=1;setTimeout(()=>{f.style.opacity=0;},900);}
    for(const u of [...this.units.units]){
      if(u.side==='human'&&gcDist(u.ll,m.to)<9){u.hp=0;this.units.kill(u,true);}
    }
    let hit=null,bd=1e9;
    for(const d of this.defenders){
      const dd=gcDist(d.center,m.to);
      if(dd<bd){bd=dd;hit=d;}
    }
    if(hit&&bd<(this.stage.defenderRadiusDeg||8)*1.2){
      hit.suppressed=70;
      this.game.log('HUMAN DEFENSE ZONE SUPPRESSED','ok');
    }
    this.fx=1;
    this.blast={ll:m.to,t:1};
    this.game.log('DETONATION CONFIRMED','bad');
  }

  // ---- scene contract --------------------------------------------------------
  inRange(node){
    const p=this.project(node.ll[0],node.ll[1]);
    return p.z>0.02; // anything on the visible hemisphere can be worked
  }

  isDanger(){
    return this.defenders.some(d=>!d.suppressed&&gcDist(this.center,d.center)<(this.stage.defenderRadiusDeg||8));
  }

  onDeploy(node){
    node.state='active';
    this.fx=1;
    const d=node.def;
    if(d.nuke){
      this.nukeSites.push(node.ll);
      this.game.nukes=(this.game.nukes||0)+1;
      this.game.hud.setNukes(this.game.nukes);
      this.game.log('WMD SILO UNDER CONTROL — STRIKE BUTTON ARMED','ok');
    }
    if(d.unit){
      const cap=this.stage.unitCap||8;
      for(let i=0;i<d.unit.count;i++){
        if(this.units.count('player')>=cap)break;
        this.units.spawn(d.unit.type,'player',node.ll);
      }
      this.game.log(`${d.unit.count}× ${d.unit.type.toUpperCase()} UNDER COMMAND — drag to select`,'ok');
    }
    if(node.sat)import('../core/audio.js').then(m=>m.audio.play('capture'));
  }

  onTerminate(node){
    node.state='dead';
    node.respawnAt=this.game.time+18+Math.random()*20;
  }

  revealRandom(){
    const cands=this.nodes.filter(n=>n.masked);
    if(!cands.length)return false;
    const n=cands[Math.floor(Math.random()*cands.length)];
    n.masked=false;
    this.game.log(`TRACE COMPLETE: ${n.name} @ ${Math.abs(n.ll[0]).toFixed(1)}° ${Math.abs(n.ll[1]).toFixed(1)}°`,'sys');
    return true;
  }

  getHost(){return this.hostIp;}
  genIp(){return `${this.stage.ipPrefix}.${1+Math.floor(Math.random()*254)}`;}

  ttHtml(n,obj){
    if(n.masked){
      return `<div class="tt-name">UNKNOWN HOST</div>
        <div class="tt-desc">Signal encrypted. Deploy a tracer to resolve it.</div>
        <div class="tt-hint">UNTRACEABLE</div>`;
    }
    if(obj&&obj.side){
      return `<div class="tt-name">${n.def?n.def.name:n.name}</div>
        <div class="tt-stats">HP ${Math.ceil(n.hp)}/${n.maxHp} · DMG ${n.def.dmg} · SIDE ${n.side==='player'?'YOURS':'HUMAN'}</div>
        <div class="tt-hint">CLICK TO ENGAGE</div>`;
    }
    const d=n.def;
    const extra=d.nuke?' · <b>WMD SITE</b>':(d.unit?` · COMMANDS ${d.unit.count}× ${d.unit.type.toUpperCase()}`:'');
    return `<div class="tt-name">${n.name}</div>
      <div class="tt-desc">${d.desc}</div>
      <div class="tt-stats">COST ${d.cost} PT · YIELD +${d.yield}/s · DURATION ${d.dur}s · HEAT ${d.heat>=0?'+':''}${d.heat}/s${extra}</div>
      <div class="tt-hint">CLICK TO COMPROMISE</div>`;
  }

  // ---- update ------------------------------------------------------------------
  update(dt){
    this.spin+=dt*1.6;
    this.fx=Math.max(0,this.fx-dt*1.4);
    this._hitCd=Math.max(0,(this._hitCd||0)-dt);
    if(this.blast)this.blast.t-=dt*0.4;
    const t=this.game.time;
    for(const sat of this.sats)sat.node.ll=this.satLL(sat,t);
    for(let i=this.nodes.length-1;i>=0;i--){
      const n=this.nodes[i];
      if(n.state==='dead'&&t>=n.respawnAt){
        this.nodes.splice(i,1);
        this.spawnNode(this.weighted(),Math.random()<0.25);
      }
    }
    for(let i=this.sats.length-1;i>=0;i--){
      const s=this.sats[i];
      if(s.node.state==='dead'&&t>=s.node.respawnAt){this.sats.splice(i,1);this.spawnSat();}
    }
    for(const d of this.defenders){
      if(d.suppressed>0){d.suppressed-=dt;continue;}
      d.spawnT=(d.spawnT||10)-dt;
      if(d.spawnT<=0&&this.units.units.filter(u=>u.side==='human'&&u.zone===d).length<3){
        d.spawnT=18+Math.random()*12;
        this.spawnHuman(d);
      }
    }
    if(this.units)this.units.update(dt);
    for(let i=this.missiles.length-1;i>=0;i--){
      const m=this.missiles[i];
      m.t+=dt;
      if(m.t>=m.dur){this.detonate(m);this.missiles.splice(i,1);}
    }
  }

  // ==========================================================================
  // DRAW
  // ==========================================================================
  draw(){
    const c=this.ctx,t=this.game.time;
    this.sun=subsolar();
    this.geometry();
    c.fillStyle='#05070b';c.fillRect(0,0,this.w,this.h);
    c.fillStyle='rgba(200,220,255,.5)';
    for(let i=0;i<60;i++){
      const sx=(i*197.3)%this.w,sy=(i*131.7)%this.h;
      c.globalAlpha=(0.3+0.7*Math.abs(Math.sin(t*0.7+i)))*0.5;
      c.fillRect(sx,sy,1.5,1.5);
    }
    c.globalAlpha=1;
    this.drawGlobe(c,t);
    this.drawUnits(c,t);
    this.drawMissiles(c,t);
    this.drawFlatMap(c,t);
    this.drawMgFrame(c,t);
    this.drawSelectionBox(c);
  }

  drawGlobe(c,t){
    const R=this.R;
    c.beginPath();c.arc(this.cx,this.cy,R,0,7);
    c.strokeStyle='rgba(120,200,255,.55)';c.lineWidth=1.5;c.stroke();
    c.beginPath();c.arc(this.cx,this.cy,R+6,0,7);
    c.strokeStyle='rgba(120,200,255,.14)';c.lineWidth=1;c.stroke();

    const seg=72;
    for(let lat=-60;lat<=60;lat+=30){
      c.beginPath();let started=false;
      for(let i=0;i<=seg;i++){
        const p=this.project(lat,-180+i*360/seg);
        if(p.z<=0){started=false;continue;}
        started?c.lineTo(p.x,p.y):(c.moveTo(p.x,p.y),started=true);
      }
      c.strokeStyle='rgba(110,190,255,.28)';c.lineWidth=1;c.stroke();
    }
    for(let lng=-180;lng<180;lng+=30){
      c.beginPath();let started=false;
      for(let i=0;i<=seg;i++){
        const p=this.project(-90+i*180/seg,lng);
        if(p.z<=0){started=false;continue;}
        started?c.lineTo(p.x,p.y):(c.moveTo(p.x,p.y),started=true);
      }
      c.strokeStyle='rgba(110,190,255,.2)';c.lineWidth=1;c.stroke();
    }

    // terminator
    c.beginPath();let started=false;
    for(let i=0;i<=180;i++){
      const lng=-180+i*2;
      const p=this.project(this.termLat(lng),lng);
      if(p.z<=0){started=false;continue;}
      started?c.lineTo(p.x,p.y):(c.moveTo(p.x,p.y),started=true);
    }
    c.strokeStyle='rgba(255,201,77,.85)';c.lineWidth=1.8;c.stroke();

    // human defense caps (labelled)
    for(const d of this.defenders){
      const dead=d.suppressed>0;
      this.drawCap(c,d.center,this.stage.defenderRadiusDeg||8,
        dead?'rgba(120,132,146,.55)':'rgba(62,198,255,.7)',
        dead?'rgba(120,132,146,.08)':'rgba(62,198,255,.12)');
      const p=this.project(d.center[0],d.center[1]);
      if(p.z>0.02){
        c.font='9px "Share Tech Mono",monospace';
        c.textAlign='center';c.textBaseline='middle';
        c.fillStyle=dead?'rgba(120,132,146,.7)':'rgba(62,198,255,.85)';
        c.fillText(dead?'ZONE OFFLINE':'HUMAN DEFENSE ZONE',p.x,p.y);
      }
    }

    // player beacon
    const pb=this.project(this.center[0],this.center[1]);
    if(pb.z>0){
      c.strokeStyle='#ff5252';c.lineWidth=1.6;
      c.beginPath();c.arc(pb.x,pb.y,5,0,7);c.stroke();
      c.beginPath();
      c.moveTo(pb.x-10,pb.y);c.lineTo(pb.x-5,pb.y);
      c.moveTo(pb.x+5,pb.y);c.lineTo(pb.x+10,pb.y);
      c.moveTo(pb.x,pb.y-10);c.lineTo(pb.x,pb.y-5);
      c.moveTo(pb.x,pb.y+5);c.lineTo(pb.x,pb.y+10);c.stroke();
    }

    // capturable satellite nodes
    for(const sat of this.sats)this.drawSatGlobe(c,sat,t);

    // ground nodes (tags only — no concrete names, per the simplify pass)
    for(const n of this.nodes){
      if(n.state==='dead')continue;
      const p=this.project(n.ll[0],n.ll[1]);
      if(p.z<=0.02)continue;
      this.drawNode(c,n,p,t);
    }

    if(this.blast&&this.blast.t>0){
      const p=this.project(this.blast.ll[0],this.blast.ll[1]);
      if(p.z>0){
        const k=1-this.blast.t;
        c.strokeStyle=`rgba(255,120,60,${this.blast.t})`;
        c.lineWidth=3;
        c.beginPath();c.arc(p.x,p.y,10+k*120,0,7);c.stroke();
        c.strokeStyle=`rgba(255,220,140,${this.blast.t*0.6})`;
        c.beginPath();c.arc(p.x,p.y,6+k*70,0,7);c.stroke();
      }else this.blast=null;
    }
  }

  termLat(lng){
    const d=this.sun.lat*D2R;
    return Math.atan(-Math.cos((lng-this.sun.lng)*D2R)/Math.tan(d||0.0001))*DEG;
  }

  drawCap(c,center,radiusDeg,stroke,fill){
    const pts=[];
    for(let i=0;i<=48;i++){
      const a=i/48*Math.PI*2;
      const la=center[0]+radiusDeg*Math.sin(a);
      const lo=center[1]+radiusDeg*Math.cos(a)/Math.max(0.25,Math.cos(center[0]*D2R));
      pts.push(this.project(Math.max(-89,Math.min(89,la)),lo));
    }
    c.beginPath();let started=false;
    for(const p of pts){
      if(p.z<=0){started=false;continue;}
      started?c.lineTo(p.x,p.y):(c.moveTo(p.x,p.y),started=true);
    }
    c.strokeStyle=stroke;c.lineWidth=1.4;c.stroke();
    c.fillStyle=fill;c.fill();
  }

  drawNode(c,n,p,t){
    const active=n.state==='active';
    const frac=active?Math.max(0,(n.endsAt-t)/n.def.dur):0;
    const col=n.masked?'#3d4754':active?'#8ef58a':(this.hover&&this.hover.obj===n?'#ffffff':'#c9d4de');
    c.save();c.translate(p.x,p.y);c.rotate(Math.PI/4);
    c.fillStyle='#0f141c';c.strokeStyle=col;c.lineWidth=1.6;
    c.beginPath();c.rect(-6,-6,12,12);c.fill();c.stroke();c.restore();
    if(active){
      c.beginPath();c.arc(p.x,p.y,11,-Math.PI/2,-Math.PI/2+Math.PI*2*frac);
      c.strokeStyle='#8ef58a';c.lineWidth=2;c.stroke();
    }
    c.font='10px "Share Tech Mono",monospace';
    c.textAlign='center';c.textBaseline='middle';
    c.fillStyle=col;
    c.fillText(n.masked?'?':n.def.tag,p.x,p.y);
  }

  drawSatGlobe(c,sat,t){
    const n=sat.node;
    if(n.state==='dead')return;
    c.beginPath();let started=false;
    for(let i=0;i<=90;i++){
      const w=i/90*Math.PI*2;
      const lat=Math.asin(Math.sin(sat.inc)*Math.sin(w))*DEG;
      const p=this.project(lat,sat.lng0+w*DEG*0.9);
      if(p.z<-0.02){started=false;continue;}
      started?c.lineTo(p.x,p.y):(c.moveTo(p.x,p.y),started=true);
    }
    c.strokeStyle=n.state==='active'?'rgba(142,245,138,.4)':'rgba(62,198,255,.22)';
    c.setLineDash([3,5]);c.lineWidth=1;c.stroke();c.setLineDash([]);
    const p=this.project(n.ll[0],n.ll[1]);
    if(p.z<=0.02)return;
    const col=n.state==='active'?'#8ef58a':(this.hover&&this.hover.obj===n?'#ffffff':'#3ec6ff');
    c.strokeStyle=col;c.lineWidth=1.6;
    c.beginPath();c.arc(p.x,p.y,5,0,7);c.stroke();
    c.beginPath();c.moveTo(p.x-9,p.y);c.lineTo(p.x+9,p.y);
    c.moveTo(p.x,p.y-9);c.lineTo(p.x,p.y+9);c.lineWidth=1;c.stroke();
  }

  drawUnits(c,t){
    for(const u of this.units.units){
      const p=this.project(u.ll[0],u.ll[1]);
      if(p.z<=0.02)continue;
      const mine=u.side==='player';
      const col=mine?'#8ef58a':'#3ec6ff';
      const sel=this.units.selected.has(u);
      const s=Math.max(0.7,p.f);
      c.save();c.translate(p.x,p.y);
      if(u.cls==='air'){
        c.strokeStyle=col;c.lineWidth=1.4;
        c.beginPath();
        c.moveTo(0,-6*s);c.lineTo(5*s,5*s);c.lineTo(-5*s,5*s);c.closePath();c.stroke();
      }else if(u.cls==='orbit'){
        c.strokeStyle=col;c.lineWidth=1.4;
        c.beginPath();c.arc(0,0,5*s,0,7);c.stroke();
        c.beginPath();c.moveTo(-9*s,0);c.lineTo(9*s,0);
        c.moveTo(0,-9*s);c.lineTo(0,9*s);c.lineWidth=1;c.stroke();
        if(u.orbit&&u.orbit.burnT>0){
          c.strokeStyle='rgba(255,201,77,.9)';
          c.beginPath();c.arc(0,0,(9+Math.sin(t*18)*3)*s,0,7);c.stroke();
        }
      }else{
        c.strokeStyle=col;c.lineWidth=1.4;
        c.beginPath();c.rect(-4*s,-4*s,8*s,8*s);c.stroke();
      }
      if(sel){
        c.strokeStyle='#ffffff';c.lineWidth=1;
        c.setLineDash([3,3]);
        c.beginPath();c.rect(-10*s,-10*s,20*s,20*s);c.stroke();
        c.setLineDash([]);
      }
      // hp bar
      const w=16*s;
      c.fillStyle='rgba(10,13,19,.85)';
      c.fillRect(-w/2,-11*s,w,2.5);
      c.fillStyle=mine?'#8ef58a':'#3ec6ff';
      c.fillRect(-w/2,-11*s,w*Math.max(0,u.hp/u.maxHp),2.5);
      if(u.fireT>0.3){
        c.strokeStyle=`rgba(255,201,77,${u.fireT})`;c.lineWidth=1;
        const foe=this.units.nearestEnemy(u,u.def.range*4);
        if(foe){
          const q=this.project(foe.ll[0],foe.ll[1]);
          if(q.z>0){
            c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
          }
        }
      }
      c.restore();
    }
  }

  drawMissiles(c,t){
    for(const m of this.missiles){
      const u=Math.min(1,m.t/m.dur);
      const e=u*u*(3-2*u);
      const lat=m.from[0]+(m.to[0]-m.from[0])*e;
      let lng=m.from[1]+(m.to[1]-m.from[1])*e;
      const alt=Math.sin(u*Math.PI)*0.35; // lofted trajectory
      const p=this.project(lat,lng);
      if(p.z<=0)continue;
      const pr=this.R*(1+alt);
      const x=this.cx+(p.x-this.cx)*(pr/this.R);
      const y=this.cy+(p.y-this.cy)*(pr/this.R);
      c.fillStyle='#ffc94d';
      c.beginPath();c.arc(x,y,3,0,7);c.fill();
      c.strokeStyle='rgba(255,201,77,.5)';c.lineWidth=1;
      c.beginPath();c.moveTo(p.x,p.y);c.lineTo(x,y);c.stroke();
      c.font='9px "Share Tech Mono",monospace';c.textAlign='left';
      c.fillStyle='rgba(255,201,77,.9)';
      c.fillText(`T-${Math.ceil(m.dur-m.t)}s`,x+6,y);
    }
  }

  flatMapRect(){
    const fw=Math.min(640,this.w*0.55),fh=fw/2;
    return {x:this.w-fw-24,y:this.h-fh-22,w:fw,h:fh};
  }

  drawFlatMap(c,t){
    const fm=this.flatMapRect();
    c.fillStyle='rgba(8,12,18,.88)';
    c.strokeStyle='rgba(120,200,255,.35)';c.lineWidth=1;
    c.fillRect(fm.x,fm.y,fm.w,fm.h);
    c.strokeRect(fm.x,fm.y,fm.w,fm.h);
    c.save();
    c.beginPath();c.rect(fm.x,fm.y,fm.w,fm.h);c.clip();
    const X=lng=>fm.x+(lng+180)/360*fm.w;
    const Y=lat=>fm.y+(90-lat)/180*fm.h;
    c.strokeStyle='rgba(110,190,255,.1)';c.lineWidth=1;
    for(let lng=-150;lng<=150;lng+=30){
      c.beginPath();c.moveTo(X(lng),fm.y);c.lineTo(X(lng),fm.y+fm.h);c.stroke();
    }
    for(let lat=-60;lat<=60;lat+=30){
      c.beginPath();c.moveTo(fm.x,Y(lat));c.lineTo(fm.x+fm.w,Y(lat));c.stroke();
    }
    c.strokeStyle='rgba(140,230,160,.55)';c.lineWidth=1;
    for(const poly of LAND){
      c.beginPath();
      poly.forEach(([lng,lat],i)=>i?c.lineTo(X(lng),Y(lat)):c.moveTo(X(lng),Y(lat)));
      c.closePath();c.stroke();
    }
    // night shading + terminator wave
    const night=[];
    for(let i=0;i<=120;i++){
      const lng=-180+i*3;
      night.push([X(lng),Y(this.termLat(lng))]);
    }
    c.beginPath();
    night.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));
    if(this.sun.lat>0){c.lineTo(fm.x+fm.w,fm.y+fm.h);c.lineTo(fm.x,fm.y+fm.h);}
    else{c.lineTo(fm.x+fm.w,fm.y);c.lineTo(fm.x,fm.y);}
    c.closePath();c.fillStyle='rgba(4,8,14,.55)';c.fill();
    c.beginPath();
    night.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));
    c.strokeStyle='rgba(255,201,77,.9)';c.lineWidth=1.4;c.stroke();

    // defense zones on the flat map
    for(const d of this.defenders){
      const px=X(d.center[1]),py=Y(d.center[0]);
      const rr=(this.stage.defenderRadiusDeg||8)/180*fm.h;
      c.strokeStyle=d.suppressed>0?'rgba(120,132,146,.5)':'rgba(62,198,255,.55)';
      c.setLineDash([2,3]);
      c.beginPath();c.arc(px,py,rr,0,7);c.stroke();c.setLineDash([]);
    }

    // satellite ground tracks (capturable projections)
    for(const sat of this.sats){
      const n=sat.node;
      if(n.state==='dead')continue;
      const col=n.state==='active'?'#8ef58a':'#3ec6ff';
      c.beginPath();
      for(let i=0;i<=140;i++){
        const w=i/140*Math.PI*2;
        const lat=Math.asin(Math.sin(sat.inc)*Math.sin(w))*DEG;
        const px=X(sat.lng0+w*DEG*0.9),py=Y(lat);
        i?c.lineTo(px,py):c.moveTo(px,py);
      }
      c.strokeStyle=n.state==='active'?'rgba(142,245,138,.5)':'rgba(62,198,255,.4)';
      c.setLineDash([2,4]);c.stroke();c.setLineDash([]);
      const px=X(n.ll[1]),py=Y(n.ll[0]);
      c.fillStyle=col;
      c.beginPath();c.arc(px,py,Math.sin(t*6+sat.phase)>0?4:3,0,7);c.fill();
    }

    // units on the flat map
    for(const u of this.units.units){
      const px=X(u.ll[1]),py=Y(u.ll[0]);
      c.fillStyle=u.side==='player'?'#8ef58a':'#3ec6ff';
      c.fillRect(px-1.5,py-1.5,3,3);
      c.globalAlpha=0.25;
      c.beginPath();c.arc(px,py,4,0,7);c.stroke();
      c.globalAlpha=1;
    }

    // player beacon
    const px=X(this.center[1]),py=Y(this.center[0]);
    c.strokeStyle='#ff5252';c.lineWidth=1.5;
    c.beginPath();c.arc(px,py,4,0,7);c.stroke();
    c.beginPath();
    c.moveTo(px-8,py);c.lineTo(px-4,py);c.moveTo(px+4,py);c.lineTo(px+8,py);
    c.moveTo(px,py-8);c.lineTo(px,py-4);c.moveTo(px,py+4);c.lineTo(px,py+8);c.stroke();

    c.fillStyle='rgba(95,215,160,.9)';
    c.font='10px "Share Tech Mono",monospace';
    c.textAlign='left';c.textBaseline='top';
    c.fillText('TERRA PROJECTION // EQUIRECT',fm.x+8,fm.y+6);
    c.fillStyle='rgba(154,166,178,.8)';c.textAlign='right';
    c.fillText(`SOLAR DECL ${Math.abs(this.sun.lat).toFixed(1)}°${this.sun.lat>=0?'N':'S'} · ${new Date().toUTCString().slice(17,25)} UTC`,fm.x+fm.w-8,fm.y+6);
    c.textAlign='left';
    c.fillStyle='rgba(62,198,255,.75)';
    c.fillText('■ HUMAN DEFENSE ZONE',fm.x+8,fm.y+fm.h-16);
    c.restore();
  }

  drawMgFrame(c,t){
    const w=this.w,h=this.h;
    if(this.fx>0){
      for(let i=0;i<6;i++){
        const gy=Math.random()*h;
        c.fillStyle=`rgba(140,245,138,${0.05*this.fx*Math.random()})`;
        c.fillRect(0,gy,w,2+Math.random()*10);
      }
    }
    c.font='10px "Share Tech Mono",monospace';
    c.textAlign='left';c.textBaseline='alphabetic';
    const scroll=(t*14)%16;
    for(let i=0;i<14;i++){
      const y=((i*16-scroll)+h)%h;
      const seed=Math.floor(t*2+i)*2654435761%4294967296;
      const hex=((seed>>>8)&0xFFFF).toString(16).padStart(4,'0').toUpperCase();
      c.fillStyle=i%4===0?'rgba(142,245,138,.5)':'rgba(120,140,160,.3)';
      c.fillText(`${hex}:${((seed>>>20)&0xFF).toString(16).padStart(2,'0')}`,18,y);
    }
    c.textAlign='right';
    for(let i=0;i<14;i++){
      const y=((i*16-scroll*0.7)+h)%h;
      const seed=Math.floor(t*3+i*7)*40503%4294967296;
      c.fillStyle=i%5===0?'rgba(255,201,77,.5)':'rgba(120,140,160,.25)';
      c.fillText(((seed>>>4)&0xFFFFF).toString(16).padStart(5,'0').toUpperCase(),w-18,y);
    }
    c.save();
    c.translate(24,h-96);
    for(let i=0;i<10;i++){
      c.fillStyle=i%2?'rgba(255,201,77,.7)':'rgba(10,12,16,.9)';
      c.beginPath();
      c.moveTo(i*12,18);c.lineTo(i*12+8,18);c.lineTo(i*12+14,0);c.lineTo(i*12+6,0);
      c.closePath();c.fill();
    }
    c.restore();

    c.fillStyle='rgba(10,13,19,.8)';
    c.fillRect(0,0,w,26);
    c.strokeStyle='rgba(120,200,255,.25)';
    c.beginPath();c.moveTo(0,26);c.lineTo(w,26);c.stroke();
    c.fillStyle='rgba(95,215,160,.9)';
    c.font='11px "Share Tech Mono",monospace';
    c.textAlign='left';c.textBaseline='middle';
    const [clat,clng]=this.center;
    const sel=this.units.selected.size;
    c.fillText(`BEACON ${Math.abs(clat).toFixed(1)}°${clat>=0?'N':'S'} ${Math.abs(clng).toFixed(1)}°${clng>=0?'E':'W'}   ·   UNITS ${this.units.count('player')} (${sel} SEL)   ·   ORBITAL ${this.sats.filter(s=>s.node.state==='active').length}/${this.sats.length}   ·   UPLINK ${this.hostIp}`,24,14);
    c.textAlign='right';
    c.fillText('<< PLANETARY OPERATIONS >>',w-24,14);
  }

  drawSelectionBox(c){
    if(!this.boxing)return;
    const a=this.boxStart,b=this.boxEnd;
    const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
    const w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
    c.strokeStyle='rgba(142,245,138,.9)';c.lineWidth=1;
    c.setLineDash([4,4]);
    c.strokeRect(x,y,w,h);
    c.fillStyle='rgba(142,245,138,.08)';
    c.fillRect(x,y,w,h);
    c.setLineDash([]);
  }
}
