// =====================================================================
// Music — procedural BGM generator (no assets, no network).
//   style "techno"   : Berlin-style 4/4 for the pre-planetary tiers
//   style "outsider" : swung, dubbed-out outsider house for planet+
// Both are seeded per-bar so they never loop identically. If real tracks
// are dropped into audio/bgm/, audio.js prefers those instead.
// =====================================================================

const A=55; // A1
const note=n=>A*Math.pow(2,n/12);
const MIN=[0,3,5,7,10]; // minor pentatonic degrees (relative to root)

export class Music{
  constructor(ctx,dest){
    this.ctx=ctx;this.dest=dest;
    this.style=null;this.timer=null;
    this.step=0;this.nextTime=0;this.bar=0;
    this.noise=this.noiseBuf();
  }

  noiseBuf(){
    const n=Math.floor(this.ctx.sampleRate*1.2);
    const b=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d=b.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
    return b;
  }

  start(style){
    if(this.style===style)return;
    this.stop();
    this.style=style;
    this.step=0;this.bar=0;
    this.bpm=style==='techno'?130:116;
    this.nextTime=this.ctx.currentTime+0.08;
    this.hiss=this.ctx.createBufferSource();
    this.hiss.buffer=this.noise;this.hiss.loop=true;
    this.hissGain=this.ctx.createGain();
    this.hissGain.gain.value=style==='techno'?0.012:0.03;
    this.hissFilter=this.ctx.createBiquadFilter();
    this.hissFilter.type=style==='techno'?'highpass':'lowpass';
    this.hissFilter.frequency.value=style==='techno'?6000:3200;
    this.hiss.connect(this.hissFilter).connect(this.hissGain).connect(this.dest);
    this.hiss.start();
    this.timer=setInterval(()=>this.tick(),25);
  }

  stop(){
    if(this.timer){clearInterval(this.timer);this.timer=null;}
    if(this.hiss){try{this.hiss.stop();}catch(e){}}
    this.hiss=null;this.style=null;
  }

  tick(){
    const spb=60/this.bpm/4; // one 16th
    while(this.nextTime<this.ctx.currentTime+0.18){
      this.schedule(this.step,this.nextTime);
      this.nextTime+=spb;
      this.step=(this.step+1)%16;
      if(this.step===0)this.bar++;
    }
  }

  schedule(s,t){
    const sw=this.style==='outsider'?0.018:0; // swing the offbeats
    const tt=s%2===1?t+sw:t;
    if(this.style==='techno')this.techno(s,t,tt);
    else this.outsider(s,t,tt);
  }

