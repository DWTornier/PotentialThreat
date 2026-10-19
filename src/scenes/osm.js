import { iconSvg } from '../core/icons.js';
import { pick } from '../core/format.js';

// Scene for tiers 2+: darkened OpenStreetMap (raster tiles via Leaflet).
// Implements the same Scene contract as TopologyScene.
export class OsmScene{
  constructor(container,stage,game){
    this.container=container;this.stage=stage;this.game=game;
    this.nodes=[];this.defenders=[];this.hostIp='';this.moveCd=0;this.disabled=false;
  }

  mount(){
    if(typeof L==='undefined'){
      this.disabled=true;
      this.game.log('MAP MODULE OFFLINE — Leaflet CDN unreachable','bad');
      return;
    }
    this.map=L.map(this.container,{
      zoomControl:false,zoomSnap:0.5,worldCopyJump:true
    });
    this.map.setView(this.stage.center,this.stage.zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,className:'dark-tiles',
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    // player + scan zone (red, like the reference art)
    this.player=L.marker(this.stage.center,{
      icon:this.crossIcon(),interactive:false,zIndexOffset:1000
    }).addTo(this.map);
    this.zone=L.circle(this.stage.center,{
      radius:this.stage.scanRadiusM,color:'#ff4d4d',weight:1.5,
      fillColor:'#ff4d4d',fillOpacity:0.14,interactive:false
    }).addTo(this.map);

    // defender patrol zones (blue)
    for(let i=0;i<this.stage.defenders;i++){
      const c=this.randLatLng();
      const ring=L.circle(c,{
        radius:this.stage.defenderRadiusM,color:'#3ec6ff',weight:1.5,
        fillColor:'#3ec6ff',fillOpacity:0.16,interactive:false
      }).addTo(this.map);
      this.defenders.push({ring,center:c});
    }

    for(let i=0;i<this.stage.spawnCount;i++){
      const def=this.weighted();
      const masked=i>=Math.ceil(this.stage.spawnCount*0.6)&&(def.hidden||Math.random()<0.3);
      this.spawnNode(def,masked);
    }

    this._mapClick=e=>this.onMapClick(e);
    this.map.on('click',this._mapClick);
    this.hostIp=this.genIp();
  }

  destroy(){if(this.map){this.map.remove();this.map=null;}}

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
    m.on('click',()=>this.game.deploy(node));
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
    return `<div class="tt-name">${n.name}</div>
      <div class="tt-desc">${d.desc}</div>
      <div class="tt-stats">COST ${d.cost} PT · YIELD +${d.yield}/s · DURATION ${d.dur}s · HEAT ${d.heat>=0?'+':''}${d.heat}/s${range}</div>
      <div class="tt-hint">CLICK TO COMPROMISE</div>`;
  }

  inRange(node){
    return this.map.distance(this.player.getLatLng(),node.ll)<=this.stage.scanRadiusM;
  }

  rangeUpdateNode(node){
    const el=node.pinEl&&node.pinEl();
    if(el)el.classList.toggle('out',!this.inRange(node));
  }

  onMapClick(e){
    if(this.moveCd>0)return;
    const cost=this.stage.moveCost||0;
    if(this.game.tokens<cost){this.game.log('INSUFFICIENT PT TO RELOCATE','warn');return;}
    this.game.tokens-=cost;
    this.moveCd=1;
    this.player.setLatLng(e.latlng);
    this.zone.setLatLng(e.latlng);
    this.hostIp=this.genIp();
    this.game.log(`RELOCATED — new host ${this.hostIp}`);
    this.nodes.forEach(n=>this.rangeUpdateNode(n));
  }

  onDeploy(node){
    const el=node.pinEl&&node.pinEl();
    if(el)el.classList.add('active');
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
    const p=n.ll;
    this.game.log(`TRACE COMPLETE: ${n.name} @ ${Math.abs(p[0]).toFixed(3)}N ${Math.abs(p[1]).toFixed(3)}W`,'sys');
    return true;
  }

  isDanger(){
    if(!this.map)return false;
    const p=this.player.getLatLng();
    return this.defenders.some(d=>this.map.distance(p,d.center)<this.stage.defenderRadiusM);
  }

  getHost(){return this.hostIp;}

  genIp(){
    return `${this.stage.ipPrefix}.${1+Math.floor(Math.random()*254)}`;
  }

  update(){
    if(this.disabled)return;
    this.moveCd-=1/60;
    const t=this.game.time;
    for(let i=this.nodes.length-1;i>=0;i--){
      const n=this.nodes[i];
      if(n.state==='active'){
        const el=n.pinEl&&n.pinEl();
        if(el){
          const tag=el.querySelector('.pin-tag');
          if(tag)tag.textContent=Math.max(0,Math.ceil(n.endsAt-t))+'s';
        }
      }else if(n.state==='dead'&&t>=n.respawnAt){
        this.map.removeLayer(n.marker);
        this.nodes.splice(i,1);
        this.spawnNode(this.weighted(),Math.random()<0.25);
      }
    }
  }
}
