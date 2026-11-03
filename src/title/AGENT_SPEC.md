# Title Cutscene Module — Implementation Spec

> **Audience:** an automation agent implementing one replaceable fullscreen
> intro animation. This document is intentionally self-contained and neutral:
> it describes ONLY the animation module. It contains no product name, setting,
> characters, rules, or themed assets.
>
> Treat every string and metadata value supplied by the host as **opaque**.
> Do not inspect, quote, or infer the meaning of anything outside this spec.

---

## 1. Scope & deliverable

You are building **one self-contained visual module**: a fullscreen animation
shown on a title screen until the viewer activates the screen (click / Space).

Deliverables:

1. One ES module file: `src/title/sequences/<your-id>.js`, exporting a factory
   function that returns a plain object ("the sequence").
2. One registration line in `src/title/sequences/index.js`:

   ```js
   import { registerIntro } from '../registry.js';
   import { createYourSequence } from './<your-id>.js';
   registerIntro('<your-id>', () => createYourSequence());
   ```

**No other file may be modified.** The only permitted import is
`registerIntro` from `src/title/registry.js`, used in the registration line
above. Do not import or depend on anything else in the repository. The host
validates your object before mounting it and will discard it if it throws.

---

## 2. Execution model

The host owns a single `requestAnimationFrame` loop and calls your hooks. You
never start a global loop by default.

```
BOOT  (optional async preload)
  -> mount(ctx)          create renderer / geometry / DOM
  -> resize(ctx)         called once right after mount, and on window resize
INTRO (update(dt,ctx) + render(ctx) every frame)
  -> looping=true  : stays here until activation
  -> looping=false : progress reaches 1.0 at `duration`, host switches to IDLE
IDLE  (still update + render; a prompt becomes visible)
EXIT  (activation) host cancels its loop, calls dispose(), fades out, proceeds
```

Timing is supplied to you; do not call `performance.now()` for your timeline
unless you set `ownsLoop:true`.

---

## 3. `ctx` — variables provided by the host (read-only)

### Timeline
| Field | Type | Meaning |
|---|---|---|
| `contract` | number | spec version, currently `1` |
| `time` | number | seconds since `mount`, monotonic |
| `dt` | number | frame delta in seconds, clamped to `0.05` |
| `frame` | number | frame counter since `mount` |
| `phase` | string | `boot` \| `intro` \| `idle` \| `exit` |
| `phaseTime` | number | seconds elapsed in current phase |
| `progress` | number | `0..1` for finite (`looping:false`) sequences; `0` otherwise |
| `loopTime` | number | seconds inside the current loop cycle |

### Render surface
| Field | Type | Meaning |
|---|---|---|
| `root` | HTMLElement | fullscreen, absolutely-positioned layer. Append **all** canvases/DOM here. It has `pointer-events:none`. |
| `width`, `height` | number | CSS pixels of `root` |
| `dpr` | number | device pixel ratio, clamped to `2` |
| `aspect` | number | `width / height` |

### Visual resources (opaque values — never hardcode equivalents)
| Field | Meaning |
|---|---|
| `theme.colors` | palette object; keys include `bg`, `fg`, `dim`, `cyan`, `green`, `amber`, `red`, `wire`, `ledWarm`, `ledCool`. Read them, do not duplicate literals. |
| `theme.fonts` | `display`, `mono` CSS font stacks |
| `theme.title`, `theme.press`, `theme.footer` | host-provided display strings; use through `ctx.chrome.*` only |
| `world` | opaque host metadata. Do not rely on its contents. |
| `seed` | number, stable random seed for reproducible visuals |
| `chrome` | see §4 |

### Input & environment
| Field | Meaning |
|---|---|
| `input.pointer` | `{x, y, nx, ny, inside}` — pixel coords and normalized `-1..1` coords |
| `input.keys` | `Set` of currently pressed `KeyboardEvent.code` values |
| `input.lastInputAt` | `ctx.time` of last activation input, or `-1` |
| `input.skipRequested` | boolean |
| `flags.reducedMotion` | `prefers-reduced-motion: reduce` |
| `flags.touch`, `flags.mobile` | input / viewport hints |
| `flags.webgl`, `flags.webgl2` | context availability; check before creating a GL renderer |

