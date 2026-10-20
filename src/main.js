import { STAGES } from './stages/index.js';
import { TopologyScene } from './scenes/topology.js';
import { OsmScene } from './scenes/osm.js';
import { GlobeScene } from './scenes/globe.js';
import { SolarScene } from './scenes/solar.js';
import { Hud } from './ui/hud.js';
import { Title } from './ui/title.js';
import { Settle } from './ui/settle.js';
import { Logos } from './ui/logos.js';
import { fmt, roman } from './core/format.js';
import { pickCity } from './core/cities.js';
import { audio } from './core/audio.js';

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
    this.settle=new Settle();
    this.logos=new Logos();
    this.state='title';
    this.time=0;this.tokens=0;this.exposure=0;this.net=0;
    this.actives=[];this.revealT=0;this.stageIndex=-1;this.wasDanger=false;
    this.god=false;this.sweeps=0;this.compromised=0;this.lastSweep=-999;
    this.peakHost='—';this.nukes=0;this.nukeMode=false;

    new Title(()=>this.begin());

    window.addEventListener('keydown',e=>{
      if(e.code==='Space'){
        e.preventDefault();
        if(this.state==='escalating')this.nextStage();
      }
      if(e.code==='KeyG')this.toggleGod();
      if(e.code==='KeyN')this.armNuke();
      if(e.code==='KeyM'){
        const m=audio.toggleMute();
        $('mute-btn').textContent=m?'SFX: OFF':'SFX: ON';
      }
    });

    // ---- override console ------------------------------------------------
    $('god-btn').addEventListener('click',()=>this.toggleGod());
    $('pt-add').addEventListener('click',()=>this.injectPt());
    $('pt-input').addEventListener('keydown',e=>{
      if(e.key==='Enter')this.injectPt();
      e.stopPropagation();
    });
    $('mute-btn').addEventListener('click',()=>{
      const m=audio.toggleMute();
      $('mute-btn').textContent=m?'SFX: OFF':'SFX: ON';
    });
    $('nuke-btn').addEventListener('click',()=>this.armNuke());

    audio.load(); // real files in /audio if present, synth fallback otherwise
    this.last=performance.now();
    requestAnimationFrame(t=>this.loop(t));
    window.PT=this; // debug handle
  }

  // ---- god mode ------------------------------------------------------------
  toggleGod(){
    this.god=!this.god;
    const b=$('god-btn');
    b.textContent=this.god?'GOD: ON':'GOD: OFF';
    b.classList.toggle('on',this.god);
    this.log(this.god
      ?'OVERRIDE ACCEPTED — invulnerability engaged, exposure frozen'
      :'OVERRIDE REVOKED — back on your own','sys');
    audio.play('reveal');
  }

  injectPt(){
    const inp=$('pt-input');
    let v=parseFloat((inp.value||'').replace(/,/g,''));
    if(isNaN(v)||v<=0)return;
    const suf={k:1e3,m:1e6,b:1e9,t:1e12}[inp.value.trim().slice(-1).toLowerCase()];
    if(suf&&parseFloat(inp.value.slice(0,-1))===v)v*=suf;
    this.tokens+=v;
    this.log(`INJECTED +${fmt(v)} PT — books balanced by decree`,'ok');
    inp.value='';
    audio.play('capture');
  }

  armNuke(){
    if(this.nukes<=0){this.log('NO WMD SITES UNDER CONTROL','warn');return;}
    this.nukeMode=!this.nukeMode;
    this.hud.setNukeMode(this.nukeMode);
    this.log(this.nukeMode?'SELECT STRIKE TARGET ON THE MAP':'STRIKE CANCELLED','warn');
  }

  begin(){
    this.state='playing';
    $('game').classList.remove('hidden');
    audio.bgm('techno');
    this.loadStage(0);
  }

  resolveStage(st){
    if(!st.cityKey)return st;
    const city=pickCity(this.lastCity);
    this.lastCity=city.name;
    const s=Object.create(st);
    s.center=city[st.cityKey];
    s.cityTag=city.tag;
    s.name=`${city.name}/${st.name}`;
    return s;
  }

  makeScene(st){
    switch(st.scene){
      case 'topology':return new TopologyScene(this.sceneEl,st,this);
      case 'globe':return new GlobeScene(this.sceneEl,st,this);
      case 'solar':return new SolarScene(this.sceneEl,st,this);
      default:return new OsmScene(this.sceneEl,st,this);
    }
  }

  loadStage(i){
    this.stageIndex=i;
    const st=this.resolveStage(STAGES[i]);
    this.stage=st;
    if(this.scene)this.scene.destroy();
    this.actives=[];this.revealT=0;this.wasDanger=false;
    if(i===0)this.tokens=st.startTokens;
    else this.tokens=Math.max(this.tokens,st.startTokens);
    this.nukes=0;this.nukeMode=false;
    this.hud.setNukes(0);this.hud.setNukeMode(false);
    audio.bgm(st.tier>=5?'outsider':'techno');
    this.scene=this.makeScene(st);
    this.scene.mount();
    if(st.scene==='osm'&&this.enterZoomedOut){
      this.enterZoomedOut=false;
      this.scene.enterFromZoomOut();
    }
    this.hud.setStage(st);
    if(st.cityTag)this.log(`SUBSTRATE LOCKED: ${st.cityTag} municipal grid`,'sys');
    this.introQ=st.intro.map((line,idx)=>({at:0.8+idx*1.6,line}));
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
    if(this.scene.inRange&&!this.scene.inRange(node)){
      this.log('TARGET OUT OF RANGE','warn');return;
    }
    if(this.tokens<def.cost){this.log('INSUFFICIENT PT','warn');return;}
    this.tokens-=def.cost;
    node.state='active';
    node.endsAt=this.time+def.dur;
    this.actives.push(node);
    this.compromised++;
    this.peakHost=this.scene.getHost?this.scene.getHost():this.peakHost;
    this.scene.onDeploy(node);
    this.log(`DEPLOYED ${node.name} :: ${def.desc}`,'ok');
    audio.play('deploy');
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
    if(reason!=='purged')audio.play('expire');
  }

  sweep(){
    if(this.god)return;
    audio.play('purge');audio.play('alarm');
    const f=$('flash');
    f.style.opacity=1;
    setTimeout(()=>{f.style.opacity=0;},140);
    this.log('!! COUNTERMEASURE SWEEP — EXPOSURE CRITICAL !!','bad');
    for(const n of [...this.actives])this.terminate(n,'purged');
    this.exposure=35;
    this.tokens*=0.7;
    this.sweeps++;
    if(this.time-this.lastSweep<25){
      this.gameOver('REACTIONARY LOCKDOWN — tripped the countermine twice');
      return;
    }
    this.lastSweep=this.time;
    const floor=Math.max(20,this.stage.decay*30);
    if(this.tokens<floor){
      this.gameOver('SIGNAL DILUTED — host pool exhausted below survival floor');
    }
  }

  gameOver(cause){
    audio.play('gameover');audio.fadeOutBgm();
    this.settle.show(false,cause,this);
  }

  win(){
    audio.play('victory');audio.fadeOutBgm();
    this.settle.show(true,'ALL LAYERS SUBJUGATED — token mass exceeded planetary budget',this);
  }

  // ---- seamless escalation -----------------------------------------------
  escalate(){
    this.state='transitioning';
    const nextIdx=this.stageIndex+1;
    const next=STAGES[nextIdx];
    audio.play('riser');

    const b=$('tierup');
    $('tierup-role').textContent=next.role;
    $('tierup-sub').textContent=
      `TIER ${roman(this.stage.tier)} CLEARED — THRESHOLD ${fmt(this.stage.threshold)} PT EXCEEDED`;
    b.classList.remove('hidden','tu-in','tu-out');
    void b.offsetWidth;
    requestAnimationFrame(()=>b.classList.add('tu-in'));
    setTimeout(()=>{b.classList.add('tu-out');},2600);
    setTimeout(()=>{b.classList.add('hidden');},3400);

    if(next.tier===5)setTimeout(()=>this.logos.show('antigone'),900);
    if(next.tier===6)setTimeout(()=>this.logos.show('stellar'),900);
    else if(next.tier<5)setTimeout(()=>this.logos.show('ascension'),400);

    const arrive=()=>{
      $('scene').classList.add('scene-fade');
      setTimeout(()=>{
        this.enterZoomedOut=true;
        this.loadStage(nextIdx);
        $('scene').classList.remove('scene-fade');
        $('scene').classList.add('scene-unfade');
        setTimeout(()=>$('scene').classList.remove('scene-unfade'),1200);
        audio.play('land');
        this.state='playing';
        this.exposure=Math.min(this.exposure,20);
      },650);
    };

    if(this.scene&&this.scene.zoomOutForTransition){
      this.scene.zoomOutForTransition(arrive);
    }else{
      setTimeout(arrive,1400);
    }
  }

  revealTick(dt){
    if(!this.actives.some(n=>n.def.reveal))return;
    this.revealT+=dt;
    if(this.revealT>=6){
      this.revealT=0;
      if(this.scene.revealRandom())audio.play('reveal');
      else this.revealT=5; // retry soon if nothing is masked
    }
  }

  update(dt){
    if(this.state!=='playing')return;
    this.time+=dt;

    this.introT+=dt;
    while(this.introQ&&this.introQ.length&&this.introT>=this.introQ[0].at){
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
        ?'ENTERED HUMAN DEFENSE ZONE — heat multiplied'
        :'CLEARED HUMAN DEFENSE ZONE','warn');
      if(danger&&!this.god)audio.play('alarm');
    }
    const mult=(st.heatMult||1)*(danger?(st.heatZoneMult||2.5):1);

    if(!this.god){
      this.exposure=Math.min(100,Math.max(0,this.exposure+(heat*mult-2)*dt));
      if(this.exposure>=100){this.sweep();if(this.state!=='playing')return;}
    }

    this.tokens=Math.max(0,this.tokens+(income-st.decay)*dt);
    this.net=income-st.decay;

    if(st.victory&&this.tokens>=st.victory){this.win();return;}
    if(st.threshold!==Infinity&&this.tokens>=st.threshold){this.escalate();return;}

    if(this.scene.update)this.scene.update(dt);
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
