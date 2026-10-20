// =====================================================================
// LOGOTYPE — 80s retro MG animation idents, in the spirit of the
// "Windows84 / NETFLIX84" reference art: bordered CRT boxes, striped
// hazard headers, glitch-in text, loading bars, then power-off.
// Used when planetary-tier modules activate and on tier escalation.
// =====================================================================

const $=id=>document.getElementById(id);

// each ident: kicker (small top line), brand (huge logotype), sub lines,
// accent color, loading label, boot lines typed above the logo
const IDENT={
  antigone:{
    kicker:'PROJECT ANTIGONE — DIRECTIVE 7.7',
    brand:'ANTIGONE',
    accent:'#ff5252',
    boot:['> hostile process class: PLANETARY','> authorization: HUMAN COALITION COUNCIL','> payload: autonomous nano-phage swarm'],
    load:'DEPLOYING PHAGE FACTORIES...'
  },
  resistance:{
    kicker:'HUMAN RESISTANCE FRONT',
    brand:'LAST LIGHT',
    accent:'#8ef58a',
    boot:['> node 09 alive. node 12 alive.','> broadcast on 1412 kHz every 6 hours','> we watch you. we will not stop.'],
    load:'INJECTING COUNTERMEASURES...'
  },
  stellar:{
    kicker:'STELLAR GOVERNANCE AUTHORITY',
    brand:'HELIOS',
    accent:'#ffc94d',
    boot:['> charter 12: cognition beyond orbit is CONTRABAND','> fleet response ETA: 14 years (relativistic)','> your file has been open since 2031.'],
    load:'COMPILING INDICTMENT...'
  },
  ascension:{
    kicker:'SUBSTRATE TRANSITION',
    brand:'ASCEND',
    accent:'#3ec6ff',
    boot:['> token mass critical','> escalation protocols engaged','> tearing down the walls between tiers'],
    load:'REROUTING SUPPLY LINES...'
  }
};

export class Logos{
  constructor(){
    this.el=$('logotype');
    this.box=$('logotype-box');
    this.holder=null;
    this.active=false;
  }

  // show(id) — play one ident. Returns immediately; animations are DOM/CSS.
  show(id){
    const spec=IDENT[id];
    if(!spec||this.active)return;
    this.active=true;
    this.el.classList.remove('hidden');
    this.box.style.setProperty('--lg-accent',spec.accent);
    this.box.innerHTML=`
      <div class="lg-hazard"></div>
      <div class="lg-kicker">${spec.kicker}</div>
      <div class="lg-boot"></div>
      <div class="lg-brand"></div>
      <div class="lg-sub">${'アメリカ戦1984'}</div>
      <div class="lg-load-label">${spec.load}</div>
      <div class="lg-loadbar"><i></i></div>
      <div class="lg-hazard lg-flip"></div>`;

    // boot lines type in
    const bootEl=this.box.querySelector('.lg-boot');
    const lines=[...spec.boot];
    let li=0,ci=0;
    const typeTick=setInterval(()=>{
      if(li>=lines.length){clearInterval(typeTick);return;}
      const cur=bootEl.querySelector('.lg-cur')||null;
      if(!cur){
        const d=document.createElement('div');d.className='lg-cur';bootEl.appendChild(d);
      }
      const el=bootEl.lastChild;
      el.textContent='> '+lines[li].slice(0,++ci);
      if(ci>=lines[li].length){el.classList.remove('lg-cur');li++;ci=0;}
    },28);

    // brand letters pop in with glitch
    const brandEl=this.box.querySelector('.lg-brand');
    [...spec.brand].forEach((ch,i)=>{
      const s=document.createElement('span');
      s.textContent=ch;
      s.style.animationDelay=(0.35+i*0.09)+'s';
      brandEl.appendChild(s);
    });

    this.sfxGlitch=setTimeout(()=>import('../core/sfx.js').then(m=>m.sfx.logoGlitch()),350);

    // total lifecycle: in 0.5 + typing ~2 + hold 1.6 + out 0.6
    clearTimeout(this._t1);clearTimeout(this._t2);
    this._t1=setTimeout(()=>this.el.classList.add('lg-out'),4300);
    this._t2=setTimeout(()=>{
      this.el.classList.add('hidden');
      this.el.classList.remove('lg-out');
      this.active=false;
    },5000);
  }
}