### Services & control
| Function | Meaning |
|---|---|
| `sfx(key)` | fire a named audio cue (optional; keys are opaque) |
| `music(style)` | switch an audio bed (optional) |
| `log(...args)` | console output with a module prefix |
| `onIntroComplete()` | end a finite sequence early |
| `requestSkip()` | skip to `idle` |
| `requestStart()` | signal the host to proceed to the next screen |

---

## 4. `ctx.chrome` — optional default overlay API

The host renders a default text overlay above your layer. You may drive it
without touching the DOM, or hide it entirely.

| Method | Effect |
|---|---|
| `setTitle(text)` | replace the large heading |
| `setCaption(name, sub)` | set two subtitle lines |
| `setCaptionSwap(bool)` | dim the subtitles (use during crossfades) |
| `setPress(text, visible=true)` | set / show-hide the prompt line |
| `setFooter(text)` | set the bottom line |
| `show(bool)` | show or hide the entire default overlay |
| `el` | raw DOM references; treat as read-only |

Rules: never hard-code product-specific strings. If you need text, either read
it from `ctx.theme` or pass a neutral label of your own. Setting
`managesChrome:true` hides the default overlay automatically; your own
interactive elements then need `pointer-events:auto` explicitly.

---

## 5. Sequence manifest — fields your object declares

`id` is the only mandatory field; the host fills the rest with defaults.

| Field | Default | Notes |
|---|---|---|
| `id` | — | non-empty string, must match the registered id |
| `label`, `version` | generic | descriptive only |
| `kind` | `canvas2d` | `canvas2d` \| `webgl` \| `dom` \| `hybrid` |
| `looping` | `true` | loop until activation, or play once |
| `duration` | `0` | seconds; **must be `> 0` when `looping:false`** |
| `skippable` | `true` | whether activation may skip playback |
| `inputMode` | `start` | `start` = activation proceeds immediately; `skip` = first activation skips the cutscene, second proceeds |
| `managesChrome` | `false` | hide the default text overlay |
| `ownsLoop` | `false` | you drive your own rAF; host skips `update`/`render` but still ticks `ctx` |
| `honorsReducedMotion` | — | not enforced by host; you decide how to use `flags.reducedMotion` |

---

## 6. Required hooks

| Hook | Required | Called when |
|---|---|---|
| `preload(ctx)` | optional, may be async | during `boot`, before `mount` |
| `mount(ctx)` | **yes** | once, before the first frame |
| `update(dt, ctx)` | **yes** unless `ownsLoop` | every frame; advance timeline, camera, physics |
| `render(ctx)` | **yes** unless `ownsLoop` | every frame; draw exactly one frame |
| `resize(ctx)` | recommended | after `mount`, and on window resize |
| `onInput(ctx)` | optional | click / Space occurred |
| `onSkip(ctx)` | optional | sequence skipped |
| `onIntroComplete(ctx)` | optional | finite sequence reached its end |
| `dispose()` | **yes** | once, on activation |

All hooks are called as methods of your object (`this` = the sequence). Errors
thrown from any hook are caught by the host; it disposes your module and loads
its built-in default instead.

---

## 7. Rendering modes

### Canvas2D (`kind:'canvas2d'`)
```js
mount(ctx){
  this.canvas=document.createElement('canvas');
  this.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%';
  ctx.root.appendChild(this.canvas);
  this.c=this.canvas.getContext('2d');
},
resize(ctx){
  this.canvas.width =Math.max(1,ctx.width*ctx.dpr);
  this.canvas.height=Math.max(1,ctx.height*ctx.dpr);
  this.c.setTransform(ctx.dpr,0,0,ctx.dpr,0,0);
},
render(ctx){
  const c=this.c;
  c.clearRect(0,0,ctx.width,ctx.height);
  // draw here, using ctx.width/height, ctx.time, ctx.theme.colors
}
```
Use `ctx.dpr` for the backing store but `ctx.width/height` for all layout math.
`clearRect` uses CSS pixel units after `setTransform`.

### WebGL / Three.js (`kind:'webgl'`)
- Check `ctx.flags.webgl` / `flags.webgl2` first.
- `new THREE.WebGLRenderer({canvas, alpha:true})`,
  `renderer.setPixelRatio(ctx.dpr)`,
  `renderer.setSize(ctx.width, ctx.height, false)`; repeat in `resize()`.
