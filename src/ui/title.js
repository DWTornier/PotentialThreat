export class Title{
  constructor(onStart){
    this.el=document.getElementById('title');
    this.done=false;
    const go=()=>{
      if(this.done)return;
      this.done=true;
      this.el.classList.add('gone');
      setTimeout(()=>this.el.remove(),750);
      onStart();
    };
    this.el.addEventListener('click',go);
    this._key=e=>{
      if(e.code==='Space'){e.preventDefault();go();}
    };
    window.addEventListener('keydown',this._key);
  }
}
