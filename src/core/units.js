// =====================================================================
// UnitManager — the RTS layer shared by the map scenes (city/metro) and
// the globe scene. Handles: movement with easing, road-grid routing for
// ground units, straight flight for air units, orbital transfer for
// satellites, patrol behaviours, auto/targeted combat, HP and selection.
// Rendering is delegated to the host scene via view hooks, so the same
// simulation runs on Leaflet markers and on the wireframe globe.
// =====================================================================

export const R=6371000; // earth radius
const D2R=Math.PI/180;

export function distM(a,b){
  const dLat=(b[0]-a[0])*D2R,dLng=(b[1]-a[1])*D2R;
  const h=Math.sin(dLat/2)**2+Math.cos(a[0]*D2R)*Math.cos(b[0]*D2R)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}

// class: ground = follows the street grid; air = straight line;
// orbit  = moves by changing its orbital elements (ram attacks)
export const TYPES={
  patrol:{cls:'ground',hp:70,dmg:7,range:130,speed:24,acc:26,turn:2.6,tag:'PTRL',
    name:'PATROL UNIT',stopsWhenHit:true},
  army:{cls:'ground',hp:180,dmg:20,range:170,speed:15,acc:14,turn:1.8,tag:'ARMY',
    name:'GROUND COLUMN',stopsWhenHit:true},
  heli:{cls:'air',hp:110,dmg:16,range:220,speed:42,acc:22,turn:2.2,tag:'HELI',
    name:'POLICE HELICOPTER',stopsWhenHit:false},
  drone:{cls:'air',hp:60,dmg:11,range:180,speed:34,acc:30,turn:3.2,tag:'UAV',
    name:'SWARM DRONE',stopsWhenHit:false},
  sat:{cls:'orbit',hp:150,dmg:70,range:400,speed:0,acc:0,turn:0,tag:'ORB',
    name:'CAPTURED SATELLITE',stopsWhenHit:false}
};

export class UnitManager{
  constructor(scene){
    this.scene=scene;
    this.game=scene.game;
    this.units=[];
    this.id=1;
    this.grid=scene.stage.gridM||150; // street grid spacing in meters
    this.selected=new Set();
  }

  spawn(type,side,ll,extra={}){
    const t=TYPES[type]||TYPES.patrol;
    const u=Object.assign({
      id:this.id++,type,def:t,cls:t.cls,side,
      ll:[ll[0],ll[1]],
      hp:t.hp,maxHp:t.hp,
      dir:[Math.random()-0.5,Math.random()-0.5], // unit-ish heading vector (x=east,y=north)
      speed:0,
      path:[],order:null,state:'patrol',
      cd:0,hitT:0,patrolT:Math.random()*3,
      fireT:0
    },extra);
    const n=Math.hypot(u.dir[0],u.dir[1])||1;
    u.dir=[u.dir[0]/n,u.dir[1]/n];
    this.units.push(u);
    if(this.scene.addUnitView)this.scene.addUnitView(u);
    return u;
  }

  kill(u,byPlayer){
    u.dead=true;
    this.units=this.units.filter(x=>x!==u);
    this.selected.delete(u);
    if(this.scene.removeUnitView)this.scene.removeUnitView(u);
    if(this.scene.onUnitDeath)this.scene.onUnitDeath(u,byPlayer);
  }

  // ---- selection --------------------------------------------------------
  selectInBox(rect){
    const out=[];
    for(const u of this.units){
      if(u.side!=='player')continue;
      const p=this.scene.unitScreen(u);
      if(!p)continue;
      if(p.x>=rect.x&&p.x<=rect.x+rect.w&&p.y>=rect.y&&p.y<=rect.y+rect.h)out.push(u);
    }
    this.selected=new Set(out);
    return out;
  }

  selection(){return [...this.selected];}

  // ---- orders ------------------------------------------------------------
  orderMove(ll){
    const sel=this.selection();
    if(!sel.length)return 0;
    for(const u of sel){
      u.order={kind:'move',ll:[ll[0],ll[1]]};
      if(u.cls==='ground'){
        u.path=this.scene.roadPath?this.scene.roadPath(u.ll,ll):[[ll[0],ll[1]]];
      }else if(u.cls==='air'){
        u.path=[[ll[0],ll[1]]];
      }else if(u.cls==='orbit'){
        if(this.scene.orbitOrder)this.scene.orbitOrder(u,ll);
      }
      u.state='moving';
    }
    return sel.length;
  }

  orderAttack(target){
    const sel=this.selection();
    if(!sel.length)return 0;
    for(const u of sel){
      u.order={kind:'attack',target};
      if(target&&target.ll){
        if(u.cls==='ground'&&this.scene.roadPath)u.path=this.scene.roadPath(u.ll,target.ll);
        else if(u.cls==='air')u.path=[[target.ll[0],target.ll[1]]];
        else if(u.cls==='orbit'&&this.scene.orbitOrder)this.scene.orbitOrder(u,target.ll);
      }
      u.state='engaging';
    }
    return sel.length;
  }

