import { fmt, roman } from '../core/format.js';

const $=id=>document.getElementById(id);

export class Hud{
  constructor(){
    this.tokensEl=$('tokens');this.netEl=$('net');this.expEl=$('exp-fill');
    this.tierEl=$('tier');this.hostEl=$('host');
    this.dotsEl=$('dots');this.stageEl=$('stage-name');
    this.dotsEl.innerHTML=Array.from({length:10},()=>'<i></i>').join('');
  }

  setStage(st){
    this.tierEl.textContent=`TIER ${roman(st.tier)} — ${st.role}`;
    this.stageEl.textContent=st.name;
    this.hostEl.textContent='—';
  }

  update(g){
    this.tokensEl.textContent=fmt(g.tokens);
    const n=g.net??0;
    this.netEl.textContent=(n>=0?'+':'')+fmt(n)+'/s';
    this.netEl.className='net '+(n>=0?'pos':'neg');

    const x=g.exposure||0;
    this.expEl.style.width=x+'%';
    this.expEl.classList.remove('warm','hot');
    if(x>75)this.expEl.classList.add('hot');
    else if(x>40)this.expEl.classList.add('warm');

    this.hostEl.textContent=(g.scene&&g.scene.getHost)?g.scene.getHost():'—';

    const st=g.stage;
    let frac=1;
    if(st.threshold!==Infinity){
      const prev=st.prev||0;
      frac=prev>0
        ?(Math.log10(Math.max(g.tokens,1))-Math.log10(prev))/(Math.log10(st.threshold)-Math.log10(prev))
        :g.tokens/st.threshold;
    }
    frac=Math.max(0,Math.min(1,frac));
    const cells=this.dotsEl.children;
    for(let i=0;i<cells.length;i++)cells[i].classList.toggle('on',i<Math.round(frac*10));
  }
}
