import { pick } from '../core/format.js';

// Scene for tier 1: an abstract network-topology graph on canvas.
// Implements the Scene contract used by Game:
//   mount / destroy / update(dt) / draw() / inRange(node) /
//   onDeploy(node) / onTerminate(node, reason) / revealRandom() / getHost()
export class TopologyScene{
  constructor(container,stage,game){
    this.container=container;this.stage=stage;this.game=game;
    this.nodes=[];this.edges=[];this.hover=null;this.playerNode=null;
    this.subnetN=42;this.flow=0;this.w=0;this.h=0;
  }

  mount(){
    this.canvas=document.createElement('canvas');
    this.canvas.className='net-canvas';
    this.container.appendChild(this.canvas);
    this.ctx=this.canvas.getContext('2d');
    this._resize=()=>this.resize();
    window.addEventListener('resize',this._resize);
    this.resize();
    this._onMove=e=>this.onMove(e);
    this._onLeave=()=>{this.hover=null;this.game.tooltip.hide();};
    this._onClick=()=>{if(this.hover)this.game.deploy(this.hover);};
    this.canvas.addEventListener('mousemove',this._onMove);
    this.canvas.addEventListener('mouseleave',this._onLeave);
    this.canvas.addEventListener('click',this._onClick);
    this.build();
  }