  // ---- routing ------------------------------------------------------------
  // right-angle route along the street grid (Manhattan), in meters
  roadPath(from,to){
    const g=this.grid;
    const c=this.scene.stage.center;
    const mx=(p)=>[(p[1]-c[1])*111320*Math.cos(c[0]*D2R),(p[0]-c[0])*111320];
    const inv=(x,y)=>[c[0]+y/111320,c[1]+x/(111320*Math.cos(c[0]*D2R))];
    const A=mx(from),B=mx(to);
    const snap=v=>Math.round(v/g)*g;
    const pts=[];
    const y0=snap(A[1]);
    pts.push(inv(A[0],y0));               // get onto the nearest E-W street
    if(Math.abs(snap(B[0])-A[0])>g*0.5){
      const x1=snap(B[0]);
      pts.push(inv(x1,y0));               // run along it
      pts.push(inv(x1,B[1]));             // turn onto the N-S street
    }else{
      pts.push(inv(A[0],B[1]));
    }
    pts.push([to[0],to[1]]);
    return pts;
  }

  // ---- simulation ----------------------------------------------------------
  update(dt){
    for(const u of this.units){
      if(u.dead)continue;
      u.cd-=dt;u.hitT=Math.max(0,u.hitT-dt*2);u.fireT=Math.max(0,u.fireT-dt*2);
      if(u.cls==='orbit'){
        if(this.scene.orbitStep)this.scene.orbitStep(u,dt);
      }else{
        this.stepMove(u,dt);
      }
      this.stepCombat(u,dt);
      if(this.scene.updateUnitView)this.scene.updateUnitView(u,dt);
    }
  }

  stepMove(u,dt){
    // patrol: human units wander; player units idle in place
    if(!u.path.length){
      if(u.state==='moving'||u.state==='engaging')u.state='patrol';
      if(u.side==='human'&&u.def.cls!=='orbit'){
        u.patrolT-=dt;
        if(u.patrolT<=0){
          u.patrolT=3+Math.random()*4;
          const c=this.scene.stage.center;
          const sp=(this.scene.stage.defenderRadiusM||this.scene.stage.defenderRadiusDeg*111320||600)*0.7;
          const a=Math.random()*Math.PI*2,r=Math.random()*sp;
          const tgt=[c[0]+r*Math.sin(a)/111320,c[1]+r*Math.cos(a)/(111320*Math.cos(c[0]*D2R))];
          u.path=u.cls==='ground'&&this.scene.roadPath?this.scene.roadPath(u.ll,tgt):[tgt];
        }
      }
      // ease to a stop
      u.speed=Math.max(0,u.speed-u.def.acc*dt);
      return;
    }
    // if hit and this class halts under fire, pause briefly
    if(u.haltT>0){u.haltT-=dt;u.speed=Math.max(0,u.speed-u.def.acc*1.6*dt);return;}

    const wp=u.path[0];
    const d=distM(u.ll,wp);
    if(d<25){
      u.path.shift();
      if(!u.path.length)u.speed*=0.4;
      return;
    }
    // desired direction (east,north) normalized
    const dLat=(wp[0]-u.ll[0]),dLng=(wp[1]-u.ll[1]);
    let vx=dLng*Math.cos(u.ll[0]*D2R),vy=dLat;
    const n=Math.hypot(vx,vy)||1;
    vx/=n;vy/=n;
    // smooth turning (no snapping) + smooth accel
    const turn=Math.min(1,u.def.turn*dt);
    u.dir=[u.dir[0]+(vx-u.dir[0])*turn,u.dir[1]+(vy-u.dir[1])*turn];
    const dn=Math.hypot(u.dir[0],u.dir[1])||1;
    u.dir=[u.dir[0]/dn,u.dir[1]/dn];
    const target=Math.min(u.def.speed,u.def.speed*(d/140)+6); // ease near arrival
    u.speed+=(target-u.speed)*Math.min(1,dt*(u.def.acc/12));
    const step=u.speed*dt; // meters
    u.ll=[
      u.ll[0]+u.dir[1]*step/111320,
      u.ll[1]+u.dir[0]*step/(111320*Math.max(0.2,Math.cos(u.ll[0]*D2R)))
    ];
  }

  stepCombat(u,dt){
    if(u.cls==='orbit'){
      if(this.scene.orbitCombat)this.scene.orbitCombat(u,dt);
      return;
    }
    const foe=this.nearestEnemy(u,u.def.range);
    if(!foe)return;
    if(u.order&&u.order.kind==='move'&&u.side==='player')return; // hold fire while repositioning
    if(u.cd<=0){
      u.cd=u.cls==='air'?0.9:1.3;
      u.fireT=1;
      foe.hp-=u.def.dmg;
      foe.hitT=1;
      if(foe.def.stopsWhenHit)foe.haltT=1.2;
      if(this.scene.onUnitHit)this.scene.onUnitHit(u,foe);
      if(foe.hp<=0)this.kill(foe,u.side==='player');
    }
  }

  nearestEnemy(u,rangeM){
    let best=null,bd=rangeM;
    for(const o of this.units){
      if(o.side===u.side||o.dead)continue;
      const d=distM(u.ll,o.ll);
      if(d<bd){bd=d;best=o;}
    }
    return best;
  }

  count(side,type){
    return this.units.filter(u=>u.side===side&&(!type||u.type===type)).length;
  }
}
