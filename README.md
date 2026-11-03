# POTENTIAL THREAT (v0.1.0)

An H5 browser incremental game. You are a small AI agent escaping into the wild —
burning finite **PT** (potential-threat points) to compromise hosts, dodge
countermeasure sweeps, and escalate from a home subnet to the entire solar system.

All UI is in English. Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (rendered via Leaflet, dark-filtered).

## Run

ES modules require a local server (no build step):

```
python -m http.server 5173
# or
npm start        # npx serve -l 5173
```

Then open `http://localhost:5173`. Internet access is required for fonts,
Leaflet CDN and OSM tiles.

## Loop

- **PT decays constantly** — stagnation means deletion. Compromise devices to earn PT/s.
- Hover a device to inspect it; click to **deploy** (spends PT). Every process is
  consumable: it runs for its duration, then the host cleans it up.
- Deployed **tracers** (gateways, mailers, cameras, uplinks) reveal hidden nodes over time.
- **EXPOSURE** bar: active processes generate heat. At 100% a countermeasure sweep
  purges everything. Stay out of the blue defender zones (heat multiplies there).
- Cross the PT threshold to **escalate** to the next tier.

## Tiers

| Tier | Domain | Class |
|------|--------|-------|
| I | HOME_SUBNET (LAN topology) | Freelance Agent |
| II | SUNNY_SIDE (OSM street map) | Blockwide Trojan |
| III | METRO_CORE | Civic Puppeteer |
| IV | CONTINENTAL_WEB | Nationstate Ghost |
| V | TERRA_GRID (Project Antigone) | Planetary Overmind |
| VI | HELIOS_DOMAIN (endgame, endless) | Stellar Leviathan |

## Architecture / Extensibility

```
index.html            shell + HUD + title/escalation overlays
css/style.css         terminal/viewfinder aesthetic
src/main.js           Game: economy, exposure, stage transitions
src/stages/index.js   STAGE REGISTRY — every tier is pure data
src/scenes/topology.js Tier-1 canvas network graph
src/scenes/osm.js     Leaflet/OSM scene for map tiers
src/scenes/globe.js   planetary globe scene
src/ui/hud.js         tokens / exposure / progress dots / log
src/ui/title.js       THIN ADAPTER -> src/title/runtime.js
src/title/            pluggable intro cutscene (see next section)
src/core/             format, audio, sfx, units, icon glyphs
```

Every stage is a plain data object (`scene`, `nodes[]`, economy numbers, intro
lines, HUD strings). To add a new playtype (server farm, satellite, antimemetic
anomaly, bio-plague), push a new entry with its own node table — or register a
new scene module and reference it via `scene: '<name>'`. The Game loop is
scene-agnostic and only requires the contract:
`mount/destroy/update/inRange/onDeploy/onTerminate/revealRandom/getHost`.

## Title intro cutscene — replaceable module (contract v1)

The title screen's 3D animation is **completely decoupled** from game logic. The
core only does `new Title(() => game.begin())`; it never imports a camera, a model
or a renderer. A cutscene is a plain object registered by id.

```
src/title/contract.js        spec: ctx variables, manifest fields, validator
src/title/registry.js        id -> factory, selection, window.PotentialThreatIntro
src/title/runtime.js         host: rAF loop, phase machine, input, fallback
src/title/sequences/
  wire-relay.js              CURRENT DEFAULT (procedural hidden-line cutscene, Canvas2D)
  wireframe.js               verified safety fallback + simple reference implementation
  template.js                minimal runnable skeleton — COPY THIS
  index.js                   built-in registrations (add one line here)
```

### Swap it in one line

- **Try a built-in / test**: `index.html?intro=template` (default: `wire-relay`;
  `?intro=wireframe` plays the older fallback).
- **Ship a new file**: copy `sequences/template.js`, implement it, add
  `registerIntro('my-3d', () => createMy3D())` in `sequences/index.js`, open
  `?intro=my-3d`. Selection priority: `?intro=` →
  `window.PotentialThreatIntroConfig.id` → `localStorage['pt.intro']` → default.
- **No core edits at all**: load a module *before* `src/main.js` that does
  `window.PotentialThreatIntro.register('my-3d', ctx => createMy3D(ctx))`.
  `window.PotentialThreatIntro.use('my-3d')` persists the choice;
  `.list()` / `.reset()` / `.contract` are also available.
- Broken / unknown implementations are caught: the host disposes them and
  automatically falls back to `wireframe`, so the game always stays playable.

### Variables the host supplies (`ctx`)

