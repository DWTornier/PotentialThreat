import { sfx } from './sfx.js';
import { Music } from './music.js';

// =====================================================================
// AudioBus — plays whatever real audio you drop into /audio (see
// audio/README.md for the full catalogue), and transparently falls back
// to the synthesized patches in sfx.js / music.js for anything missing.
//   audio.play('deploy')          // sfx key
//   audio.bgm('techno'|'outsider')// background bed, crossfaded
// =====================================================================

class AudioBus{
  constructor(){
    this.buffers={};           // sfx key -> {buffer,gain}
    this.tracks={techno:[],outsider:[]}; // style -> [{buffer,gain}]
    this.ready=false;
    this.bgmStyle=null;
    this.bgmSrc=null;this.bgmGain=null;
    this.muted=false;
    this.musicGain=null;
    this.music=null;
    this.pending=null;
  }

  init(){
    sfx.init();
    this.ctx=sfx.ctx;
    if(!this.ctx)return;
    this.musicGain=this.ctx.createGain();
    this.musicGain.gain.value=0.9;
    this.musicGain.connect(this.ctx.destination);
    this.music=new Music(this.ctx,this.musicGain);
  }

  async load(){
    this.init();
    if(!this.ctx){this.ready=true;return;}
    let mf=null;
    try{
      const r=await fetch('audio/manifest.json',{cache:'no-store'});
      if(r.ok)mf=await r.json();
    }catch(e){/* no manifest: synth only */}
    if(!mf){this.ready=true;return;}
    const jobs=[];
    for(const [key,spec] of Object.entries(mf.sfx||{}))
      jobs.push(this.loadOne(spec).then(b=>{if(b)this.buffers[key]=b;}));
    for(const [style,list] of Object.entries(mf.bgm||{}))
      (list||[]).forEach(spec=>
        jobs.push(this.loadOne(spec).then(b=>{
          if(b)(this.tracks[style]=this.tracks[style]||[]).push(b);
        })));
    await Promise.all(jobs);
    this.ready=true;
    if(this.pending){const s=this.pending;this.pending=null;this.bgm(s);}
  }

  async loadOne(spec){
    if(!spec||!this.ctx)return null;
    const urls=[];
    if(spec.url)urls.push(spec.url);
    if(spec.file)urls.push('audio/'+spec.file);
    for(const u of urls){
      try{
        const r=await fetch(u,{cache:'no-store'});
        if(!r.ok)continue;
        const ab=await r.arrayBuffer();
        if(ab.byteLength<2048)continue; // placeholder / empty file
        const buffer=await this.ctx.decodeAudioData(ab);
        return {buffer,gain:spec.gain??1};
      }catch(e){/* next candidate */}
    }
    return null;
  }

  play(key,vol=1){
    if(this.muted)return;
    if(!this.ctx)this.init();
    const b=this.buffers[key];
    if(b&&this.ctx){
      const src=this.ctx.createBufferSource();
      const g=this.ctx.createGain();
      g.gain.value=vol*(b.gain??1);
      src.buffer=b.buffer;
      src.connect(g).connect(sfx.master||this.ctx.destination);
      src.start();
      return;
    }
    const fn=sfx[key];
    if(typeof fn==='function')fn.call(sfx);
  }

  setMuted(m){
    this.muted=m;
    sfx.setMuted(m);
    if(this.musicGain)this.musicGain.gain.value=m?0:0.9;
  }

  toggleMute(){this.setMuted(!this.muted);return this.muted;}

  // style: 'techno' (tier 1-4) | 'outsider' (tier 5+)
  bgm(style){
    if(!this.ctx)this.init();
    if(!this.ctx){this.pending=style;return;}
    if(!this.ready){this.pending=style;return;}
    if(this.bgmStyle===style)return;
    this.bgmStyle=style;
    this.fadeOutBgm();
    const list=(this.tracks[style]||[]);
    if(list.length){
      const track=list[Math.floor(Math.random()*list.length)];
      const src=this.ctx.createBufferSource();
      const g=this.ctx.createGain();
      src.buffer=track.buffer;src.loop=true;
      g.gain.value=0;
      src.connect(g).connect(this.musicGain||this.ctx.destination);
      src.start();
      g.gain.linearRampToValueAtTime(track.gain??0.6,this.ctx.currentTime+2);
      this.bgmSrc=src;this.bgmGain=g;
    }else{
      this.music.start(style);
    }
  }

  fadeOutBgm(){
    this.bgmStyle=null;
    if(this.bgmGain&&this.ctx){
      const g=this.bgmGain,s=this.bgmSrc;
      try{
        g.gain.cancelScheduledValues(this.ctx.currentTime);
        g.gain.setValueAtTime(g.gain.value,this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0,this.ctx.currentTime+1.6);
      }catch(e){}
      setTimeout(()=>{try{s.stop();}catch(e){}},1800);
      this.bgmSrc=null;this.bgmGain=null;
    }
    if(this.music&&this.music.style)this.music.stop();
  }
}

export const audio=new AudioBus();