  destroy(){
    window.removeEventListener('resize',this._resize);
    this.canvas.removeEventListener('mousemove',this._onMove);
    this.canvas.removeEventListener('mouseleave',this._onLeave);
    this.canvas.removeEventListener('click',this._onClick);
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

  build(){
    const defs=this.stage.nodes;
    const total=9;
    const gw=defs.find(d=>d.key==='gateway')||defs[0];
    const order=[gw];
    while(order.length<total)order.push(this.weighted());
    this.nodes=order.map((def,i)=>this.makeNode(def,{
      slotA:i===0?0:((i-1)/(total-1))*Math.PI*2,
      ring:i===0?0:(i<5?0.32:0.47),
      masked:i>2&&(def.hidden||Math.random()<0.3)
    }));
    this.edges=[];
    for(let i=1;i<this.nodes.length;i++)this.edges.push([0,i]);
    for(let i=1;i<this.nodes.length-1;i+=2)this.edges.push([i,i+1]);
  }

  makeNode(def,opt={}){
    return {
      def,
      name:pick(def.names)||def.key.toUpperCase(),
      slotA:opt.slotA??Math.random()*Math.PI*2,
      ring:opt.ring??(0.3+Math.random()*0.18),
      masked:!!opt.masked,
      jit:(Math.random()-0.5)*0.3,
      state:'idle',endsAt:0,respawnAt:0,px:0,py:0
    };
  }

  pos(n){
    const R=n.ring*Math.min(this.w,this.h);
    const a=n.slotA+n.jit;
    return {x:this.w/2+Math.cos(a)*R*1.18,y:this.h/2+Math.sin(a)*R*0.82};
  }

  onMove(e){
    const r=this.canvas.getBoundingClientRect();
    const mx=e.clientX-r.left,my=e.clientY-r.top;
    let best=null,bd=26;
    for(const n of this.nodes){
      if(n.state==='dead'||n.px===undefined)continue;
      const d=Math.hypot(n.px-mx,n.py-my);
      if(d<bd){bd=d;best=n;}
    }
    this.hover=best;
    this.canvas.style.cursor=best?'pointer':'crosshair';
    if(best){this.game.tooltip.show(this.ttHtml(best),e.clientX+16,e.clientY+14);}
    else this.game.tooltip.hide();
  }

  ttHtml(n){
    if(n.masked){
      return `<div class="tt-name">UNKNOWN HOST</div>
        <div class="tt-desc">Signature encrypted. Deploy a tracer (gateway, mailer or camera) to reveal it.</div>
        <div class="tt-hint">UNTRACEABLE</div>`;
    }
    const d=n.def;
    return `<div class="tt-name">${n.name}</div>
      <div class="tt-desc">${d.desc}</div>
      <div class="tt-stats">COST ${d.cost} PT · YIELD +${d.yield}/s · DURATION ${d.dur}s · HEAT ${d.heat>=0?'+':''}${d.heat}/s</div>
      <div class="tt-hint">CLICK TO COMPROMISE</div>`;
  }

  inRange(node){return !node.masked&&node.state==='idle';}

  onDeploy(node){this.playerNode=node;this.subnetN++;}

  onTerminate(node){
    node.state='dead';
    node.respawnAt=this.game.time+16+Math.random()*22;
    if(this.playerNode===node)this.playerNode=null;
  }

  revealRandom(){
    const cands=this.nodes.filter(n=>n.masked);
    if(!cands.length)return false;
    const n=cands[Math.floor(Math.random()*cands.length)];
    n.masked=false;
    this.subnetN++;
    this.game.log(`TRACE COMPLETE: ${n.name} @ 192.168.1.${this.subnetN}`,'sys');
    return true;
  }

  getHost(){return `192.168.1.${this.subnetN}`;}

  update(){
    const t=this.game.time;
    for(let i=0;i<this.nodes.length;i++){
      const n=this.nodes[i];
      if(n.state==='dead'&&t>=n.respawnAt){
        const def=this.weighted();
        this.nodes[i]=this.makeNode(def,{
          slotA:n.slotA,ring:n.ring,
          masked:def.hidden||Math.random()<0.25
        });
      }
    }
  }

  draw(){
    const c=this.ctx,t=this.game.time;
    this.flow+=1;
    c.clearRect(0,0,this.w,this.h);
    c.fillStyle='#0a0d12';c.fillRect(0,0,this.w,this.h);

    // background grid
    c.strokeStyle='rgba(120,140,160,.05)';c.lineWidth=1;c.beginPath();
    for(let x=0;x<this.w;x+=60){c.moveTo(x,0);c.lineTo(x,this.h);}
    for(let y=0;y<this.h;y+=60){c.moveTo(0,y);c.lineTo(this.w,y);}
    c.stroke();

    const P=this.nodes.map(n=>n.state==='dead'?null:this.pos(n));

    // edges + moving packets
    c.save();
    c.strokeStyle='rgba(110,255,140,.16)';c.lineWidth=1;
    c.setLineDash([6,8]);c.lineDashOffset=-this.flow;
    for(const [a,b] of this.edges){
      if(!P[a]||!P[b])continue;
      c.beginPath();c.moveTo(P[a].x,P[a].y);c.lineTo(P[b].x,P[b].y);c.stroke();
    }
    c.restore();
    c.fillStyle='rgba(140,255,160,.65)';
    this.edges.forEach(([a,b],k)=>{
      if(!P[a]||!P[b])return;
      const u=((this.flow*0.006)+k*0.37)%1;
      c.beginPath();
      c.arc(P[a].x+(P[b].x-P[a].x)*u,P[a].y+(P[b].y-P[a].y)*u,2,0,7);
      c.fill();
    });

    // nodes
    c.textAlign='center';c.textBaseline='middle';
    for(let i=0;i<this.nodes.length;i++){
      const n=this.nodes[i];
      if(n.state==='dead')continue;
      const p=P[i];n.px=p.x;n.py=p.y;
      const active=n.state==='active';
      const frac=active?Math.max(0,(n.endsAt-t)/n.def.dur):0;
      c.beginPath();c.arc(p.x,p.y,16,0,7);
      c.fillStyle='#0f141c';c.fill();
      c.lineWidth=2;
      c.strokeStyle=n.masked?'#3d4754':active?'#8ef58a':(this.hover===n?'#ffffff':'#9aa6b2');
      c.stroke();
      if(active){
        c.beginPath();c.arc(p.x,p.y,21,-Math.PI/2,-Math.PI/2+Math.PI*2*frac);c.stroke();
      }
      c.fillStyle=n.masked?'#6b7683':active?'#8ef58a':'#cfd6dd';
      c.font='11px "Share Tech Mono",monospace';
      c.fillText(n.masked?'?':n.def.tag,p.x,p.y);
      c.fillStyle=n.masked?'#59636f':'#8d99a6';
      c.fillText(n.masked?'UNKNOWN':n.name,p.x,p.y+31);
      if(active||this.hover===n){
        const label=active?Math.ceil(n.endsAt-t)+'s':n.def.cost+'PT';
        c.fillStyle=active?'#8ef58a':'#b8e986';
        c.fillText(label,p.x,p.y-31);
      }
    }

    // player crosshair
    const pp=(this.playerNode&&this.playerNode.state!=='dead'&&this.playerNode.px!==undefined)
      ?{x:this.playerNode.px,y:this.playerNode.py}:{x:this.w/2,y:this.h/2};
    c.strokeStyle='rgba(255,70,70,.9)';c.lineWidth=2;
    c.beginPath();
    c.moveTo(pp.x-11,pp.y);c.lineTo(pp.x+11,pp.y);
    c.moveTo(pp.x,pp.y-11);c.lineTo(pp.x,pp.y+11);
    c.stroke();
    c.beginPath();c.arc(pp.x,pp.y,10+3*Math.sin(t*4),0,7);
    c.strokeStyle='rgba(255,70,70,.45)';c.stroke();
  }
}