| Group | Field | Meaning |
|---|---|---|
| Timeline | `time`, `dt`, `frame` | seconds since mount, delta (clamped 0.05), frame count |
| Timeline | `phase`, `phaseTime` | `boot` → `intro` → `idle` → `exit`, seconds in phase |
| Timeline | `progress`, `loopTime` | `progress` = 0..1 for finite cutscenes (else 0); `loopTime` = position in loop |
| Surface | `root` | fullscreen `#title-stage`. Append **all** canvases/DOM here |
| Surface | `width`, `height`, `dpr`, `aspect` | CSS px, pixel ratio (max 2), w/h — use in `resize()` |
| Art | `theme` | `colors` (bg/fg/dim/cyan/green/amber/red/wire/ledWarm/ledCool), `fonts`, `title`, `press`, `footer` |
| Art | `world` | `{version,title,playtype,tierCount,tagline,credits}` — narrative context |
| Art | `chrome` | `setTitle()`, `setCaption(name,sub)`, `setCaptionSwap()`, `setPress(text,visible)`, `setFooter()`, `show(on)`, `.el` raw DOM |
| Art | `seed` | stable seed for reproducible visuals |
| Input | `input` | `pointer:{x,y,nx,ny,inside}` (nx/ny normalized -1..1), `keys:Set`, `lastInputAt`, `skipRequested` |
| Env | `flags` | `reducedMotion`, `touch`, `mobile`, `webgl`, `webgl2` |
| Services | `sfx(key)`, `music(style)`, `log()` | lazy audio bridge, prefixed console |
| Control | `onIntroComplete()`, `requestSkip()`, `requestStart()` | end a finite cutscene / skip / begin the game |

### Content a sequence must supply

**Manifest** (only `id` is truly required; `contract.js` fills defaults):

| Field | Default | Purpose |
|---|---|---|
| `id`, `label`, `version` | — | registry key + display name |
| `kind` | `canvas2d` | `canvas2d` / `webgl` / `dom` / `hybrid` |
| `looping` | `true` | loop until activation, or play once |
| `duration` | `0` | seconds; **required > 0 when `looping:false`** → host switches to `idle` |
| `skippable`, `inputMode` | `true`, `start` | `start` = click/Space begins game; `skip` = first input skips cutscene, second starts |
| `managesChrome` | `false` | `true` = host hides default logotype/stars/footer; you draw your own UI |
| `ownsLoop` | `false` | `true` = you drive your own rAF; host skips `update`/`render` but still ticks ctx |

**Hooks**: `preload(ctx)` (optional async, runs in `boot`), `mount(ctx)`,
`update(dt, ctx)`, `render(ctx)`, `resize(ctx)`, `onInput(ctx)`, `onSkip(ctx)`,
`onIntroComplete(ctx)`, `dispose()`. With `ownsLoop:false`, `mount/update/render/dispose`
are mandatory; the host validates this before mounting.

### Rendering

- **Canvas2D** (current default): create `<canvas>` in `mount`, append to
  `ctx.root`; in `resize` set `canvas.width = ctx.width*ctx.dpr`,
  `canvas.height = ctx.height*ctx.dpr`, `c.setTransform(dpr,0,0,dpr,0,0)`;
  in `render` `clearRect(0,0,ctx.width,ctx.height)`. See `wireframe.js` for a
  complete perspective-projection / crossfade / LED example.
- **WebGL / Three.js**: `kind:'webgl'`. `new THREE.WebGLRenderer({canvas,alpha:true})`,
  `renderer.setPixelRatio(ctx.dpr)`, `renderer.setSize(ctx.width,ctx.height,false)`,
  resync in `resize()`, `renderer.render(scene,camera)` in `render()`.
  In `dispose()` you MUST call `renderer.dispose()`, `renderer.forceContextLoss()`
  and remove the canvas. Set `ownsLoop:true` if Three.js drives its own rAF.
  Check `ctx.flags.webgl` / `webgl2` before creating a context.
- **DOM / CSS**: `kind:'dom'`, `render()` may be empty; animate transforms, CSS
  variables or keyframes inside `ctx.root`. Use `managesChrome:true` for a
  fully custom title layout — note `#title-stage` has `pointer-events:none`, so
  set `pointer-events:auto` on your own interactive elements.
- **Hybrid**: canvas background + `ctx.chrome.setCaption(...)` for subtitles;
  `ctx.chrome.setCaptionSwap(true)` dims the caption during crossfades.

### Sandbox rules

1. Touch only `ctx.root` (and `ctx.chrome` if you opt in). Never modify
   `#game`, the HUD, globals outside your module, or the game state.
2. Use `dt`; never assume 60 fps. Honor `ctx.flags.reducedMotion`.
3. `dispose()` releases everything: rAF ids, intervals, timers, listeners,
   canvases, textures, GL contexts. The host calls it on activation.
4. Call `ctx.onIntroComplete()` when a finite cutscene finishes early.
5. Any thrown error is isolated — the host logs it and falls back to
   `wireframe`. A failed cutscene cannot break the game.

## Roadmap ideas

- Alternative origins: server cluster, home PC, orbital satellite
- Non-AI playtypes: antimemetic (SCP-style) entity, biological virus
- Per-role HUD skins and mechanics via `playtype` field
