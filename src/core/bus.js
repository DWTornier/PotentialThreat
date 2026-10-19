const listeners={};

export const bus={
  on(ev,fn){(listeners[ev]??=[]).push(fn);},
  off(ev,fn){const a=listeners[ev];if(a){const i=a.indexOf(fn);if(i>=0)a.splice(i,1);}},
  emit(ev,data){(listeners[ev]||[]).forEach(fn=>fn(data));}
};
