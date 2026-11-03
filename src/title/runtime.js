// =====================================================================
// TitleRuntime — HOST for the intro cutscene. Knows nothing about models,
// cameras or renderers. It owns:
//   * the single requestAnimationFrame loop and the ctx values
//   * the phase machine (BOOT -> INTRO -> IDLE -> EXIT)
//   * click / Space / pointer / resize forwarding
//   * activation -> fade out -> dispose -> onStart()
//   * failure isolation: a broken sequence falls back to 'wireframe'
// =====================================================================

import { defineIntroSequence, validateIntroSequence, PHASES, TITLE_THEME, CONTRACT_VERSION } from './contract.js';
import { selectIntroId, resolveIntroFactory, FALLBACK_INTRO_ID } from './registry.js';
import './sequences/index.js'; // side effect: register built-in sequences

const $=id=>document.getElementById(id);

export class TitleRuntime{
  constructor({onStart,introId=null}={}){
    this.onStart=onStart||(()=>{});
    this.el=$('title');
    this.root=$('title-stage');
    this.seq=null;
    this.raf=0;
    this.started=false;
    this.fallbackUsed=false;
    this.last=performance.now();

    this.chrome=this._makeChrome();
    this.ctx=this._makeContext();
    this.ctx.chrome=this.chrome;

    this._bindInput();
    this._measure();
    this._boot(introId||selectIntroId());
  }

  // ---- context ------------------------------------------------------
  _makeContext(){
    const probe=document.createElement('canvas');
    const webgl2=!!probe.getContext('webgl2');
    const mq=q=>{try{return matchMedia(q).matches;}catch(e){return false;}};
    return {
      contract:CONTRACT_VERSION,
      time:0,dt:0,frame:0,
      phase:PHASES.BOOT,phaseTime:0,progress:0,loopTime:0,
      width:innerWidth,height:innerHeight,dpr:1,aspect:innerWidth/innerHeight,
      root:this.root,
      chrome:null,
      theme:TITLE_THEME,
      world:Object.freeze({
        version:'v0.2',title:'POTENTIAL THREAT',playtype:'ai-agent',
        tierCount:6,tagline:'AN INCREMENTAL OF UNCHECKED ESCALATION',
        credits:'MAP DATA © OPENSTREETMAP CONTRIBUTORS'
      }),
      input:{pointer:{x:0,y:0,nx:0,ny:0,inside:false},keys:new Set(),
        lastInputAt:-1,skipRequested:false},
      flags:{
        reducedMotion:mq('(prefers-reduced-motion: reduce)'),
        touch:mq('(pointer: coarse)'),
        mobile:innerWidth<820,
        webgl:webgl2||!!probe.getContext('webgl'),
        webgl2
      },
      seed:0x5eed1a,
      // lazily imported so cutscenes never hard-depend on the audio layer
      sfx:key=>import('../core/audio.js').then(m=>m.audio.play(key)).catch(()=>{}),
      music:style=>import('../core/audio.js').then(m=>m.audio.bgm(style)).catch(()=>{}),
      log:(...a)=>console.log('[INTRO]',...a),
      onIntroComplete:()=>this._completeIntro(),
      requestSkip:()=>this._skip(),
      requestStart:()=>this._start()
    };
  }

  _makeChrome(){
    const q=s=>this.el.querySelector(s);
    const c={
      el:{
        root:this.el,stage:this.root,title:q('h1'),press:$('title-press'),
        caption:$('title-caption'),sub:$('title-sub'),
        captionWrap:$('title-caption-wrap'),footer:q('.title-foot'),
        stars:q('.title-stars'),inner:q('.title-inner')
      },
      setTitle(text){c.el.title.textContent=String(text).replace(/ /g,'\u00A0');},
      setCaption(name,sub=''){c.el.caption.textContent=name;c.el.sub.textContent=sub;},
      setCaptionSwap(on){c.el.captionWrap.classList.toggle('cap-swap',!!on);},
      setPress(text,visible=true){
        c.el.press.textContent=text;
        c.el.press.style.visibility=visible?'visible':'hidden';
      },
      setFooter(text){c.el.footer.textContent=text;},
      show:on=>this.el.classList.toggle('intro-chrome-hidden',!on)
    };
    return c;
  }

  // ---- input --------------------------------------------------------
  _bindInput(){
    this._onKeyDown=e=>{
      this.ctx.input.keys.add(e.code);
      if(e.code==='Space'){e.preventDefault();this._activate();}
    };
    this._onKeyUp=e=>this.ctx.input.keys.delete(e.code);
    this._onClick=()=>this._activate();
    this._onMove=e=>{
      const r=this.el.getBoundingClientRect();
      const p=this.ctx.input.pointer;
      p.x=e.clientX-r.left;p.y=e.clientY-r.top;
      p.nx=(p.x/r.width)*2-1;p.ny=1-(p.y/r.height)*2;
      p.inside=true;
    };
    this._onLeave=()=>{this.ctx.input.pointer.inside=false;};
    this._onResize=()=>this._measure();
    window.addEventListener('keydown',this._onKeyDown);
    window.addEventListener('keyup',this._onKeyUp);
    window.addEventListener('resize',this._onResize);
    this.el.addEventListener('click',this._onClick);
    this.el.addEventListener('pointermove',this._onMove);
    this.el.addEventListener('pointerleave',this._onLeave);
  }

