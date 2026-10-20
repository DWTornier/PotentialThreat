// =====================================================================
// SFX — pure WebAudio synthesized retro-terminal sounds. No assets.
// Every sound is a tiny oscillator patch so the game stays one folder.
// Autoplay-safe: lazily creates the AudioContext on first user gesture.
// =====================================================================

class Sfx{
  constructor(){
    this.ctx=null;
    this.master=null;
    this.muted=false;
    this._unlock=()=>this.init();
    window.addEventListener('pointerdown',this._unlock,{once:true});
    window.addEventListener('keydown',this._unlock,{once:true});
  }

  init(){
    if(this.ctx){
      if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
      return;
    }
    try{
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.master=this.ctx.createGain();
      this.master.gain.value=0.5;
      // gentle lowpass so square/saw blips feel like 80s hardware, not earasers
      this.comp=this.ctx.createBiquadFilter();
      this.comp.type='lowpass';this.comp.frequency.value=9000;
      this.master.connect(this.comp).connect(this.ctx.destination);
    }catch(e){this.ctx=null;}
  }

  setMuted(m){
    this.muted=m;
    if(this.master)this.master.gain.value=m?0:0.5;
  }

  toggleMute(){this.setMuted(!this.muted);return this.muted;}

  // ---- primitive patches -------------------------------------------
  tone({f=440,f2=null,type='square',dur=0.12,vol=0.2,delay=0,slide=0.3}={}){
    if(!this.ctx||this.muted)return;
    const t=this.ctx.currentTime+delay;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(f,t);
    if(f2!=null)o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+dur*slide+0.01);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(vol,t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g).connect(this.master);
    o.start(t);o.stop(t+dur+0.05);
  }

  noise({dur=0.3,vol=0.25,delay=0,freq=1000,q=1,type='bandpass'}={}){
    if(!this.ctx||this.muted)return;
    const t=this.ctx.currentTime+delay;
    const n=Math.floor(this.ctx.sampleRate*dur);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const src=this.ctx.createBufferSource();src.buffer=buf;
    const f=this.ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;
    const g=this.ctx.createGain();g.gain.value=vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  // ---- game events ---------------------------------------------------
  hover(){this.tone({f:1400,f2:1600,type:'sine',dur:0.04,vol:0.05});}
  click(){this.tone({f:900,f2:600,type:'square',dur:0.05,vol:0.08});}
  deploy(){this.tone({f:520,f2:880,type:'square',dur:0.1,vol:0.14});
    this.tone({f:1040,type:'sine',dur:0.08,vol:0.08,delay:0.08});}
  reveal(){this.tone({f:660,f2:1320,type:'sine',dur:0.14,vol:0.1});
    this.tone({f:1320,f2:1980,type:'sine',dur:0.12,vol:0.07,delay:0.1});}
  expire(){this.tone({f:520,f2:180,type:'triangle',dur:0.18,vol:0.1});}
  purge(){this.noise({dur:0.5,vol:0.3,freq:400,q:0.6});
    this.tone({f:220,f2:60,type:'sawtooth',dur:0.5,vol:0.18});}
  alarm(){for(let i=0;i<3;i++)this.tone({f:880,f2:660,type:'square',dur:0.14,vol:0.12,delay:i*0.2});}
  relocate(){this.tone({f:300,f2:700,type:'triangle',dur:0.12,vol:0.1});}
  capture(){this.tone({f:440,f2:1760,type:'sine',dur:0.2,vol:0.13});
    this.tone({f:1760,type:'sine',dur:0.15,vol:0.08,delay:0.16});}
  riser(){ // seamless escalation: rising sweep
    if(!this.ctx||this.muted)return;
    this.tone({f:120,f2:1800,type:'sawtooth',dur:1.5,vol:0.1,slide:1});
    this.tone({f:240,f2:3600,type:'sine',dur:1.5,vol:0.06,slide:1});
    this.noise({dur:1.4,vol:0.06,freq:2400,q:0.5});
  }
  land(){ // new stage locked in
    this.tone({f:160,type:'square',dur:0.14,vol:0.16});
    this.tone({f:320,type:'square',dur:0.14,vol:0.12,delay:0.12});
    this.tone({f:640,type:'square',dur:0.2,vol:0.12,delay:0.24});
  }
  logoGlitch(){this.noise({dur:0.18,vol:0.2,freq:3000,q:0.4});
    this.tone({f:1200,f2:300,type:'square',dur:0.16,vol:0.1});}
  gameover(){
    const seq=[330,262,220,165,110];
    seq.forEach((f,i)=>this.tone({f,f2:f*0.8,type:'sawtooth',dur:0.34,vol:0.16,delay:i*0.3}));
    this.noise({dur:1.2,vol:0.2,freq:200,q:0.5,delay:0.2});
  }
  victory(){
    const seq=[392,523,659,784,1046];
    seq.forEach((f,i)=>this.tone({f,type:'square',dur:0.22,vol:0.13,delay:i*0.16}));
    this.tone({f:1046,f2:2093,type:'sine',dur:0.8,vol:0.1,delay:0.85});
  }
}

export const sfx=new Sfx();