- `render()` draws one frame: `renderer.render(scene, camera)`.
- `dispose()` **must** call `renderer.dispose()`,
  `renderer.forceContextLoss()`, remove the canvas, and dispose geometries,
  materials and textures.
- Set `ownsLoop:true` if the library drives its own rAF; then cancel that rAF
  in `dispose()`. With `ownsLoop:true`, read timing from `ctx.time` rather than
  accumulating your own `dt`.

### DOM / CSS (`kind:'dom'`)
Append elements to `ctx.root`, animate with transforms / CSS variables /
keyframes. `render()` may be empty. Give your elements `pointer-events:auto`
if they need interaction. Remove every node in `dispose()`.

### Hybrid
Canvas background + `ctx.chrome.setCaption()` for timed subtitles;
`ctx.chrome.setCaptionSwap(true)` during transitions.

---

## 8. Minimal skeleton (copy this file)

```js
export function createYourSequence(){
  let canvas=null,c=null,w=0,h=0,t=0;

  const resize=ctx=>{
    if(!canvas)return;
    w=ctx.width;h=ctx.height;
    canvas.width=Math.max(1,w*ctx.dpr);
    canvas.height=Math.max(1,h*ctx.dpr);
    c.setTransform(ctx.dpr,0,0,ctx.dpr,0,0);
  };

  return {
    id:'your-id',
    label:'CUSTOM CUTSCENE',
    kind:'canvas2d',
    looping:true,
    duration:0,

    mount(ctx){
      canvas=document.createElement('canvas');
      canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%';
      ctx.root.appendChild(canvas);
      c=canvas.getContext('2d');
      resize(ctx);
    },

    resize,

    update(dt){t+=dt;},

    render(ctx){
      if(!c)return;
      c.clearRect(0,0,w,h);
      const r=Math.min(w,h)*0.2*(1+0.05*Math.sin(t));
      c.strokeStyle=ctx.theme.colors.cyan;
      c.lineWidth=1.5;
      c.beginPath();c.arc(w/2,h*0.42,r,t,t+Math.PI*1.5);c.stroke();
    },

    dispose(){
      if(canvas)canvas.remove();
      canvas=null;c=null;
    }
  };
}
```

For a **one-shot** sequence instead: `looping:false, duration:12,
inputMode:'skip'`, and use `ctx.progress` for timeline easing. Call
`ctx.onIntroComplete()` if the visual ends before `duration`.

---

## 9. Hard constraints

1. **Sandbox:** touch only `ctx.root` (and `ctx.chrome` when using it). Never
   modify any other element, global variable, or host state.
2. **Frame-rate independence:** advance all motion with `dt`. No assumptions
   about 60 fps, no `setInterval` driving visuals.
3. **Accessibility:** when `flags.reducedMotion` is true, render a static frame
   or a very slow, non-flashing motion; avoid strobing.
4. **Cleanup:** `dispose()` releases everything — rAF ids, timers, listeners,
   canvases, DOM nodes, textures, GL contexts. No residual loop after exit.
5. **No literals from the product:** do not hardcode display strings, names,
   or assets. All such values come from `ctx.theme` / `ctx.chrome`.
6. **No external network calls** for models, textures or fonts. Everything must
   be procedural or already available locally.
7. Keep the module under one file; do not add build steps, dependencies, or
   global CSS.

---

## 10. Acceptance checklist

- [ ] `index.html?intro=<your-id>` loads the module; no console errors.
- [ ] The animation fills the viewport and stays correct after a window resize
      (including a high-DPR viewport).
- [ ] `ctx.theme.colors` are used instead of duplicated color literals.
- [ ] Motion is smooth and derived from `dt` / `ctx.time`.
- [ ] Click or Space proceeds to the next screen; afterward no canvas, DOM
      node, listener or loop from your module remains.
- [ ] With reduced motion enabled, the output is calm.
- [ ] An unknown id or a throwing module leaves the host usable (built-in
      fallback) — verify your module does not suppress this behavior.
- [ ] Only the two files listed in §1 were added or changed.
