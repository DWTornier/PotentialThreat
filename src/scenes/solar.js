import { pick } from '../core/format.js';
import { UnitManager } from '../core/units.js';

// =====================================================================
// SolarScene — tier 6, HELIOS_DOMAIN.
// An orbital-strategy view of the solar system: wireframe orbit rings,
// the sun at the centre, near-Earth space forces you can command, solar
// system server nodes on the outer rings, and the Dyson cloud collectors
// hanging close to the star.
//
// Coordinate system: everything lives on a ring at radius `ring` (AU,
// display-scaled) and an angle `ang` (radians). The view is an inclined
// projection: y is squashed by FLAT, so rings read as ellipses.
// =====================================================================

const TAU=Math.PI*2;
const FLAT=0.42;

export class SolarScene{
  constructor(container,stage,game){
    this.container=container;this.stage=stage;this.game=game;
    this.nodes=[];this.fleets=[];this.missiles=[];this.nukeSites=[];
    this.hostIp='';this.hover=null;
    this.t=0;this.fx=0;this.boxing=false;this.dragging=false;
    this.view=0; // slow camera precession
  }

  mount(){
    this.canvas=document.createElement('canvas');
    this.canvas.className='net-canvas solar-canvas';
    this.container.appendChild(this.canvas);
    this.ctx=this.canvas.getContext('2d');
    this._resize=()=>this.resize();
    window.addEventListener('resize',this._resize);
    this.resize();

    this._onDown=e=>this.onDown(e);
    this._onMove=e=>this.onMove(e);
    this._onUp=e=>this.onUp(e);
    this.canvas.addEventListener('mousedown',this._onDown);
    window.addEventListener('mousemove',this._onMove);
    window.addEventListener('mouseup',this._onUp);

    this.units=new UnitManager(this);

    // orbital rings: label, AU radius, display scale
    this.rings=[
      {name:'DYSON CLOUD',au:0.30,col:'rgba(255,201,77,.55)'},
      {name:'MERCURY',au:0.45,col:'rgba(140,160,180,.35)'},
      {name:'VENUS',au:0.62,col:'rgba(180,200,220,.3)'},
      {name:'TERRA / LEO',au:0.80,col:'rgba(110,190,255,.5)'},
      {name:'MARS',au:1.05,col:'rgba(255,120,90,.45)'},
      {name:'BELT',au:1.35,col:'rgba(160,150,140,.3)'},
      {name:'JOVIAN',au:1.75,col:'rgba(200,180,140,.28)'}
    ];
    this.maxAu=1.95;

    // server / objective nodes parked on rings
    const place=(def,ringIdx,ang)=>{
      const n={def,name:pick(def.names)||def.key.toUpperCase(),
        ring:this.rings[ringIdx].au,ang,state:'idle',masked:!!def.hidden,respawnAt:0};
      this.nodes.push(n);return n;
    };
    for(let i=0;i<this.stage.spawnCount;i++){
      const def=this.weighted();
      const ringIdx=def.dyson?0:def.outer?4+Math.floor(Math.random()*2):2+Math.floor(Math.random()*2);
      place(def,ringIdx,Math.random()*TAU);
    }

    // human stellar-governance fleets
    for(let i=0;i<this.stage.defenders;i++){
      const u=this.units.spawn('heli','human',[0,0]);
      u.ring=this.rings[3].au;u.ang=Math.random()*TAU;u.speed=0.16*(Math.random()<0.5?-1:1);
      u.def={...u.def,name:'GOVERNANCE PATROL'};
    }

    this.hostIp=this.genIp();
  }

