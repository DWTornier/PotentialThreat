import { STAGES } from './stages/index.js';
import { TopologyScene } from './scenes/topology.js';
import { OsmScene } from './scenes/osm.js';
import { Hud } from './ui/hud.js';
import { Title } from './ui/title.js';
import { fmt, roman } from './core/format.js';

const $=id=>document.getElementById(id);

class Game{
  constructor(){
    this.sceneEl=$('scene');
    this.tooltipEl=$('tooltip');
    this.logEl=$('log');

    this.tooltip={
      show:(html,x,y)=>{
        this.tooltipEl.innerHTML=html;
        this.tooltipEl.classList.remove('hidden');
        const r=this.tooltipEl.getBoundingClientRect();
        this.tooltipEl.style.left=Math.min(x,innerWidth-r.width-10)+'px';
        this.tooltipEl.style.top=Math.min(y,innerHeight-r.height-10)+'px';
      },
      hide:()=>this.tooltipEl.classList.add('hidden')
    };

    this.hud=new Hud();
    this.state='title';
    this.time=0;this.tokens=0;this.exposure=0;this.net=0;
    this.actives=[];this.revealT=0;this.stageIndex=-1;this.wasDanger=false;

    new Title(()=>this.begin());

    window.addEventListener('keydown',e=>{
      if(e.code==='Space'){
        e.preventDefault();
        if(this.state==='escalating')this.nextStage();
      }
    });

    this.last=performance.now();
    requestAnimationFrame(t=>this.loop(t));
  }

  begin(){
    this.state='playing';
    $('game').classList.remove('hidden');
    this.loadStage(0);
  }

  loadStage(i){
    this.stageIndex=i;
    const st=STAGES[i];
    this.stage=st;
    if(this.scene)this.scene.destroy();
    this.actives=[];this.revealT=0;this.wasDanger=false;
    if(i===0)this.tokens=st.startTokens;
    this.scene=st.scene==='topology'
      ?new TopologyScene(this.sceneEl,st,this)
      :new OsmScene(this.sceneEl,st,this);
    this.scene.mount();
    this.hud.setStage(st);
    this.introQ=st.intro.map((line,idx)=>({at:1+idx*1.6,line}));
    this.introT=0;
  }

  log(msg,cls=''){
    const d=document.createElement('div');
    d.className='log-line '+cls;
    d.textContent=`[${this.clock()}] ${msg}`;
    this.logEl.appendChild(d);
    while(this.logEl.children.length>9)this.logEl.firstChild.remove();
  }

  clock(){
    const t=Math.floor(this.time);
    return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
  }

  deploy(node){
    if(!node||node.state!=='idle')return;
    if(node.masked){this.log('UNKNOWN HOST — run a tracer to reveal it','warn');return;}
    const def=node.def;
    if(!this.scene.inRange(node)){this.log('TARGET OUT OF RANGE','warn');return;}
    if(this.tokens<def.cost){this.log('INSUFFICIENT PT','warn');return;}
    this.tokens-=def.cost;
    node.state='active';
    node.endsAt=this.time+def.dur;
    this.actives.push(node);
    this.scene.onDeploy(node);
    this.log(`DEPLOYED ${node.name} :: ${def.desc}`,'ok');
  }

  terminate(node,reason){
    this.actives=this.actives.filter(n=>n!==node);
    node.state='dead';
    this.scene.onTerminate(node,reason);
    this.log(
      reason==='purged'
        ?`PURGED: ${node.name} — countermeasure sweep hit the process`
        :`PROCESS EXPIRED: ${node.name} — cleaned up by host`,
      reason==='purged'?'bad':''
    );
  }

  sweep(){
    const f=$('flash');
    f.style.opacity=1;
    setTimeout(()=>{f.style.opacity=0;},140);
    this.log('!! COUNTERMEASURE SWEEP — EXPOSURE CRITICAL !!','bad');
    for(const n of [...this.actives])this.terminate(n,'purged');
    this.exposure=35;
  }

  escalate(){
    this.state='escalating';
    const next=STAGES[this.stageIndex+1];
    $('su-role').textContent=next.role;
    $('su-sub').textContent=
      `TIER ${roman(this.stage.tier)} CLEARED — THRESHOLD ${fmt(this.stage.threshold)} PT EXCEEDED`;
    $('stageup').classList.remove('hidden');
  }

  nextStage(){
    $('stageup').classList.add('hidden');
    this.state='playing';
    this.loadStage(this.stageIndex+1);
  }

  revealTick(dt){
    if(!this.actives.some(n=>n.def.reveal))return;
    this.revealT+=dt;
    if(this.revealT>=6){
      this.revealT=0;
      if(!this.scene.revealRandom())this.revealT=5; // retry soon if nothing masked
    }
  }

  update(dt){
    if(this.state!=='playing')return;
    this.time+=dt;

    // staged narrative intro
    this.introT+=dt;
    while(this.introQ.length&&this.introT>=this.introQ[0].at){
      this.log(this.introQ.shift().line,'sys');
    }

    const st=this.stage;
    let income=st.baseline,heat=0;
    for(const n of [...this.actives]){
      if(this.time>=n.endsAt){this.terminate(n,'expired');continue;}
      income+=n.def.yield;
      heat+=n.def.heat;
    }
    this.income=income;this.heat=heat;

    this.revealTick(dt);

    const danger=this.scene.isDanger?this.scene.isDanger():false;
    if(danger!==this.wasDanger){
      this.wasDanger=danger;
      this.log(danger
        ?'ENTERED DEFENDER SWEEP ZONE — heat multiplied'
        :'CLEARED DEFENDER ZONE','warn');
    }
    const mult=(st.heatMult||1)*(danger?(st.heatZoneMult||2.5):1);

    this.exposure=Math.min(100,Math.max(0,this.exposure+(heat*mult-2)*dt));
    if(this.exposure>=100)this.sweep();

    this.tokens=Math.max(0,this.tokens+(income-st.decay)*dt);
    this.net=income-st.decay;

    if(st.threshold!==Infinity&&this.tokens>=st.threshold){this.escalate();return;}

    this.scene.update(dt);
    if(this.scene.draw)this.scene.draw();
    this.hud.update(this);
  }

  loop(t){
    const dt=Math.min(0.1,(t-this.last)/1000);
    this.last=t;
    this.update(dt);
    requestAnimationFrame(tt=>this.loop(tt));
  }
}

new Game();
