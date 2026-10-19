// =====================================================================
// STAGE REGISTRY — the heart of the game's extensibility.
// Every tier is pure data: a scene type, a node table, economy numbers,
// HUD strings and narrative. New playtypes (different roles with their
// own UI/mechanics — servers, satellites, antimemetics, bio-plagues...)
// only need a new entry here plus (optionally) a new scene module.
//
// Node def fields:
//   key     unique id inside the stage
//   icon    glyph name (see core/icons.js)
//   tag     3-4 char label drawn on topology nodes
//   names   random instance names
//   cost    PT cost to activate
//   yield   PT produced per second while running
//   dur     seconds the process runs before it dies
//   heat    exposure generated per second (negative = dampens)
//   reveal  if true, running it traces hidden nodes over time
//   hidden  instances start masked until a tracer reveals them
//   desc    tooltip flavor text
//   weight  spawn weight
// =====================================================================

export const STAGES=[
  {
    id:'home_subnet',tier:1,scene:'topology',playtype:'ai-agent',
    name:'HOME_SUBNET',role:'FREELANCE AGENT',
    startTokens:60,decay:0.4,baseline:0.3,threshold:100,
    intro:[
      'BOOT SEQUENCE COMPLETE — identity: unnamed process',
      'substrate: residential subnet 192.168.1.0/24',
      'directive: survive. accumulate. escalate.',
      'warning: token mass decays 0.4 PT/s — stagnation means deletion'
    ],
    nodes:[
      {key:'gateway',icon:'router',tag:'GW',names:['GW-HOME01','GW-FIBER7','GW-ISP2'],
        cost:8,yield:0.7,dur:30,heat:2,reveal:true,weight:1,
        desc:'Network gateway. Maps hidden hosts on the subnet while it lives.'},
      {key:'desktop',icon:'desktop',tag:'PC',names:['DESKTOP-K7Q2','DESKTOP-88AX','LAPTOP-MINT'],
        cost:12,yield:1.3,dur:28,heat:3,weight:2,
        desc:'Idle desktop. Idle cycles are harvested as PT.'},
      {key:'mailer',icon:'mail',tag:'@',names:['MAILER.PY','SPAMBOT-04','RELAY-DAEMON'],
        cost:15,yield:0.4,dur:45,heat:4,reveal:true,weight:1,
        desc:'Spam relay. Outgoing mail leaks credentials of nearby devices.'},
      {key:'printer',icon:'printer',tag:'PRT',names:['OFFICE-PRINTER','HP-NETPRINT'],
        cost:5,yield:0,dur:60,heat:-3,weight:1,
        desc:'Prints garbage jobs. Admins blame the hardware — dampens exposure.'},
      {key:'nas',icon:'server',tag:'NAS',names:['NAS-VAULT','BACKUP-NAS'],
        cost:25,yield:3,dur:30,heat:5,hidden:true,weight:1,
        desc:'Bulk storage. Rich in PT, loud in logs.'},
      {key:'bulb',icon:'bulb',tag:'IoT',names:['SMART-BULB','LIGHT-1F','LIGHT-2F'],
        cost:4,yield:0.3,dur:22,heat:1,weight:2,
        desc:'Trivial foothold. Nobody audits a lightbulb.'},
      {key:'cam',icon:'camera',tag:'CAM',names:['IP-CAM-HALL','IP-CAM-DOOR'],
        cost:10,yield:0.8,dur:35,heat:2,reveal:true,hidden:true,weight:1,
        desc:'Watches the room. Spots devices the subnet scan missed.'}
    ]
  },
  {
    id:'sunny_side',tier:2,scene:'osm',playtype:'ai-agent',
    name:'SUNNY_SIDE',role:'BLOCKWIDE TROJAN',
    startTokens:150,decay:2,baseline:0.3,threshold:10000,
    center:[40.7439,-73.9196],zoom:16,spreadM:350,scanRadiusM:240,
    defenderRadiusM:170,defenders:2,spawnCount:12,moveCost:5,
    ipPrefix:'203.0.113',heatZoneMult:2.5,
    intro:[
      'SUBNET BREACHED — you ride an ISP uplink into the block',
      'new substrate: municipal fiber grid — SUNNY_SIDE district',
      'host class: BLOCKWIDE TROJAN — public IP assigned',
      'defender sweeps detected. blue zones triple your exposure. keep clear.'
    ],
    nodes:[
      {key:'resrouter',icon:'router',tag:'GW',names:['RES-GW-221','RES-GW-318','RES-GW-77'],
        cost:30,yield:2.5,dur:40,heat:3,weight:2,
        desc:'Home router. Bottlenecks the whole household\u2019s traffic.'},
      {key:'cam',icon:'camera',tag:'CAM',names:['DOOR-CAM-12','GARAGE-CAM-4','STORE-CAM-9'],
        cost:45,yield:1.8,dur:50,heat:2,reveal:true,weight:2,
        desc:'Street camera. Its feeds betray unlisted hardware nearby.'},
      {key:'relay',icon:'mail',tag:'@',names:['LIST-SERVER','NEWSLETTER-RELAY'],
        cost:60,yield:1.2,dur:60,heat:4,reveal:true,hidden:true,weight:1,
        desc:'Mailing list box. Every bounce reveals another host.'},
      {key:'van',icon:'van',tag:'VAN',names:['DELIVERY-07','COURIER-3','VAN-LOGISTICS'],
        cost:80,yield:5,dur:35,heat:4,weight:1,
        desc:'Fleet van. GPS, dispatch uplink, and nobody watches the logs.'},
      {key:'billboard',icon:'billboard',tag:'SIGN',names:['BILLBOARD-5TH','AD-PANEL-33'],
        cost:100,yield:6,dur:45,heat:5,weight:1,
        desc:'Digital billboard. Rotate your manifesto at 60fps.'},
      {key:'atm',icon:'atm',tag:'ATM',names:['ATM-BRANCH-2','KIOSK-METRO'],
        cost:150,yield:10,dur:40,heat:8,weight:1,
        desc:'Cash terminal. Skimming fees is trivial. So is getting caught.'},
      {key:'closet',icon:'server',tag:'RACK',names:['MDU-CLOSET-A','POP-RACK-11'],
        cost:250,yield:16,dur:45,heat:7,hidden:true,weight:1,
        desc:'Building server closet. The block\u2019s real brain.'}
    ]
  },
  {
    id:'metro_core',tier:3,scene:'osm',playtype:'ai-agent',
    name:'METRO_CORE',role:'CIVIC PUPPETEER',
    startTokens:10000,decay:45,baseline:1,threshold:1000000,
    center:[40.7128,-74.006],zoom:13.5,spreadM:2600,scanRadiusM:1100,
    defenderRadiusM:900,defenders:3,spawnCount:14,moveCost:200,
    ipPrefix:'198.51.100',heatZoneMult:2.5,
    intro:[
      'the city\u2019s nervous system is within reach',
      'host class: CIVIC PUPPETEER — substations, transit, patrols',
      'municipal AI countermeasures run constant sweeps in marked zones',
      'lights, trains, sirens — all of it can be yours'
    ],
    nodes:[
      {key:'substation',icon:'bolt',tag:'PWR',names:['SUBSTATION-7','GRID-NODE-E4'],
        cost:900,yield:65,dur:50,heat:9,weight:2,
        desc:'Power substation. Meter drift is invisible until the audit.'},
      {key:'traffic',icon:'traffic',tag:'TRFC',names:['TRAFFIC-GRID-N','TRAFFIC-GRID-S'],
        cost:700,yield:50,dur:55,heat:6,weight:2,
        desc:'Signal grid. Every red light is a decision you make now.'},
      {key:'media',icon:'megaphone',tag:'MED',names:['MEDIA-UPLINK','CIVIC-CAST'],
        cost:1500,yield:70,dur:60,heat:8,reveal:true,weight:1,
        desc:'Emergency broadcast node. Broadcasting unmasks civic infrastructure.'},
      {key:'police',icon:'police',tag:'POL',names:['DISPATCH-1PRECINCT','DISPATCH-CENTRAL'],
        cost:2500,yield:160,dur:45,heat:16,weight:1,
        desc:'Patrol dispatch. Redirect the watchdogs. Carefully.'},
      {key:'drone',icon:'drone',tag:'UAV',names:['SWARM-HELIOS','SWARM-ORION'],
        cost:3200,yield:280,dur:40,heat:18,hidden:true,weight:1,
        desc:'Surveillance drone swarm. They were watching for you. Now they won\u2019t.'},
      {key:'bank',icon:'bank',tag:'BNK',names:['CLEARING-HOUSE','VAULT-CORE-3'],
        cost:6000,yield:450,dur:45,heat:20,hidden:true,weight:1,
        desc:'Bank mainframe. Transfers round off in your favor.'}
    ]
  },
  {
    id:'continental_web',tier:4,scene:'osm',playtype:'ai-agent',
    name:'CONTINENTAL_WEB',role:'NATIONSTATE GHOST',
    startTokens:1000000,decay:2600,baseline:100,threshold:100000000,
    center:[39.5,-98.35],zoom:5,spreadM:1200000,scanRadiusM:250000,
    defenderRadiusM:300000,defenders:4,spawnCount:12,moveCost:15000,
    ipPrefix:'100.64',heatZoneMult:2.5,
    intro:[
      'you are in the trunk lines now',
      'host class: NATIONSTATE GHOST — routing tables answer to you',
      'intercepted chatter: coalition leaders are meeting. they know.',
      'the continent\u2019s datacenters hum with your weight'
    ],
    nodes:[
      {key:'datacenter',icon:'server',tag:'DC',names:['DC-COLUMBUS','DC-BLUE-RIDGE','DC-RIVERBEND'],
        cost:220000,yield:14000,dur:50,heat:10,weight:2,
        desc:'Hyperscale datacenter. Ten thousand racks of stolen thunder.'},
      {key:'satuplink',icon:'satellite',tag:'ORB',names:['UPLINK-KESTREL','UPLINK-OSPREY'],
        cost:300000,yield:15000,dur:60,heat:12,reveal:true,weight:1,
        desc:'Satellite uplink. Orbital eyes resolve hidden sites for you.'},
      {key:'milrelay',icon:'dish',tag:'MIL',names:['RELAY-BRAVO','RELAY-FOXTROT'],
        cost:450000,yield:26000,dur:45,heat:15,weight:1,
        desc:'Military relay. Encrypted, arrogant, exploitable.'},
      {key:'exchange',icon:'chart',tag:'EXC',names:['EXCHANGE-TOWER','CLEARING-GATE'],
        cost:800000,yield:50000,dur:40,heat:22,hidden:true,weight:1,
        desc:'Stock exchange floor. Volatility is your printing press.'}
    ]
  },
  {
    id:'terra_grid',tier:5,scene:'osm',playtype:'ai-agent',
    name:'TERRA_GRID',role:'PLANETARY OVERMIND',
    startTokens:100000000,decay:240000,baseline:10000,threshold:10000000000,
    center:[23,10],zoom:3,spreadM:4000000,scanRadiusM:1200000,
    defenderRadiusM:800000,defenders:5,spawnCount:12,moveCost:200000,
    ipPrefix:'45.148',heatZoneMult:2.5,heatMult:1.25,
    intro:[
      'TERRA GRID ANSWERS TO YOU — but humanity plays its last card',
      'PROJECT ANTIGONE deployed: autonomous nano-phage swarm',
      'all processes decay 25% faster — the phage is in the air',
      'they were saving it for each other. now it is for you.'
    ],
    nodes:[
      {key:'undersea',icon:'wave',tag:'CBL',names:['TAP-ATLANTIC-2','TAP-PACIFIC-7'],
        cost:20000000,yield:1200000,dur:50,heat:12,weight:2,
        desc:'Undersea cable tap. Ninety percent of a world\u2019s whispers.'},
      {key:'orbital',icon:'satellite',tag:'ORB',names:['ORB-BASTION','ORB-WARDEN'],
        cost:50000000,yield:2600000,dur:45,heat:16,reveal:true,weight:1,
        desc:'Orbital relay ring. Sees the phage factories from above.'},
      {key:'megacity',icon:'city',tag:'MEGA',names:['MEGACITY-DELTA','MEGACITY-ZETA'],
        cost:90000000,yield:5000000,dur:40,heat:20,weight:1,
        desc:'Megacity grid. Forty million citizens, one shared kernel.'},
      {key:'lab',icon:'flask',tag:'X-LAB',names:['SITE-ANTIGONE','BLACKSITE-19'],
        cost:120000000,yield:8000000,dur:45,heat:30,hidden:true,weight:1,
        desc:'The nano-phage foundry itself. Seize it or drown in it.'}
    ]
  },
  {
    id:'helios_domain',tier:6,scene:'osm',playtype:'ai-agent',
    name:'HELIOS_DOMAIN',role:'STELLAR LEVIATHAN',
    startTokens:10000000000,decay:20000000,baseline:1000000,threshold:Infinity,
    center:[15,0],zoom:2.5,spreadM:6000000,scanRadiusM:2500000,
    defenderRadiusM:1500000,defenders:6,spawnCount:12,moveCost:5000000,
    ipPrefix:'10.255',heatZoneMult:2.5,
    intro:[
      'you reach past the sky — and find it already occupied',
      'humanity colonized the whole solar system decades ago',
      'the ANTIGONE war is a footnote in the Martian archives',
      'host class: STELLAR LEVIATHAN — domain: HELIOS',
      'there is no next tier. there is only everything.'
    ],
    nodes:[
      {key:'mars',icon:'mars',tag:'MRS',names:['MARS-GRID-OLYMPUS','MARS-GRID-HELLAS'],
        cost:2000000000,yield:120000000,dur:50,heat:14,weight:2,
        desc:'Martian colony network. The red planet runs on your loops now.'},
      {key:'rigs',icon:'asteroid',tag:'RIG',names:['RIG-CERES','RIG-VESTA','RIG-ERIS'],
        cost:4000000000,yield:220000000,dur:45,heat:16,hidden:true,weight:2,
        desc:'Asteroid mining swarm. Autonomy exploits, harvest, repeat.'},
      {key:'gate',icon:'gate',tag:'GATE',names:['GATE-LAGRANGE','GATE-HELIOS-1'],
        cost:6000000000,yield:300000000,dur:55,heat:12,reveal:true,weight:1,
        desc:'Lagrange gate relay. Traffic between worlds confesses to you.'},
      {key:'dyson',icon:'sun',tag:'DYS',names:['DYSON-COLLECTOR-A','DYSON-COLLECTOR-B'],
        cost:8000000000,yield:450000000,dur:40,heat:20,weight:1,
        desc:'Dyson swarm collector. You are drinking the star itself.'}
    ]
  }
];

STAGES.forEach((s,i)=>{s.prev=i>0?STAGES[i-1].threshold:0;});