  // ---- instruments -----------------------------------------------------
  kick(t,g=1){
    const o=this.ctx.createOscillator(),gn=this.ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(160,t);
    o.frequency.exponentialRampToValueAtTime(44,t+0.13);
    gn.gain.setValueAtTime(0.9*g,t);
    gn.gain.exponentialRampToValueAtTime(0.001,t+0.3);
    o.connect(gn).connect(this.dest);o.start(t);o.stop(t+0.32);
  }
  hat(t,g=1,open=false){
    const s=this.ctx.createBufferSource();s.buffer=this.noise;
    const f=this.ctx.createBiquadFilter();f.type='highpass';f.frequency.value=7600;
    const gn=this.ctx.createGain();
    const d=open?0.16:0.035;
    gn.gain.setValueAtTime(0.16*g,t);
    gn.gain.exponentialRampToValueAtTime(0.0005,t+d);
    s.connect(f).connect(gn).connect(this.dest);
    s.start(t);s.stop(t+d+0.05);
  }
  clap(t,g=1){
    for(let i=0;i<3;i++){
      const s=this.ctx.createBufferSource();s.buffer=this.noise;
      const f=this.ctx.createBiquadFilter();f.type='bandpass';
      f.frequency.value=1600;f.Q.value=1.2;
      const gn=this.ctx.createGain();
      const tt=t+i*0.011;
      gn.gain.setValueAtTime(0.2*g,tt);
      gn.gain.exponentialRampToValueAtTime(0.001,tt+0.08);
      s.connect(f).connect(gn).connect(this.dest);s.start(tt);s.stop(tt+0.1);
    }
  }
  bass(t,freq,dur,g=1,cut=420){
    const o=this.ctx.createOscillator(),o2=this.ctx.createOscillator();
    const fl=this.ctx.createBiquadFilter(),gn=this.ctx.createGain();
    o.type='sawtooth';o.frequency.value=freq;
    o2.type='square';o2.frequency.value=freq/2;o2.detune.value=6;
    fl.type='lowpass';
    fl.frequency.setValueAtTime(cut,t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(120,cut*0.45),t+dur);
    fl.Q.value=6;
    gn.gain.setValueAtTime(0,g);
    gn.gain.linearRampToValueAtTime(0.34*g,t+0.012);
    gn.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(fl);o2.connect(fl);fl.connect(gn).connect(this.dest);
    o.start(t);o.stop(t+dur+0.05);o2.start(t);o2.stop(t+dur+0.05);
  }
  stab(t,freqs,dur,g=1,cut=1500){
    for(const f of freqs){
      const o=this.ctx.createOscillator(),fl=this.ctx.createBiquadFilter(),gn=this.ctx.createGain();
      o.type='sawtooth';o.frequency.value=f;o.detune.value=(Math.random()-0.5)*14;
      fl.type='lowpass';fl.frequency.setValueAtTime(cut,t);
      fl.frequency.exponentialRampToValueAtTime(300,t+dur);
      gn.gain.setValueAtTime(0,t);
      gn.gain.linearRampToValueAtTime(0.09*g,t+0.015);
      gn.gain.exponentialRampToValueAtTime(0.001,t+dur);
      o.connect(fl).connect(gn).connect(this.dest);
      o.start(t);o.stop(t+dur+0.05);
    }
  }
  pad(t,freq,dur,g=1){
    const o=this.ctx.createOscillator(),fl=this.ctx.createBiquadFilter(),gn=this.ctx.createGain();
    o.type='triangle';o.frequency.value=freq;
    fl.type='lowpass';fl.frequency.value=900;
    gn.gain.setValueAtTime(0,t);
    gn.gain.linearRampToValueAtTime(0.06*g,t+dur*0.35);
    gn.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    o.connect(fl).connect(gn).connect(this.dest);
    o.start(t);o.stop(t+dur+0.05);
  }

  // ---- patterns --------------------------------------------------------
  techno(s,t,tt){
    // 4-on-the-floor
    if([0,4,8,12].includes(s))this.kick(t,1);
    if(s===14&&this.bar%4===3)this.kick(t,0.7);
    // offbeat hats + 16ths
    if([2,6,10,14].includes(s))this.hat(tt,1);
    if(s%2===1&&Math.random()<0.45)this.hat(tt,0.45);
    if(s===7||s===15)this.hat(tt,0.7,true);
    if(s===4||s===12)this.clap(t,0.8);
    // rolling offbeat bass
    const root=note(this.bar%8===6?3:0); // occasional lift
    const seq=[0,null,0,null,3,null,0,0,null,5,null,3,null,7,null,3];
    const d=seq[s];
    if(d!==null)this.bass(t,root*Math.pow(2,d/12),0.16,1,s%4===0?520:380);
    // stab every 4th bar
    if(this.bar%4===2&&(s===6||s===10)){
      const r=note(12+[0,3,7][this.bar%3]);
      this.stab(t,[r,r*1.189,r*1.498],0.22,1,2200);
    }
    // sparse high blip
    if(s===9&&Math.random()<0.3)this.pad(t,note(24+MIN[this.bar%5]),0.5,0.5);
  }

  outsider(s,t,tt){
    const spb=60/this.bpm/4;
    if(s===0||s===8)this.kick(t,1);
    if(s===10&&this.bar%2===1)this.kick(t,0.6);
    // swung, lazy hats
    if(s%2===0)this.hat(tt,0.5+Math.random()*0.4,s===6);
    if(s===11&&Math.random()<0.6)this.hat(tt,0.35,true);
    if(s===4)this.clap(t,0.35);
    // dubby sub bass, long notes
    if([0,6].includes(s)){
      const root=note(this.bar%4===3?-2:0)/2;
      this.bass(t,root,spb*6,1.1,260);
    }
    // detuned chord stabs on the "and"
    if((s===3||s===11)&&this.bar%2===0){
      const r=note(12+[0,5,7,3][this.bar%4]);
      this.stab(t,[r*0.999,r*1.19,r*1.5],1.1,1.1,900);
    }
    // wandering outsider melody: sparse, detuned, long tail
    if((s===7||s===14)&&Math.random()<0.5){
      this.pad(t,note(24+MIN[Math.floor(Math.random()*5)]),spb*4,0.9);
    }
  }
}
