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
src/ui/hud.js         tokens / exposure / progress dots / log
src/core/             format, event bus, icon glyphs
```

Every stage is a plain data object (`scene`, `nodes[]`, economy numbers, intro
lines, HUD strings). To add a new playtype (server farm, satellite, antimemetic
anomaly, bio-plague), push a new entry with its own node table — or register a
new scene module and reference it via `scene: '<name>'`. The Game loop is
scene-agnostic and only requires the contract:
`mount/destroy/update/inRange/onDeploy/onTerminate/revealRandom/getHost`.

## Roadmap ideas

- Alternative origins: server cluster, home PC, orbital satellite
- Non-AI playtypes: antimemetic (SCP-style) entity, biological virus
- Per-role HUD skins and mechanics via `playtype` field