  _activate(){
    const c=this.ctx;
    c.input.lastInputAt=c.time;
    try{this.seq&&this.seq.onInput&&this.seq.onInput(c);}catch(e){this._fail(e);}
    const seq=this.seq;
    if(seq&&seq.inputMode==='skip'&&seq.skippable!==false&&c.phase===PHASES.INTRO){
      c.input.skipRequested=true;
      c.requestSkip();
    }else{
      c.requestStart();
    }
  }

  // ---- lifecycle ----------------------------------------------------
  async _boot(id){
    const factory=resolveIntroFactory(id);
    if(!factory){
      console.error('[INTRO] no such sequence:',id);
      this.ctx.phase=PHASES.IDLE;
      return;
    }
    try{
      const seq=defineIntroSequence(factory(this.ctx));
      const errors=validateIntroSequence(seq);
      if(errors.length)throw new Error(errors.join('; '));
      this.seq=seq;
      if(seq.managesChrome)this.chrome.show(false);
      else this.chrome.setCaption('',''); // clear any stale subtitle left by the previous module
      if(seq.preload)await seq.preload(this.ctx);
      if(this.started)return; // user activated during preload
      seq.mount(this.ctx);
      this.ctx.phase=PHASES.INTRO;
      this.ctx.phaseTime=0;
      this._measure();
      this.last=performance.now();
      this.raf=requestAnimationFrame(t=>this._frame(t));
    }catch(e){
      this._fail(e);
    }
  }

  _frame(t){
    if(this.started)return;
    const c=this.ctx;
    c.dt=Math.min(0.05,(t-this.last)/1000);
    this.last=t;
    c.time+=c.dt;c.frame++;
    if(c.phase===PHASES.INTRO||c.phase===PHASES.IDLE)c.phaseTime+=c.dt;

    const seq=this.seq;
    if(seq&&c.phase===PHASES.INTRO){
      if(!seq.looping&&seq.duration>0){
        c.progress=Math.min(1,c.phaseTime/seq.duration);
        c.loopTime=c.phaseTime%seq.duration;
        if(c.progress>=1)this._completeIntro();
      }else{
        c.progress=0;
        c.loopTime=seq.duration>0?c.phaseTime%seq.duration:c.phaseTime;
      }
    }

    try{
      // ownsLoop=true: host still ticks ctx/phases, the sequence self-renders.
      if(seq&&!seq.ownsLoop){seq.update(c.dt,c);seq.render(c);}
    }catch(e){
      this._fail(e);
      return; // _boot() will schedule a fresh loop via the fallback
    }
    this.raf=requestAnimationFrame(tt=>this._frame(tt));
  }

  _completeIntro(){
    const c=this.ctx;
    if(c.phase!==PHASES.INTRO)return;
    c.phase=PHASES.IDLE;c.phaseTime=0;c.progress=1;
    this.chrome.setPress(c.theme.press,true);
    try{this.seq&&this.seq.onIntroComplete&&this.seq.onIntroComplete(c);}
    catch(e){this._fail(e);}
  }

  _skip(){
    const c=this.ctx;
    if(c.phase!==PHASES.INTRO)return;
    c.input.skipRequested=true;
    this._completeIntro();
    try{this.seq&&this.seq.onSkip&&this.seq.onSkip(c);}
    catch(e){this._fail(e);}
  }

  _start(){
    if(this.started)return;
    this.started=true;
    this.ctx.phase=PHASES.EXIT;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown',this._onKeyDown);
    window.removeEventListener('keyup',this._onKeyUp);
    window.removeEventListener('resize',this._onResize);
    this.el.removeEventListener('click',this._onClick);
    this.el.removeEventListener('pointermove',this._onMove);
    this.el.removeEventListener('pointerleave',this._onLeave);
    try{this.seq&&this.seq.dispose();}catch(e){console.warn('[INTRO] dispose failed',e);}
    this.seq=null;
    this.el.classList.add('gone');
    setTimeout(()=>this.el.remove(),750);
    this.onStart();
  }

  _measure(){
    const r=this.el.getBoundingClientRect();
    const w=r.width||innerWidth,h=r.height||innerHeight;
    const d=Math.min(2,window.devicePixelRatio||1);
    Object.assign(this.ctx,{width:w,height:h,dpr:d,aspect:w/h});
    this.ctx.flags.mobile=innerWidth<820;
    try{this.seq&&this.seq.resize&&this.seq.resize(this.ctx);}
    catch(e){this._fail(e);}
  }

  /** Broken third-party sequence? Isolate it and keep the title usable. */
  _fail(e){
    console.warn('[INTRO] sequence failed, falling back to',FALLBACK_INTRO_ID,e);
    if(this.fallbackUsed)return;
    this.fallbackUsed=true;
    cancelAnimationFrame(this.raf);
    try{this.seq&&this.seq.dispose();}catch(_){/* ignore */}
    this.seq=null;
    this.chrome.show(true);
    this._boot(FALLBACK_INTRO_ID);
  }
}