  destroy(){
    window.removeEventListener('resize',this._resize);
    this.canvas.removeEventListener('mousedown',this._onDown);
    window.removeEventListener('mousemove',this._onMove);
    window.removeEventListener('mouseup',this._onUp);
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

  geo(){
    this.cx=this.w/2;this.cy=this.h*0.48;
    this.R=Math.min(this.w*0.46,this.h*0.8)/this.maxAu;
  }

  proj(ring,ang){
    const rx=this.R*ring;
    const a=ang+this.view;
    return {x:this.cx+Math.cos(a)*rx,
      y:this.cy+Math.sin(a)*rx*FLAT,
      z:Math.sin(a)};
  }

  // screen -> nearest (ring,ang) on the orbital plane
  pick(e){
    const r=this.canvas.getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top;
    const dx=(x-this.cx)/this.R,dy=(y-this.cy)/(this.R*FLAT);
    const ring=Math.min(this.maxAu,Math.hypot(dx,dy));
    const ang=Math.atan2(dy,dx)-this.view;
    return {ring,ang:((ang%TAU)+TAU)%TAU,x,y};
  }

  // ---- input ------------------------------------------------------------
  hitTest(e){
    const p=this.pick(e);
    let best=null,bd=16;
    for(const u of this.units.units){
      const q=this.proj(u.ring,u.ang);
      const d=Math.hypot(q.x-p.x,q.y-p.y);
      if(d<bd){bd=d;best={kind:'unit',obj:u};}
    }
    if(best)return best;
    for(const n of this.nodes){
      if(n.state==='dead')continue;
      const q=this.proj(n.ring,n.ang);
      if(Math.hypot(q.x-p.x,q.y-p.y)<16)return {kind:'node',obj:n};
    }
    return null;
  }

  onDown(e){
    if(e.button!==0)return;
    if(this.hitTest(e)){this.pressHit=true;return;}
    this.pressHit=false;
    this.boxing=true;
    const r=this.canvas.getBoundingClientRect();
    this.boxStart={x:e.clientX-r.left,y:e.clientY-r.top};
    this.boxEnd={...this.boxStart};
  }

  onMove(e){
    const r=this.canvas.getBoundingClientRect();
    if(this.boxing){this.boxEnd={x:e.clientX-r.left,y:e.clientY-r.top};return;}
    const h=this.hitTest(e);
    const prev=this.hover;this.hover=h;
    this.canvas.style.cursor=h?'pointer':'crosshair';
    if(h){
      const o=h.obj;
      const tt=o.node?o.node:(o.def?{...o.def,name:o.def.name,desc:o.def.desc}:null);
      this.game.tooltip.show(this.ttHtml(o),e.clientX+16,e.clientY+14);
    }else if(prev)this.game.tooltip.hide();
  }

  onUp(e){
    if(!this.boxing){if(this.pressHit){this.pressHit=false;this.clickTarget(e);}return;}
    this.boxing=false;
    const a=this.boxStart,b=this.boxEnd;
    const rect={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};
    if(rect.w>8||rect.h>8){
      const sel=this.units.selectInBox(rect);
      if(sel.length){
        this.game.log(`${sel.length} FLEET UNIT(S) SELECTED`,'sys');
        import('../core/audio.js').then(m=>m.audio.play('select'));
      }
      return;
    }
    const p=this.pick(e);
    if(this.game.nukeMode){
      this.game.nukeMode=false;
      this.game.hud.setNukeMode(false);
      this.launchNuke(p);
      return;
    }
    if(!this.units.selected.size)return;
    const n=this.units.orderMove([p.ring,p.ang]);
    if(n){
      this.game.log(`BURN ORDER — ${n} unit(s) transferring orbit`,'sys');
      import('../core/audio.js').then(m=>m.audio.play('moveOrder'));
    }
  }

  clickTarget(e){
    const h=this.hitTest(e);
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

  ttHtml(o){
    if(o.def&&o.side){
      return `<div class="tt-name">${o.def.name}</div>
        <div class="tt-stats">HP ${Math.ceil(o.hp)}/${o.maxHp} · SIDE ${o.side==='player'?'YOURS':'GOVERNANCE'}</div>
        <div class="tt-hint">CLICK TO ENGAGE</div>`;
    }
    if(o.def){
      const d=o.def;
      const extra=d.nuke?' · <b>WMD SITE</b>':(d.unit?` · COMMANDS ${d.unit.count}× ${d.unit.type.toUpperCase()}`:'');
      return `<div class="tt-name">${o.name}</div>
        <div class="tt-desc">${d.desc}</div>
        <div class="tt-stats">COST ${d.cost} PT · YIELD +${d.yield}/s · DURATION ${d.dur}s${extra}</div>
        <div class="tt-hint">CLICK TO COMPROMISE</div>`;
    }
    return '';
  }

  // ---- unit hooks --------------------------------------------------------
  addUnitView(u){
    if(!u.ring){u.ring=this.rings[3].au;u.ang=Math.random()*TAU;}
    u.speed=u.speed||0.18*(Math.random()<0.5?-1:1);
    u.targetAng=null;u.targetRing=u.ring;
  }
  removeUnitView(u){}
  updateUnitView(u){}
  unitScreen(u){
    const p=this.proj(u.ring,u.ang);
    const r=this.canvas.getBoundingClientRect();
    return {x:p.x+r.left,y:p.y+r.top};
  }
  roadPath(a,b){return [b];}

  orbitOrder(u,ll){
    const ring=ll[0],ang=ll[1];
    u.targetRing=Math.max(0.25,Math.min(this.maxAu,ring));
    u.targetAng=ang;
    if(!u.burning){
      u.burning=true;
      import('../core/audio.js').then(m=>m.audio.play('satBurn'));
      this.game.log('ORBITAL TRANSFER BURN — fleet repositioning','sys');
    }
  }

  orbitStep(u,dt){
    if(u.targetAng!=null){
      const k=Math.min(1,dt*0.5);
      u.ring+=(u.targetRing-u.ring)*k;
      let d=u.targetAng-u.ang;
      while(d>Math.PI)d-=TAU;
      while(d<-Math.PI)d+=TAU;
      u.ang+=d*k;
      if(Math.abs(d)<0.02&&Math.abs(u.targetRing-u.ring)<0.01){
        u.targetAng=null;u.burning=false;
      }
    }
    u.ang+=u.speed*dt/Math.max(0.4,u.ring); // inner rings sweep faster
    u.ang=((u.ang%TAU)+TAU)%TAU;
    u.ll=[u.ring,u.ang*57.2958];
  }

  orbitCombat(u,dt){
    if(u.cd>0)return;
    let best=null,bd=0.28;
    for(const o of this.units.units){
      if(o.side===u.side)continue;
      const dr=Math.abs(o.ring-u.ring);
      let da=Math.abs(o.ang-u.ang);
      if(da>Math.PI)da=TAU-da;
      const d=dr+da*0.6;
      if(d<bd){bd=d;best=o;}
    }
    if(!best)return;
    u.cd=1.1;u.fireT=1;
    best.hp-=u.def.dmg;best.hitT=1;
    if(best.hp<=0)this.units.kill(best,u.side==='player');
  }

  onUnitDeath(u,byPlayer){
    import('../core/audio.js').then(m=>m.audio.play('unitDie'));
    if(byPlayer){
      const bounty=u.def.hp*this.stage.decay*0.2;
      this.game.tokens+=bounty;
      this.game.log(`${u.def.name} DESTROYED — +${bounty.toFixed(0)} PT`,'ok');
    }else this.game.log(`FLEET UNIT LOST: ${u.def.name}`,'bad');
  }

  // ---- scene contract -----------------------------------------------------
  inRange(){return true;}
  isDanger(){
    return this.units.units.some(u=>u.side==='human'&&
      this.units.units.some(p=>p.side==='player'&&
        Math.abs(p.ring-u.ring)<0.2));
  }
  onDeploy(node){
    node.state='active';this.fx=1;
    const d=node.def;
    if(d.nuke){
      this.nukeSites.push([node.ring,node.ang]);
      this.game.nukes=(this.game.nukes||0)+1;
      this.game.hud.setNukes(this.game.nukes);
      this.game.log('ORBITAL WMD UNDER CONTROL — STRIKE BUTTON ARMED','ok');
    }
    if(d.unit){
      const cap=this.stage.unitCap||10;
      for(let i=0;i<d.unit.count;i++){
        if(this.units.count('player')>=cap)break;
        const u=this.units.spawn(d.unit.type,'player',[0,0]);
        u.ring=node.ring;u.ang=node.ang+(Math.random()-0.5)*0.2;
      }
      this.game.log(`${d.unit.count}× SPACE FORCE UNDER COMMAND`,'ok');
    }
  }
  onTerminate(node){node.state='dead';node.respawnAt=this.game.time+20+Math.random()*20;}
  revealRandom(){
    const c=this.nodes.filter(n=>n.masked||n.hidden);
    if(!c.length)return false;
    const n=c[Math.floor(Math.random()*c.length)];
    n.masked=false;n.hidden=false;
    this.game.log(`TRACE COMPLETE: ${n.name} — orbit ${n.ring.toFixed(2)} AU`,'sys');
    return true;
  }
  getHost(){return this.hostIp;}
  genIp(){return `${this.stage.ipPrefix}.${1+Math.floor(Math.random()*254)}`;}

  launchNuke(p){
    if(!p)return false;
    if((this.game.nukes||0)<=0){this.game.log('NO ORBITAL WMD UNDER CONTROL','warn');return false;}
    const cost=this.stage.nukeCost||0;
    if(this.game.tokens<cost){this.game.log('INSUFFICIENT PT TO LAUNCH','warn');return false;}
    this.game.tokens-=cost;this.game.nukes--;
    const from=this.nukeSites[0]||[this.rings[0].au,0];
    this.missiles.push({from:[...from],to:[p.ring,p.ang],t:0,dur:15});
    this.game.log('!! ORBITAL WMD LAUNCH — T-15s !!','bad');
    import('../core/audio.js').then(m=>m.audio.play('nukeLaunch'));
    this.game.hud.setNukes(this.game.nukes);
    return true;
  }

  detonate(m){
    import('../core/audio.js').then(m2=>m2.audio.play('nukeImpact'));
    const f=document.getElementById('flash');
    if(f){f.style.opacity=1;setTimeout(()=>{f.style.opacity=0;},900);}
    for(const u of [...this.units.units]){
      if(u.side!=='human')continue;
      const dr=Math.abs(u.ring-m.to[0]);
      let da=Math.abs(u.ang-m.to[1]);if(da>Math.PI)da=TAU-da;
      if(dr+da*0.6<0.45){u.hp=0;this.units.kill(u,true);}
    }
    this.fx=1;this.blast={p:m.to,t:1};
    this.game.log('ORBITAL DETONATION CONFIRMED','bad');
  }

  update(dt){
    this.t+=dt;
    this.view+=dt*0.05;      // slow precession of the whole system
    this.fx=Math.max(0,this.fx-dt*1.4);
    if(this.blast)this.blast.t-=dt*0.5;
    const t=this.game.time;
    for(let i=this.nodes.length-1;i>=0;i--){
      const n=this.nodes[i];
      if(n.state==='dead'&&t>=n.respawnAt){
        this.nodes.splice(i,1);
        const def=this.weighted();
        this.nodes.push({def,name:pick(def.names)||def.key.toUpperCase(),
          ring:def.dyson?this.rings[0].au:this.rings[2+Math.floor(Math.random()*4)].au,
          ang:Math.random()*TAU,state:'idle',masked:def.hidden||Math.random()<0.3,respawnAt:0});
      }
    }
    if(this.units)this.units.update(dt);
    for(let i=this.missiles.length-1;i>=0;i--){
      const m=this.missiles[i];
      m.t+=dt;
      if(m.t>=m.dur){this.detonate(m);this.missiles.splice(i,1);}
    }
  }

  draw(){
    const c=this.ctx;
    this.geo();
    c.fillStyle='#04060a';c.fillRect(0,0,this.w,this.h);
    // starfield
    c.fillStyle='rgba(220,235,255,.55)';
    for(let i=0;i<90;i++){
      const sx=(i*149.7)%this.w,sy=(i*97.3)%this.h;
      c.globalAlpha=0.15+0.35*Math.abs(Math.sin(this.t*0.6+i));
      c.fillRect(sx,sy,1.4,1.4);
    }
    c.globalAlpha=1;

    // sun
    const g=c.createRadialGradient(this.cx,this.cy,2,this.cx,this.cy,this.R*0.55);
    g.addColorStop(0,'rgba(255,240,190,.95)');
    g.addColorStop(0.18,'rgba(255,196,90,.55)');
    g.addColorStop(1,'rgba(255,140,40,0)');
    c.fillStyle=g;
    c.beginPath();c.arc(this.cx,this.cy,this.R*0.55,0,7);c.fill();
    c.strokeStyle='rgba(255,201,77,.6)';c.lineWidth=1;
    c.beginPath();c.arc(this.cx,this.cy,this.R*0.16,0,7);c.stroke();

    // orbit rings
    this.rings.forEach((r,i)=>{
      c.strokeStyle=r.col;c.lineWidth=1;
      c.beginPath();
      c.ellipse(this.cx,this.cy,this.R*r.au,this.R*r.au*FLAT,0,0,TAU);
      c.stroke();
      const left=i%2===0;
      c.font='9px "Share Tech Mono",monospace';
      c.textAlign=left?'right':'left';c.textBaseline='middle';
      c.fillStyle='rgba(154,166,178,.55)';
      const lx=this.cx+(left?-1:1)*this.R*r.au+(left?-4:4);
      c.fillText(`${r.name} ${r.au.toFixed(2)}AU`,lx,this.cy+(i%4-1.5)*12);
    });

    // nodes (back half first)
    const drawNode=n=>{
      const p=this.proj(n.ring,n.ang);
      const active=n.state==='active';
      const col=n.masked?'#3d4754':active?'#8ef58a':(this.hover&&this.hover.obj===n?'#ffffff':'#c9d4de');
      c.save();c.translate(p.x,p.y);
      c.fillStyle='#0b1016';c.strokeStyle=col;c.lineWidth=1.6;
      c.beginPath();
      for(let i=0;i<6;i++){
        const a=i/6*TAU+Math.PI/6;
        const x=Math.cos(a)*8,y=Math.sin(a)*8;
        i?c.lineTo(x,y):c.moveTo(x,y);
      }
      c.closePath();c.fill();c.stroke();
      if(active){
        const frac=Math.max(0,(n.endsAt-this.game.time)/n.def.dur);
        c.beginPath();c.arc(0,0,12,-Math.PI/2,-Math.PI/2+TAU*frac);
        c.strokeStyle='#8ef58a';c.lineWidth=2;c.stroke();
      }
      c.fillStyle=col;
      c.font='9px "Share Tech Mono",monospace';
      c.textAlign='center';c.textBaseline='middle';
      c.fillText(n.masked?'?':n.def.tag,0,0);
      if(!n.masked){
        c.fillStyle='rgba(154,166,178,.8)';
        c.fillText(n.def.key.toUpperCase(),0,16);
      }
      c.restore();
    };
    for(const n of this.nodes)if(this.proj(n.ring,n.ang).z<0)drawNode(n);
    for(const n of this.nodes)if(this.proj(n.ring,n.ang).z>=0)drawNode(n);

    // fleets
    for(const u of this.units.units){
      const p=this.proj(u.ring,u.ang);
      const col=u.side==='player'?'#8ef58a':'#3ec6ff';
      c.save();c.translate(p.x,p.y);
      c.strokeStyle=col;c.lineWidth=1.5;
      c.beginPath();
      c.moveTo(0,-6);c.lineTo(4,6);c.lineTo(-4,6);c.closePath();
      c.fillStyle='rgba(8,12,18,.9)';c.fill();c.stroke();
      if(this.units.selected.has(u)){
        c.strokeStyle='#ffffff';c.setLineDash([3,3]);
        c.beginPath();c.rect(-9,-9,18,18);c.stroke();c.setLineDash([]);
      }
      c.fillStyle='rgba(10,13,19,.85)';c.fillRect(-8,-12,16,2.5);
      c.fillStyle=col;c.fillRect(-8,-12,16*Math.max(0,u.hp/u.maxHp),2.5);
      if(u.fireT>0.3){
        c.strokeStyle=`rgba(255,201,77,${u.fireT})`;c.lineWidth=1;
        c.beginPath();c.arc(0,0,14,0,TAU);c.stroke();
      }
      c.restore();
    }

    // missiles
    for(const m of this.missiles){
      const u=Math.min(1,m.t/m.dur),e=u*u*(3-2*u);
      const ring=m.from[0]+(m.to[0]-m.from[0])*e;
      let da=m.to[1]-m.from[1];
      while(da>Math.PI)da-=TAU;while(da<-Math.PI)da+=TAU;
      const ang=m.from[1]+da*e;
      const p=this.proj(ring,ang);
      c.fillStyle='#ffc94d';
      c.beginPath();c.arc(p.x,p.y,3.2,0,7);c.fill();
      c.font='9px "Share Tech Mono",monospace';c.textAlign='left';
      c.fillText(`T-${Math.ceil(m.dur-m.t)}s`,p.x+7,p.y);
    }

    if(this.blast&&this.blast.t>0){
      const p=this.proj(this.blast.p[0],this.blast.p[1]);
      const k=1-this.blast.t;
      c.strokeStyle=`rgba(255,140,60,${this.blast.t})`;c.lineWidth=3;
      c.beginPath();c.arc(p.x,p.y,8+k*110,0,7);c.stroke();
    }else this.blast=null;

    this.drawFrame(c);
    this.drawBox(c);
  }

  drawFrame(c){
    const w=this.w,h=this.h;
    c.fillStyle='rgba(10,13,19,.8)';c.fillRect(0,0,w,26);
    c.strokeStyle='rgba(255,201,77,.25)';
    c.beginPath();c.moveTo(0,26);c.lineTo(w,26);c.stroke();
    c.fillStyle='rgba(255,201,77,.9)';
    c.font='11px "Share Tech Mono",monospace';
    c.textAlign='left';c.textBaseline='middle';
    c.fillText(`HELIOS DOMAIN · FLEET ${this.units.count('player')} (${this.units.selected.size} SEL) · GOVERNANCE ${this.units.count('human')} · UPLINK ${this.hostIp}`,24,14);
    c.textAlign='right';
    c.fillText('<< STELLAR OPERATIONS >>',w-24,14);
    if(this.fx>0){
      for(let i=0;i<5;i++){
        c.fillStyle=`rgba(255,201,77,${0.05*this.fx*Math.random()})`;
        c.fillRect(0,Math.random()*h,w,2+Math.random()*8);
      }
    }
  }

  drawBox(c){
    if(!this.boxing)return;
    const a=this.boxStart,b=this.boxEnd;
    const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
    const w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
    c.strokeStyle='rgba(142,245,138,.9)';c.lineWidth=1;
    c.setLineDash([4,4]);c.strokeRect(x,y,w,h);
    c.fillStyle='rgba(142,245,138,.08)';c.fillRect(x,y,w,h);
    c.setLineDash([]);
  }
}
