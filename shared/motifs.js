// 8-bit Pixel Retro Arcade Theme Motifs for all 9 games

export function motif(kind, color) {
  if (kind === "nuke") {
    // GROUND ZERO — 8-bit Cold War Radar & Tactical Nuclear Blast
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#020803"/>
      <!-- Phosphor Green Radar Grid -->
      <path d="M0 24h240M0 48h240M0 72h240M0 96h240" stroke="#00ff66" stroke-width="1" stroke-opacity="0.12"/>
      <path d="M24 0v120M48 0v120M72 0v120M96 0v120M120 0v120M144 0v120M168 0v120M192 0v120M216 0v120" stroke="#00ff66" stroke-width="1" stroke-opacity="0.12"/>
      <!-- Stepped Radar Range Rings -->
      <rect x="94" y="34" width="52" height="52" fill="none" stroke="#00ff66" stroke-width="1" stroke-opacity="0.25"/>
      <rect x="74" y="14" width="92" height="92" fill="none" stroke="#00ff66" stroke-width="1" stroke-opacity="0.2"/>
      <line x1="120" y1="4" x2="120" y2="116" stroke="#00ff66" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="2 2"/>
      <line x1="4" y1="60" x2="236" y2="60" stroke="#00ff66" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="2 2"/>
      <!-- Stepped Pixel City Skyline -->
      <rect x="12" y="86" width="10" height="24" fill="#041808"/>
      <rect x="24" y="80" width="14" height="30" fill="#05200b"/>
      <rect x="28" y="84" width="2" height="2" fill="#ffff55"/>
      <rect x="32" y="88" width="2" height="2" fill="#ffff55"/>
      <rect x="40" y="88" width="12" height="22" fill="#041808"/>
      <rect x="54" y="76" width="16" height="34" fill="#06260d"/>
      <rect x="58" y="80" width="2" height="2" fill="#ffff55"/>
      <rect x="62" y="86" width="2" height="2" fill="#ffff55"/>
      <rect x="174" y="82" width="14" height="28" fill="#041808"/>
      <rect x="190" y="74" width="18" height="36" fill="#06260d"/>
      <rect x="194" y="80" width="2" height="2" fill="#ffff55"/>
      <rect x="200" y="86" width="2" height="2" fill="#ffff55"/>
      <rect x="210" y="84" width="18" height="26" fill="#041808"/>
      <!-- Ground Shockwave Bed -->
      <rect x="0" y="100" width="240" height="20" fill="#031206"/>
      <line x1="0" y1="100" x2="240" y2="100" stroke="${color}" stroke-width="2"/>
      <!-- 8-Bit Pixel Mushroom Cloud Plume -->
      <!-- Rising Stem -->
      <rect x="116" y="52" width="8" height="42" fill="#ff5500"/>
      <rect x="114" y="58" width="12" height="32" fill="#ff7700"/>
      <rect x="117" y="62" width="6" height="26" fill="#ffff44"/>
      <rect x="118" y="68" width="4" height="16" fill="#ffffff"/>
      <!-- Base Fireball Surge -->
      <rect x="100" y="90" width="40" height="10" fill="#ff3b30"/>
      <rect x="106" y="88" width="28" height="8" fill="#ff7700"/>
      <rect x="112" y="86" width="16" height="6" fill="#ffff55"/>
      <rect x="116" y="86" width="8" height="4" fill="#ffffff"/>
      <!-- Expanding Mushroom Cap (Stepped Pixel Rows) -->
      <rect x="112" y="22" width="16" height="4" fill="#ff9900"/>
      <rect x="104" y="26" width="32" height="4" fill="#ff7700"/>
      <rect x="96" y="30" width="48" height="6" fill="#ff5500"/>
      <rect x="90" y="36" width="60" height="6" fill="#ff3b30"/>
      <rect x="86" y="42" width="68" height="6" fill="#d42020"/>
      <rect x="92" y="48" width="56" height="4" fill="#991515"/>
      <rect x="102" y="52" width="36" height="4" fill="#660e0e"/>
      <!-- Mushroom Cap Core (Intense Heat Highlight) -->
      <rect x="110" y="28" width="20" height="4" fill="#ffff66"/>
      <rect x="106" y="32" width="28" height="6" fill="#ffff88"/>
      <rect x="112" y="34" width="16" height="4" fill="#ffffff"/>
      <rect x="104" y="38" width="32" height="6" fill="#ffaa00"/>
      <!-- Flying Pixel Fire Sparks -->
      <rect x="80" y="36" width="3" height="3" fill="#ffff55"/>
      <rect x="74" y="44" width="2" height="2" fill="#ff7700"/>
      <rect x="158" y="38" width="3" height="3" fill="#ffff55"/>
      <rect x="164" y="46" width="2" height="2" fill="#ff7700"/>
      <!-- Tactical Target Reticle on Hypocenter -->
      <rect x="108" y="78" width="24" height="24" fill="none" stroke="${color}" stroke-width="1"/>
      <rect x="106" y="76" width="4" height="4" fill="${color}"/>
      <rect x="130" y="76" width="4" height="4" fill="${color}"/>
      <rect x="106" y="100" width="4" height="4" fill="${color}"/>
      <rect x="130" y="100" width="4" height="4" fill="${color}"/>
      <!-- 8-Bit Pixel Radiation Trefoil (Upper Right) -->
      <rect x="202" y="14" width="22" height="22" fill="#031506" stroke="${color}" stroke-width="1"/>
      <rect x="211" y="23" width="4" height="4" fill="${color}"/>
      <rect x="210" y="16" width="6" height="4" fill="${color}"/>
      <rect x="204" y="26" width="6" height="4" fill="${color}"/>
      <rect x="216" y="26" width="6" height="4" fill="${color}"/>
      <!-- Pixel CRT Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Pixel Typography Readouts -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">DEFCON 1 // GROUND ZERO</text>
      <text x="14" y="112" fill="${color}" font-family="'Press Start 2P', monospace" font-size="5.5">YIELD: 1.2MT  PSI-20: 3.4KM</text>
      <text x="226" y="112" text-anchor="end" fill="#ff3b30" font-family="'Press Start 2P', monospace" font-size="5.5">DETONATION</text>
    </svg>`;
  }

  if (kind === "scale") {
    // SCALE JUMP — 8-bit Cosmic Journey (Atom -> Human -> Galaxy)
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#02030d"/>
      <!-- Pixel Starfield -->
      <rect x="14" y="20" width="2" height="2" fill="#ffffff"/>
      <rect x="38" y="12" width="1" height="1" fill="#00f0ff"/>
      <rect x="70" y="24" width="2" height="2" fill="#ffffff" opacity="0.7"/>
      <rect x="94" y="14" width="2" height="2" fill="#ffd700"/>
      <rect x="142" y="18" width="1" height="1" fill="#00f0ff"/>
      <rect x="174" y="10" width="2" height="2" fill="#ffffff"/>
      <rect x="224" y="22" width="2" height="2" fill="#ff007f"/>
      <rect x="232" y="14" width="1" height="1" fill="#ffffff"/>
      <!-- LEFT: 8-BIT ATOM (10^-15 m) -->
      <g transform="translate(42, 48)">
        <!-- Stepped Orbit Rings -->
        <rect x="-24" y="-10" width="48" height="20" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="2 2" opacity="0.6"/>
        <rect x="-16" y="-18" width="32" height="36" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
        <!-- Orbiting Electron Pixels -->
        <rect x="-25" y="-1" width="3" height="3" fill="#ffffff"/>
        <rect x="22" y="-1" width="3" height="3" fill="#ffffff"/>
        <rect x="-1" y="-19" width="3" height="3" fill="#00f0ff"/>
        <!-- Nucleus (Protons & Neutrons) -->
        <rect x="-6" y="-6" width="6" height="6" fill="#ff3b30"/>
        <rect x="0" y="-6" width="6" height="6" fill="#0088ff"/>
        <rect x="-6" y="0" width="6" height="6" fill="#00f0ff"/>
        <rect x="0" y="0" width="6" height="6" fill="#ff3b30"/>
        <rect x="-2" y="-2" width="4" height="4" fill="#ffffff"/>
      </g>
      <text x="42" y="74" text-anchor="middle" fill="${color}" font-family="'Press Start 2P', monospace" font-size="5.5">10⁻¹⁵m ATOM</text>
      <!-- CENTER: 8-BIT ARCADE HUMAN HERO (10^0 m) -->
      <g transform="translate(120, 48)">
        <!-- Astronaut Helmet & Visor -->
        <rect x="-6" y="-22" width="12" height="10" fill="#ffffff"/>
        <rect x="-5" y="-20" width="10" height="5" fill="#00f0ff"/>
        <rect x="-3" y="-19" width="4" height="2" fill="#ffffff"/>
        <!-- Torso & Life Support Pack -->
        <rect x="-7" y="-12" width="14" height="12" fill="#d4e0ee"/>
        <rect x="-4" y="-10" width="8" height="8" fill="#ffffff"/>
        <rect x="-2" y="-8" width="4" height="4" fill="#ffd700"/>
        <!-- Arms -->
        <rect x="-10" y="-12" width="3" height="10" fill="#ffffff"/>
        <rect x="7" y="-12" width="3" height="10" fill="#ffffff"/>
        <!-- Belt -->
        <rect x="-6" y="0" width="12" height="3" fill="#3a4b66"/>
        <rect x="-2" y="0" width="4" height="3" fill="#ffd700"/>
        <!-- Legs & Boots -->
        <rect x="-6" y="3" width="5" height="11" fill="#d4e0ee"/>
        <rect x="1" y="3" width="5" height="11" fill="#d4e0ee"/>
        <rect x="-8" y="12" width="7" height="4" fill="#202a3a"/>
        <rect x="1" y="12" width="7" height="4" fill="#202a3a"/>
      </g>
      <text x="120" y="74" text-anchor="middle" fill="#ffd700" font-family="'Press Start 2P', monospace" font-size="5.5">10⁰m HUMAN</text>
      <!-- RIGHT: 8-BIT SPIRAL GALAXY (10^21 m) -->
      <g transform="translate(196, 48)">
        <!-- Galactic Core -->
        <rect x="-5" y="-5" width="10" height="10" fill="#ffffff"/>
        <rect x="-8" y="-3" width="16" height="6" fill="#ffd700"/>
        <rect x="-3" y="-8" width="6" height="16" fill="#ffd700"/>
        <!-- Spiral Arms (Stepped Pixel Arcs) -->
        <!-- Arm 1 (Top-Right to Bottom) -->
        <rect x="4" y="-8" width="8" height="3" fill="#ff007f"/>
        <rect x="12" y="-6" width="8" height="3" fill="#ff007f"/>
        <rect x="18" y="-3" width="6" height="4" fill="#00f0ff"/>
        <rect x="20" y="1" width="4" height="6" fill="#00f0ff"/>
        <rect x="16" y="7" width="6" height="4" fill="#9933ff"/>
        <rect x="8" y="9" width="8" height="3" fill="#ff007f"/>
        <!-- Arm 2 (Bottom-Left to Top) -->
        <rect x="-12" y="5" width="8" height="3" fill="#ff007f"/>
        <rect x="-20" y="3" width="8" height="3" fill="#ff007f"/>
        <rect x="-24" y="-1" width="6" height="4" fill="#00f0ff"/>
        <rect x="-24" y="-7" width="4" height="6" fill="#00f0ff"/>
        <rect x="-22" y="-11" width="6" height="4" fill="#9933ff"/>
        <rect x="-16" y="-12" width="8" height="3" fill="#ff007f"/>
      </g>
      <text x="196" y="74" text-anchor="middle" fill="#ff007f" font-family="'Press Start 2P', monospace" font-size="5.5">10²¹m GALAXY</text>
      <!-- Bottom Pixel Logarithmic Scale Ruler -->
      <rect x="12" y="88" width="216" height="2" fill="${color}"/>
      <rect x="12" y="84" width="2" height="10" fill="${color}"/>
      <rect x="42" y="85" width="2" height="8" fill="${color}"/>
      <rect x="80" y="86" width="1" height="6" fill="${color}"/>
      <rect x="120" y="83" width="2" height="12" fill="#ffd700"/>
      <rect x="160" y="86" width="1" height="6" fill="${color}"/>
      <rect x="196" y="85" width="2" height="8" fill="${color}"/>
      <rect x="226" y="84" width="2" height="10" fill="${color}"/>
      <!-- Golden Cursor Indicator at 10^0m -->
      <polygon points="121,80 117,84 125,84" fill="#ffd700"/>
      <!-- Pixel CRT Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Header & Telemetry -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">SCALE JUMP // POWERS OF 10</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">10⁻³⁵m</text>
      <text x="120" y="112" text-anchor="middle" fill="#ffd700" font-family="'Press Start 2P', monospace" font-size="5.5">1 METER (10⁰m)</text>
      <text x="226" y="112" text-anchor="end" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">10²⁷m</text>
    </svg>`;
  }

  if (kind === "apple") {
    // THE DIET GAME — 8-bit Retro Diner & Absurd Nutrition Protocol
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#0d0209"/>
      <!-- Retro Dither Grid Floor -->
      <path d="M0 24h240M0 48h240M0 72h240M0 96h240" stroke="#330a22" stroke-width="1"/>
      <path d="M24 0v120M48 0v120M72 0v120M96 0v120M120 0v120M144 0v120M168 0v120M192 0v120M216 0v120" stroke="#330a22" stroke-width="1"/>
      <!-- Stepped Ceramic Diner Plate (Y=64 to 88) -->
      <rect x="68" y="74" width="104" height="12" fill="#1f0717"/>
      <rect x="76" y="70" width="88" height="18" fill="#1f0717"/>
      <rect x="84" y="68" width="72" height="22" fill="#2b0c21" stroke="${color}" stroke-width="1"/>
      <rect x="88" y="70" width="64" height="18" fill="#140410"/>
      <!-- Silverware: 8-Bit Pixel Fork (Left) -->
      <rect x="44" y="52" width="2" height="34" fill="#a0b0c4"/>
      <rect x="42" y="50" width="6" height="4" fill="#d4e0ee"/>
      <rect x="41" y="42" width="2" height="9" fill="#d4e0ee"/>
      <rect x="44" y="42" width="2" height="9" fill="#d4e0ee"/>
      <rect x="47" y="42" width="2" height="9" fill="#d4e0ee"/>
      <!-- Silverware: 8-Bit Pixel Knife (Right) -->
      <rect x="194" y="52" width="2" height="34" fill="#a0b0c4"/>
      <rect x="193" y="40" width="4" height="14" fill="#d4e0ee"/>
      <rect x="195" y="38" width="2" height="4" fill="#d4e0ee"/>
      <!-- 8-BIT ARCADE APPLE SPRITE (Center-Left on Plate) -->
      <g transform="translate(94, 34)">
        <!-- Apple Body -->
        <rect x="4" y="6" width="16" height="20" fill="${color}"/>
        <rect x="2" y="9" width="20" height="15" fill="${color}"/>
        <rect x="6" y="24" width="12" height="3" fill="#b31252"/>
        <rect x="7" y="5" width="10" height="3" fill="${color}"/>
        <!-- Shadow & Highlight -->
        <rect x="5" y="8" width="3" height="8" fill="#ffffff" opacity="0.8"/>
        <rect x="8" y="8" width="2" height="4" fill="#ffffff" opacity="0.8"/>
        <rect x="13" y="16" width="6" height="8" fill="#b31252"/>
        <!-- Apple Stem -->
        <rect x="11" y="1" width="2" height="6" fill="#8a4d1a"/>
        <!-- Leaf -->
        <rect x="13" y="2" width="6" height="3" fill="#00ff66"/>
        <rect x="15" y="1" width="3" height="3" fill="#66ff99"/>
      </g>
      <!-- 8-BIT PIXEL AVOCADO HALF (Center-Right on Plate) -->
      <g transform="translate(126, 40)">
        <!-- Dark Green Skin -->
        <rect x="3" y="3" width="16" height="22" fill="#143012"/>
        <rect x="1" y="6" width="20" height="16" fill="#143012"/>
        <!-- Lime Flesh -->
        <rect x="4" y="5" width="14" height="18" fill="#8bc34a"/>
        <rect x="3" y="8" width="16" height="12" fill="#9ccc65"/>
        <rect x="5" y="7" width="12" height="14" fill="#cddc39"/>
        <!-- Brown Seed Pit -->
        <rect x="8" y="11" width="6" height="8" fill="#5d3514"/>
        <rect x="7" y="12" width="8" height="6" fill="#6d3e18"/>
        <rect x="9" y="12" width="2" height="3" fill="#8d5628"/>
      </g>
      <!-- Calorie Burn 8-Bit Flame Sprite (Bottom) -->
      <g transform="translate(114, 84)">
        <rect x="4" y="6" width="6" height="6" fill="#ff2233"/>
        <rect x="2" y="8" width="10" height="6" fill="#ff7700"/>
        <rect x="4" y="10" width="6" height="4" fill="#ffd700"/>
        <rect x="5" y="3" width="3" height="4" fill="#ff2233"/>
      </g>
      <!-- Absurdity Level Meter (Upper Right) -->
      <g transform="translate(172, 14)">
        <rect x="0" y="0" width="56" height="16" fill="#160312" stroke="${color}" stroke-width="1"/>
        <rect x="2" y="2" width="46" height="12" fill="#ff5c9d"/>
        <text x="28" y="10" text-anchor="middle" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="4.5">92% ABSURD</text>
      </g>
      <!-- Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">THE DIET // 25 RULES</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">RULE 1: NO VOWELS</text>
      <text x="226" y="112" text-anchor="end" fill="#00ff66" font-family="'Press Start 2P', monospace" font-size="5.5">STAGE: CLEAN</text>
    </svg>`;
  }

  if (kind === "modem") {
    // PING AGE — 1990s 8-bit / Cyber BBS Dial-Up Workstation
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#021210"/>
      <!-- Cyberspace Perspective Floor -->
      <path d="M0 72h240M0 80h240M0 90h240M0 102h240M0 118h240" stroke="${color}" stroke-width="1" stroke-opacity="0.35"/>
      <path d="M120 72L0 120M120 72L40 120M120 72L80 120M120 72L120 120M120 72L160 120M120 72L200 120M120 72L240 120" stroke="${color}" stroke-width="1" stroke-opacity="0.35"/>
      <!-- 8-BIT BEIGE CRT MONITOR (Left) -->
      <g transform="translate(26, 22)">
        <!-- Monitor Casing -->
        <rect x="0" y="0" width="68" height="52" fill="#d0c4b0" stroke="#8a7e6b" stroke-width="2"/>
        <rect x="4" y="4" width="60" height="42" fill="#1c1626"/>
        <!-- CRT Screen -->
        <rect x="7" y="7" width="54" height="36" fill="#0a1a24"/>
        <line x1="7" y1="18" x2="61" y2="18" stroke="#00f0ff" stroke-width="0.5" stroke-opacity="0.3"/>
        <line x1="7" y1="28" x2="61" y2="28" stroke="#00f0ff" stroke-width="0.5" stroke-opacity="0.3"/>
        <!-- Smiley & Command Prompt on Screen -->
        <text x="34" y="24" text-anchor="middle" fill="#00ff66" font-family="'Press Start 2P', monospace" font-size="6">(^_^)</text>
        <text x="12" y="36" fill="#00f0ff" font-family="'Press Start 2P', monospace" font-size="5">&gt; CONNECT</text>
        <rect x="52" y="30" width="3" height="6" fill="#00f0ff"/>
        <!-- Monitor Stand -->
        <rect x="26" y="52" width="16" height="6" fill="#998e7c"/>
        <rect x="18" y="58" width="32" height="4" fill="#b8ab96"/>
      </g>
      <!-- 8-BIT EXTERNAL 56K MODEM (Center-Right) -->
      <g transform="translate(108, 46)">
        <rect x="0" y="0" width="56" height="24" fill="#20152b" stroke="${color}" stroke-width="1.5"/>
        <rect x="4" y="4" width="48" height="8" fill="#120a1a"/>
        <!-- 6 Glowing LED Indicators -->
        <rect x="8" y="7" width="3" height="3" fill="#00ff66"/>
        <rect x="15" y="7" width="3" height="3" fill="#00ff66"/>
        <rect x="22" y="7" width="3" height="3" fill="#ffb700"/>
        <rect x="29" y="7" width="3" height="3" fill="#ff007f"/>
        <rect x="36" y="7" width="3" height="3" fill="#ff007f"/>
        <rect x="43" y="7" width="3" height="3" fill="#00f0ff"/>
        <text x="28" y="19" text-anchor="middle" fill="${color}" font-family="'Press Start 2P', monospace" font-size="4">56K FAX</text>
        <!-- Coiled Serial Cable behind -->
        <path d="M56 12h12v18h-8" stroke="#5a4d66" stroke-width="2" fill="none"/>
      </g>
      <!-- 8-BIT RETRO MOUSE & CURSOR (Right) -->
      <g transform="translate(182, 54)">
        <rect x="0" y="0" width="18" height="24" fill="#d0c4b0" stroke="#8a7e6b" stroke-width="1.5"/>
        <line x1="9" y1="0" x2="9" y2="10" stroke="#8a7e6b" stroke-width="1"/>
        <rect x="8" y="3" width="2" height="4" fill="#444"/>
        <path d="M9 0V-10H-6" stroke="#8a7e6b" stroke-width="1" fill="none"/>
      </g>
      <!-- 8-Bit Mouse Pointer Arrow Sprite -->
      <g transform="translate(196, 32)">
        <polygon points="0,0 0,16 5,12 9,18 12,16 8,10 13,10" fill="#ffffff" stroke="#000000" stroke-width="1.5"/>
      </g>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">PING AGE // 1995-2005</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">BAUD: 57,600</text>
      <text x="226" y="112" text-anchor="end" fill="#00ff66" font-family="'Press Start 2P', monospace" font-size="5.5">DIALUP: [ONLINE]</text>
    </svg>`;
  }

  if (kind === "terminal") {
    // ROOTKIT — 8-bit Cyberpunk Terminal & Hacker Skull
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#05010b"/>
      <!-- Matrix Cascading Hex Grid -->
      <g fill="#45146e" opacity="0.3" font-family="'Press Start 2P', monospace" font-size="5">
        <text x="8" y="24">7F 45</text>
        <text x="8" y="36">02 01</text>
        <text x="8" y="48">55 48</text>
        <text x="8" y="60">B8 00</text>
        <text x="8" y="72">10 AF</text>
        <text x="8" y="84">00 00</text>
        <text x="206" y="24">01 10</text>
        <text x="206" y="36">11 00</text>
        <text x="206" y="48">01 01</text>
        <text x="206" y="60">10 11</text>
        <text x="206" y="72">00 10</text>
        <text x="206" y="84">11 11</text>
      </g>
      <!-- 8-BIT TERMINAL WINDOW (Left) -->
      <g transform="translate(18, 18)">
        <!-- Window Frame -->
        <rect x="0" y="0" width="144" height="82" fill="#0f041c" stroke="${color}" stroke-width="1.5"/>
        <rect x="0" y="0" width="144" height="12" fill="#240a3d"/>
        <line x1="0" y1="12" x2="144" y2="12" stroke="${color}" stroke-width="1"/>
        <!-- Window Title & Buttons -->
        <rect x="4" y="3" width="6" height="6" fill="#ff3b30"/>
        <rect x="12" y="3" width="6" height="6" fill="#ffb700"/>
        <rect x="20" y="3" width="6" height="6" fill="#00ff66"/>
        <text x="32" y="9" fill="${color}" font-family="'Press Start 2P', monospace" font-size="4.5">ROOT@GATEWAY</text>
        <!-- Terminal Command Lines -->
        <text x="6" y="24" fill="${color}" font-family="'Press Start 2P', monospace" font-size="5">&gt; ./exploit.sh</text>
        <text x="6" y="34" fill="#00ff66" font-family="'Press Start 2P', monospace" font-size="4.5">[+] AUTH INJECT: OK</text>
        <text x="6" y="44" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="4.5">[+] CIPHER: 0x8849F</text>
        <text x="6" y="54" fill="#ffd700" font-family="'Press Start 2P', monospace" font-size="4.5">[!] TRACE: 42s LEFT</text>
        <text x="6" y="64" fill="${color}" font-family="'Press Start 2P', monospace" font-size="5.5"># ACCESS=ROOT</text>
        <rect x="86" y="56" width="5" height="8" fill="${color}"/>
        <!-- Trace Progress Meter -->
        <rect x="6" y="71" width="90" height="6" fill="#07020d" stroke="${color}" stroke-width="0.8"/>
        <rect x="7" y="72" width="64" height="4" fill="${color}"/>
        <text x="100" y="76" fill="${color}" font-family="'Press Start 2P', monospace" font-size="4">TRACE 71%</text>
      </g>
      <!-- 8-BIT CYBER SKULL SPRITE (Right) -->
      <g transform="translate(176, 24)">
        <!-- Crossbones / Circuit Traces behind -->
        <rect x="0" y="0" width="4" height="4" fill="${color}" opacity="0.6"/>
        <rect x="40" y="0" width="4" height="4" fill="${color}" opacity="0.6"/>
        <rect x="0" y="46" width="4" height="4" fill="${color}" opacity="0.6"/>
        <rect x="40" y="46" width="4" height="4" fill="${color}" opacity="0.6"/>
        <line x1="2" y1="2" x2="42" y2="48" stroke="${color}" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.6"/>
        <line x1="42" y1="2" x2="2" y2="48" stroke="${color}" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.6"/>
        <!-- Skull Cranium -->
        <rect x="10" y="4" width="24" height="24" fill="#1b0830" stroke="${color}" stroke-width="1.5"/>
        <rect x="6" y="10" width="32" height="18" fill="#1b0830" stroke="${color}" stroke-width="1.5"/>
        <!-- Glowing Cyan Eye Sockets -->
        <rect x="11" y="14" width="8" height="8" fill="#000000"/>
        <rect x="12" y="15" width="6" height="6" fill="#00f0ff"/>
        <rect x="14" y="16" width="2" height="2" fill="#ffffff"/>
        <rect x="25" y="14" width="8" height="8" fill="#000000"/>
        <rect x="26" y="15" width="6" height="6" fill="#00f0ff"/>
        <rect x="28" y="16" width="2" height="2" fill="#ffffff"/>
        <!-- Nose Cavity -->
        <rect x="21" y="24" width="2" height="3" fill="${color}"/>
        <!-- Jaw & Teeth -->
        <rect x="12" y="30" width="20" height="10" fill="#1b0830" stroke="${color}" stroke-width="1.5"/>
        <rect x="14" y="32" width="2" height="4" fill="#ffffff"/>
        <rect x="18" y="32" width="2" height="4" fill="#ffffff"/>
        <rect x="22" y="32" width="2" height="4" fill="#ffffff"/>
        <rect x="26" y="32" width="2" height="4" fill="#ffffff"/>
      </g>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">ROOTKIT // INTRUSION SYSTEM</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">ACCESS: ROOT</text>
      <text x="226" y="112" text-anchor="end" fill="#ff3b30" font-family="'Press Start 2P', monospace" font-size="5.5">PORT 22 [OK]</text>
    </svg>`;
  }

  if (kind === "car") {
    // GHOST LAP — 8-bit Top-Down Arcade Racer (Super Sprint / Micro Machines / F1 Neon)
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#030611"/>
      <!-- Track Run-off Grass & Infield Dither -->
      <rect x="0" y="0" width="240" height="120" fill="#050d18"/>
      <path d="M0 20h240M0 40h240M0 60h240M0 80h240M0 100h240" stroke="#0088ff" stroke-width="1" stroke-opacity="0.08"/>
      <path d="M20 0v120M60 0v120M100 0v120M140 0v120M180 0v120M220 0v120" stroke="#0088ff" stroke-width="1" stroke-opacity="0.08"/>
      <!-- Stepped Asphalt Track Ribbon -->
      <polygon points="0,30 240,30 240,94 0,94" fill="#09121f"/>
      <polygon points="40,24 200,24 220,30 220,94 190,100 30,100 10,94 10,30" fill="#0c1726"/>
      <!-- Track Outer Cyan Glow Borders -->
      <line x1="0" y1="24" x2="240" y2="24" stroke="#0088ff" stroke-width="1.5" stroke-opacity="0.6"/>
      <line x1="0" y1="100" x2="240" y2="100" stroke="#0088ff" stroke-width="1.5" stroke-opacity="0.6"/>
      <!-- Alternating Red & White Curbs on Outer Edge -->
      <g>
        <rect x="0" y="20" width="16" height="4" fill="#ff2233"/><rect x="16" y="20" width="16" height="4" fill="#ffffff"/>
        <rect x="32" y="20" width="16" height="4" fill="#ff2233"/><rect x="48" y="20" width="16" height="4" fill="#ffffff"/>
        <rect x="64" y="20" width="16" height="4" fill="#ff2233"/><rect x="80" y="20" width="16" height="4" fill="#ffffff"/>
        <rect x="160" y="20" width="16" height="4" fill="#ff2233"/><rect x="176" y="20" width="16" height="4" fill="#ffffff"/>
        <rect x="192" y="20" width="16" height="4" fill="#ff2233"/><rect x="208" y="20" width="16" height="4" fill="#ffffff"/>
        <rect x="224" y="20" width="16" height="4" fill="#ff2233"/>
        <!-- Bottom Curbs -->
        <rect x="0" y="100" width="16" height="4" fill="#ff2233"/><rect x="16" y="100" width="16" height="4" fill="#ffffff"/>
        <rect x="32" y="100" width="16" height="4" fill="#ff2233"/><rect x="48" y="100" width="16" height="4" fill="#ffffff"/>
        <rect x="64" y="100" width="16" height="4" fill="#ff2233"/><rect x="80" y="100" width="16" height="4" fill="#ffffff"/>
        <rect x="160" y="100" width="16" height="4" fill="#ff2233"/><rect x="176" y="100" width="16" height="4" fill="#ffffff"/>
        <rect x="192" y="100" width="16" height="4" fill="#ff2233"/><rect x="208" y="100" width="16" height="4" fill="#ffffff"/>
        <rect x="224" y="100" width="16" height="4" fill="#ff2233"/>
      </g>
      <!-- DYNAMIC RACING LINE (Dashed Neon Green -> Amber -> Red Apex) -->
      <g>
        <line x1="10" y1="46" x2="70" y2="46" stroke="#00ff66" stroke-width="2.5" stroke-dasharray="6 4"/>
        <line x1="70" y1="46" x2="130" y2="56" stroke="#ffb700" stroke-width="3" stroke-dasharray="6 4"/>
        <line x1="130" y1="56" x2="190" y2="76" stroke="#ff2244" stroke-width="3.5" stroke-dasharray="6 4"/>
        <line x1="190" y1="76" x2="235" y2="60" stroke="#00ff66" stroke-width="2.5" stroke-dasharray="6 4"/>
      </g>
      <!-- Checkered Start/Finish Line Gantry (Right) -->
      <g transform="translate(195, 24)">
        <rect x="0" y="0" width="4" height="76" fill="#1b2838"/>
        <rect x="0" y="0" width="2" height="76" fill="#ffffff"/>
        <rect x="2" y="0" width="2" height="76" fill="#000000"/>
        <rect x="0" y="4" width="2" height="4" fill="#000000"/><rect x="2" y="4" width="2" height="4" fill="#ffffff"/>
        <rect x="0" y="12" width="2" height="4" fill="#000000"/><rect x="2" y="12" width="2" height="4" fill="#ffffff"/>
        <rect x="0" y="20" width="2" height="4" fill="#000000"/><rect x="2" y="20" width="2" height="4" fill="#ffffff"/>
        <rect x="0" y="28" width="2" height="4" fill="#000000"/><rect x="2" y="28" width="2" height="4" fill="#ffffff"/>
        <rect x="0" y="36" width="2" height="4" fill="#000000"/><rect x="2" y="36" width="2" height="4" fill="#ffffff"/>
        <rect x="0" y="44" width="2" height="4" fill="#000000"/><rect x="2" y="44" width="2" height="4" fill="#ffffff"/>
        <rect x="0" y="52" width="2" height="4" fill="#000000"/><rect x="2" y="52" width="2" height="4" fill="#ffffff"/>
        <rect x="0" y="60" width="2" height="4" fill="#000000"/><rect x="2" y="60" width="2" height="4" fill="#ffffff"/>
        <rect x="0" y="68" width="2" height="4" fill="#000000"/><rect x="2" y="68" width="2" height="4" fill="#ffffff"/>
      </g>
      <!-- Drift Skid Marks -->
      <path d="M40 70C70 70 90 74 115 76M40 84C70 84 90 88 115 90" stroke="#040810" stroke-width="3" stroke-linecap="round"/>
      <!-- RIVAL CAR: APEX RED (Leading Car, Upper Right) -->
      <g transform="translate(176, 42) rotate(6)">
        <rect x="0" y="2" width="26" height="12" fill="#ff2244"/>
        <rect x="6" y="4" width="10" height="8" fill="#1a0408"/>
        <rect x="18" y="1" width="6" height="3" fill="#111"/><rect x="18" y="12" width="6" height="3" fill="#111"/>
        <rect x="2" y="1" width="6" height="3" fill="#111"/><rect x="2" y="12" width="6" height="3" fill="#111"/>
        <rect x="-2" y="3" width="3" height="10" fill="#ffffff"/>
        <!-- Glowing Red Brake Lamps -->
        <rect x="-3" y="2" width="3" height="3" fill="#ff0044"/><rect x="-3" y="11" width="3" height="3" fill="#ff0044"/>
        <text x="13" y="-3" text-anchor="middle" fill="#ff2244" font-family="'Press Start 2P', monospace" font-size="3.5">APEX RED</text>
      </g>
      <!-- GHOST CAR (Neon Pink Translucent Sprite, Left) -->
      <g transform="translate(54, 56) rotate(-8)">
        <rect x="0" y="3" width="28" height="14" fill="#ff007f" opacity="0.45"/>
        <rect x="4" y="5" width="20" height="10" fill="#ff007f" opacity="0.65"/>
        <rect x="10" y="6" width="8" height="8" fill="#ffffff" opacity="0.75"/>
        <rect x="2" y="1" width="6" height="3" fill="#ff007f"/><rect x="20" y="1" width="6" height="3" fill="#ff007f"/>
        <rect x="2" y="16" width="6" height="3" fill="#ff007f"/><rect x="20" y="16" width="6" height="3" fill="#ff007f"/>
        <text x="14" y="-3" text-anchor="middle" fill="#ff007f" font-family="'Press Start 2P', monospace" font-size="4">GHOST +0.08s</text>
      </g>
      <!-- PLAYER CAR (Electric Blue 8-Bit Racer with Twin Turbo Flame, Center) -->
      <g transform="translate(112, 60) rotate(-6)">
        <!-- Twin Exhaust Flame Pixels -->
        <rect x="-6" y="5" width="5" height="3" fill="#00f0ff"/><rect x="-10" y="6" width="4" height="1" fill="#ffffff"/>
        <rect x="-6" y="12" width="5" height="3" fill="#00f0ff"/><rect x="-10" y="13" width="4" height="1" fill="#ffffff"/>
        <!-- 4 Wide Black Rubber Slicks -->
        <rect x="3" y="0" width="8" height="4" fill="#111116"/><rect x="20" y="0" width="8" height="4" fill="#111116"/>
        <rect x="3" y="16" width="8" height="4" fill="#111116"/><rect x="20" y="16" width="8" height="4" fill="#111116"/>
        <!-- Racer Chassis -->
        <rect x="0" y="3" width="30" height="14" fill="${color}"/>
        <rect x="2" y="4" width="28" height="12" fill="#1a8fff"/>
        <rect x="0" y="9" width="32" height="2" fill="#ffffff"/>
        <!-- Cockpit & Driver Helmet -->
        <rect x="8" y="6" width="12" height="8" fill="#061224"/>
        <rect x="12" y="8" width="5" height="4" fill="#00f0ff"/>
        <!-- Rear Wing / Spoiler -->
        <rect x="-2" y="2" width="3" height="16" fill="#ffffff"/>
        <!-- Xenon Headlights -->
        <rect x="30" y="4" width="2" height="3" fill="#ffff88"/><rect x="30" y="13" width="2" height="3" fill="#ffff88"/>
      </g>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">GHOST LAP // F1 TIME TRIAL</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">SPEED: 312 KM/H</text>
      <text x="226" y="112" text-anchor="end" fill="#00ff66" font-family="'Press Start 2P', monospace" font-size="5.5">DELTA: -0.142s</text>
    </svg>`;
  }

  if (kind === "tree") {
    // REDLIGHT — 8-bit NHRA Drag Racing Christmas Tree & Top Fuel Dragsters
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#080204"/>
      <!-- Grandstand & Floodlight Tower Horizon -->
      <rect x="0" y="12" width="240" height="36" fill="#100307"/>
      <rect x="16" y="18" width="36" height="4" fill="#3a0c16"/>
      <rect x="188" y="18" width="36" height="4" fill="#3a0c16"/>
      <line x1="0" y1="48" x2="240" y2="48" stroke="#ff2233" stroke-width="1" stroke-opacity="0.3"/>
      <!-- Drag Strip Track Asphalt Surface -->
      <rect x="0" y="52" width="240" height="68" fill="#140508"/>
      <line x1="0" y1="86" x2="240" y2="86" stroke="#ffb700" stroke-width="2" stroke-dasharray="8 6"/>
      <!-- Heavy Sticky Burnout Rubber Stains in Both Lanes -->
      <rect x="10" y="66" width="85" height="12" fill="#0b0204"/>
      <rect x="145" y="66" width="85" height="12" fill="#0b0204"/>
      <rect x="10" y="96" width="85" height="12" fill="#0b0204"/>
      <rect x="145" y="96" width="85" height="12" fill="#0b0204"/>
      <!-- Top Fuel Dragster Left Lane (X=20, Y=64) -->
      <g transform="translate(20, 64)">
        <polygon points="0,9 54,5 58,11 0,11" fill="${color}"/>
        <rect x="5" y="-3" width="7" height="6" fill="#ffffff"/>
        <!-- Zoomie Header Exhaust Flames! -->
        <polygon points="18,3 14,-4 22,0" fill="#ff7700"/><polygon points="17,1 15,-2 19,0" fill="#ffff55"/>
        <polygon points="24,3 20,-4 28,0" fill="#ff7700"/><polygon points="23,1 21,-2 25,0" fill="#ffff55"/>
        <rect x="4" y="3" width="12" height="10" fill="#111115"/>
        <rect x="52" y="6" width="6" height="6" fill="#111115"/>
      </g>
      <!-- Top Fuel Dragster Right Lane (X=162, Y=64) -->
      <g transform="translate(162, 64)">
        <polygon points="58,9 4,5 0,11 58,11" fill="${color}"/>
        <rect x="46" y="-3" width="7" height="6" fill="#ffffff"/>
        <!-- Exhaust Header Flames -->
        <polygon points="36,3 40,-4 32,0" fill="#ff7700"/><polygon points="37,1 39,-2 35,0" fill="#ffff55"/>
        <polygon points="30,3 34,-4 26,0" fill="#ff7700"/><polygon points="31,1 33,-2 27,0" fill="#ffff55"/>
        <rect x="42" y="3" width="12" height="10" fill="#111115"/>
        <rect x="0" y="6" width="6" height="6" fill="#111115"/>
      </g>
      <!-- CENTER: AUTHENTIC NHRA CHRISTMAS TREE TOWER (X=110, Y=6) -->
      <g transform="translate(110, 6)">
        <!-- Tower Mast -->
        <rect x="8" y="0" width="4" height="106" fill="#3a455a"/>
        <!-- Crossbars -->
        <rect x="0" y="14" width="20" height="2" fill="#5a6882"/><rect x="0" y="26" width="20" height="2" fill="#5a6882"/>
        <rect x="0" y="40" width="20" height="2" fill="#5a6882"/><rect x="0" y="54" width="20" height="2" fill="#5a6882"/>
        <rect x="0" y="68" width="20" height="2" fill="#5a6882"/><rect x="0" y="82" width="20" height="2" fill="#5a6882"/>
        <!-- Pre-Stage Lamps (Blue) -->
        <rect x="1" y="12" width="6" height="6" fill="#00f0ff"/><rect x="13" y="12" width="6" height="6" fill="#00f0ff"/>
        <!-- Stage Lamps (Blue) -->
        <rect x="1" y="24" width="6" height="6" fill="#00f0ff"/><rect x="13" y="24" width="6" height="6" fill="#00f0ff"/>
        <!-- Amber 1 Lamps -->
        <rect x="1" y="38" width="6" height="6" fill="#ffb700"/><rect x="13" y="38" width="6" height="6" fill="#ffb700"/>
        <!-- Amber 2 Lamps -->
        <rect x="1" y="52" width="6" height="6" fill="#ffb700"/><rect x="13" y="52" width="6" height="6" fill="#ffb700"/>
        <!-- Amber 3 Lamps -->
        <rect x="1" y="66" width="6" height="6" fill="#ffb700"/><rect x="13" y="66" width="6" height="6" fill="#ffb700"/>
        <!-- Green Launch Bulbs (Radiant High-Glow Flare) -->
        <rect x="0" y="80" width="8" height="8" fill="#00ff66"/>
        <rect x="1" y="81" width="6" height="6" fill="#afffd0"/><rect x="2" y="82" width="4" height="4" fill="#ffffff"/>
        <rect x="12" y="80" width="8" height="8" fill="#00ff66"/>
        <rect x="13" y="81" width="6" height="6" fill="#afffd0"/><rect x="14" y="82" width="4" height="4" fill="#ffffff"/>
      </g>
      <!-- Reaction Time Box (Upper Right) -->
      <g transform="translate(164, 12)">
        <rect x="0" y="0" width="62" height="22" fill="#120406" stroke="${color}" stroke-width="1"/>
        <text x="31" y="8" text-anchor="middle" fill="${color}" font-family="'Press Start 2P', monospace" font-size="4">REACTION R/T</text>
        <text x="31" y="18" text-anchor="middle" fill="#00ff66" font-family="'Press Start 2P', monospace" font-size="6.5">.003 s</text>
      </g>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">REDLIGHT // NHRA TREE</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">PRO TREE .400</text>
      <text x="226" y="112" text-anchor="end" fill="#00ff66" font-family="'Press Start 2P', monospace" font-size="5.5">GREEN LIGHT GO!</text>
    </svg>`;
  }

  if (kind === "doc") {
    // THE RESUME GAME — 8-bit Executive RPG Dossier & Laser ATS Scanner
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#0b0802"/>
      <!-- Grid Matrix Background -->
      <path d="M0 24h240M0 48h240M0 72h240M0 96h240" stroke="#261b05" stroke-width="1"/>
      <path d="M24 0v120M48 0v120M72 0v120M96 0v120M120 0v120M144 0v120M168 0v120M192 0v120M216 0v120" stroke="#261b05" stroke-width="1"/>
      <!-- 8-BIT EXECUTIVE BRIEFCASE (Left) -->
      <g transform="translate(12, 42)">
        <rect x="0" y="6" width="42" height="28" fill="#38250e" stroke="${color}" stroke-width="1.5"/>
        <rect x="2" y="8" width="38" height="24" fill="#4d3314"/>
        <line x1="0" y1="20" x2="42" y2="20" stroke="${color}" stroke-width="1"/>
        <!-- Handle -->
        <rect x="15" y="1" width="12" height="6" fill="none" stroke="${color}" stroke-width="1.5"/>
        <!-- Gold Buckles & Brass Corners -->
        <rect x="10" y="18" width="4" height="5" fill="#ffd700"/><rect x="28" y="18" width="4" height="5" fill="#ffd700"/>
        <rect x="0" y="6" width="4" height="4" fill="#ffd700"/><rect x="38" y="6" width="4" height="4" fill="#ffd700"/>
        <rect x="0" y="30" width="4" height="4" fill="#ffd700"/><rect x="38" y="30" width="4" height="4" fill="#ffd700"/>
      </g>
      <!-- 8-BIT RESUME DOSSIER SHEET (Center) -->
      <g transform="translate(66, 12)">
        <!-- Shadow & Parchment -->
        <rect x="2" y="2" width="108" height="96" fill="#000000" opacity="0.65"/>
        <rect x="0" y="0" width="108" height="96" fill="#1f180a" stroke="${color}" stroke-width="1.5"/>
        <!-- Dog-eared Corner -->
        <polygon points="94,0 108,14 94,14" fill="#2d220c" stroke="${color}" stroke-width="1"/>
        <!-- Candidate Photo Box (Pixel Face) -->
        <rect x="8" y="8" width="18" height="20" fill="#0d0a04" stroke="${color}" stroke-width="1"/>
        <rect x="13" y="12" width="8" height="7" fill="#ffd700"/>
        <rect x="14" y="14" width="2" height="2" fill="#000"/><rect x="18" y="14" width="2" height="2" fill="#000"/>
        <rect x="11" y="21" width="12" height="6" fill="#3a4b66"/>
        <!-- Name & Title Bars -->
        <rect x="30" y="8" width="54" height="4" fill="#ffffff"/>
        <rect x="30" y="15" width="40" height="3" fill="${color}"/>
        <rect x="30" y="21" width="60" height="2" fill="#8a7a58"/>
        <!-- Section: EXPERIENCE -->
        <rect x="8" y="32" width="34" height="3" fill="${color}"/>
        <line x1="8" y1="36" x2="100" y2="36" stroke="#3d3012" stroke-width="1"/>
        <rect x="8" y="39" width="88" height="2" fill="#d0c4a8"/>
        <rect x="8" y="43" width="80" height="2" fill="#998a6e"/>
        <rect x="8" y="47" width="66" height="2" fill="#998a6e"/>
        <!-- Section: SKILLS -->
        <rect x="8" y="53" width="26" height="3" fill="${color}"/>
        <line x1="8" y1="57" x2="100" y2="57" stroke="#3d3012" stroke-width="1"/>
        <rect x="8" y="60" width="20" height="5" fill="#332408" stroke="${color}" stroke-width="0.5"/>
        <rect x="31" y="60" width="24" height="5" fill="#332408" stroke="${color}" stroke-width="0.5"/>
        <rect x="58" y="60" width="20" height="5" fill="#332408" stroke="${color}" stroke-width="0.5"/>
        <rect x="81" y="60" width="18" height="5" fill="#332408" stroke="${color}" stroke-width="0.5"/>
        <!-- Golden Wax Seal (Bottom Right) -->
        <circle cx="88" cy="80" r="9" fill="#8a1818" stroke="${color}" stroke-width="1.2"/>
        <rect x="86" y="78" width="4" height="4" fill="#ffd700"/>
        <polygon points="84,86 88,93 92,86" fill="#8a1818"/>
        <!-- ATS LASER SCANNING BEAM (Cyan sweep) -->
        <line x1="0" y1="46" x2="108" y2="46" stroke="#00f0ff" stroke-width="1.8" stroke-opacity="0.85"/>
        <rect x="0" y="44" width="108" height="4" fill="#00f0ff" opacity="0.18"/>
        <!-- RUBBER STAMP: OFFER EXTENDED -->
        <g transform="translate(10, 68) rotate(-7)">
          <rect x="0" y="0" width="66" height="18" fill="#0a1a0c" stroke="#00ff66" stroke-width="1.5"/>
          <text x="33" y="12" text-anchor="middle" fill="#00ff66" font-family="'Press Start 2P', monospace" font-size="5.5" font-weight="bold">HIRED [28/28]</text>
        </g>
      </g>
      <!-- 8-BIT HR BOT EVALUATOR (Right) -->
      <g transform="translate(182, 34)">
        <rect x="0" y="0" width="48" height="44" fill="#140f03" stroke="${color}" stroke-width="1.5"/>
        <text x="24" y="16" text-anchor="middle" fill="#00ff66" font-family="'Press Start 2P', monospace" font-size="7">\\(^▽^)/</text>
        <text x="24" y="27" text-anchor="middle" fill="${color}" font-family="'Press Start 2P', monospace" font-size="4.5">HR BOT</text>
        <text x="24" y="37" text-anchor="middle" fill="#ffd700" font-family="'Press Start 2P', monospace" font-size="4.5">MATCH 100%</text>
      </g>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">RESUME // PROTOCOL 28</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">RULES: 28/28</text>
      <text x="226" y="112" text-anchor="end" fill="#ffd700" font-family="'Press Start 2P', monospace" font-size="5.5">TC: $500,000</text>
    </svg>`;
  }

  if (kind === "ship") {
    // IRONSAIL — 8-bit Naval Conquest & Trade Galleon
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#011019"/>
      <!-- Pixel Ocean Grid Waves with Turquoise Foaming Ridges -->
      <path d="M0 62h240M0 76h240M0 90h240M0 104h240" stroke="#00bfa5" stroke-width="1" stroke-opacity="0.25"/>
      <g fill="#00bfa5" opacity="0.45">
        <rect x="10" y="64" width="22" height="2"/><rect x="46" y="70" width="24" height="2"/>
        <rect x="88" y="64" width="28" height="2"/><rect x="136" y="72" width="22" height="2"/>
        <rect x="194" y="64" width="26" height="2"/><rect x="12" y="78" width="24" height="2"/>
        <rect x="68" y="78" width="22" height="2"/><rect x="114" y="84" width="28" height="2"/>
        <rect x="174" y="78" width="22" height="2"/><rect x="220" y="86" width="24" height="2"/>
        <rect x="36" y="92" width="26" height="2"/><rect x="82" y="94" width="24" height="2"/>
        <rect x="156" y="92" width="28" height="2"/><rect x="198" y="100" width="22" height="2"/>
        <rect x="6" y="106" width="22" height="2"/><rect x="54" y="108" width="28" height="2"/>
        <rect x="122" y="106" width="24" height="2"/><rect x="180" y="108" width="26" height="2"/>
      </g>
      <!-- Distant Volcanic Island & Fortress Outpost (Right) -->
      <polygon points="160,62 182,44 216,48 240,62" fill="#d2a679"/>
      <polygon points="174,48 190,34 210,40" fill="#2eb85c"/>
      <!-- Palm Trees -->
      <rect x="188" y="28" width="4" height="12" fill="#8a5c2e"/>
      <polygon points="180,28 190,20 200,28" fill="#00e676"/>
      <!-- Stone Island Signal Tower -->
      <rect x="216" y="36" width="12" height="16" fill="#3a455a" stroke="#ffffff" stroke-width="0.5"/>
      <rect x="220" y="32" width="4" height="5" fill="#ffd700"/>
      <!-- 8-BIT PIRATE FLAGSHIP GALLEON (Center) -->
      <g transform="translate(64, 34)">
        <!-- Carved Wooden Hull -->
        <polygon points="10,42 72,42 84,24 2,24" fill="#29180e" stroke="${color}" stroke-width="1.5"/>
        <!-- Golden Gilded Cannon Ports -->
        <rect x="14" y="28" width="5" height="4" fill="#ffd700"/><rect x="28" y="28" width="5" height="4" fill="#ffd700"/>
        <rect x="42" y="28" width="5" height="4" fill="#ffd700"/><rect x="56" y="28" width="5" height="4" fill="#ffd700"/>
        <rect x="70" y="28" width="5" height="4" fill="#ffd700"/>
        <!-- Triple Masts & Standing Rigging -->
        <rect x="24" y="8" width="3" height="20" fill="#120905"/>
        <rect x="46" y="2" width="4" height="26" fill="#120905"/>
        <rect x="68" y="8" width="3" height="20" fill="#120905"/>
        <line x1="12" y1="26" x2="46" y2="4" stroke="#d2d2d2" stroke-width="0.8"/>
        <line x1="78" y1="26" x2="46" y2="4" stroke="#d2d2d2" stroke-width="0.8"/>
        <!-- Billowing White Sails with Teal Stripes -->
        <rect x="14" y="10" width="20" height="10" fill="#f4f7fc" stroke="#ffffff" stroke-width="0.8"/>
        <rect x="34" y="6" width="26" height="14" fill="#f4f7fc" stroke="#ffffff" stroke-width="0.8"/>
        <line x1="47" y1="6" x2="47" y2="20" stroke="#00bfa5" stroke-width="1.5"/>
        <rect x="62" y="10" width="18" height="10" fill="#f4f7fc" stroke="#ffffff" stroke-width="0.8"/>
        <!-- Jolly Roger Pirate Flag -->
        <rect x="50" y="0" width="14" height="8" fill="#000000"/>
        <rect x="54" y="2" width="4" height="4" fill="#ffffff"/>
        <!-- BROADSIDE CANNON FIRE! (Muzzle Flash, Smoke & Splash) -->
        <circle cx="8" cy="24" r="6" fill="#ffffff" opacity="0.85"/>
        <circle cx="-1" cy="22" r="4" fill="#ffd700" opacity="0.7"/>
        <polygon points="6,24 -4,20 2,28" fill="#ff7700"/>
      </g>
      <!-- Floating Treasure Chest & Spice Barrel (Left) -->
      <rect x="22" y="80" width="10" height="8" fill="#8a5c2e" stroke="#ffd700" stroke-width="1"/>
      <rect x="26" y="83" width="2" height="3" fill="#ffd700"/>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">IRONSAIL // SEVEN SEAS</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">PORTS: 12/12  TRADE: +30%</text>
      <text x="226" y="112" text-anchor="end" fill="#00bfa5" font-family="'Press Start 2P', monospace" font-size="5.5">BROADSIDES</text>
    </svg>`;
  }

  if (kind === "headbutt") {
    // HEADBUTT — 2D physics car battler
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#0c0414"/>
      <line x1="0" y1="100" x2="240" y2="100" stroke="${color}" stroke-width="4"/>
      <!-- P1 Car (Left) -->
      <g transform="translate(40, 76)">
        <rect x="0" y="8" width="40" height="12" fill="#00f0ff"/>
        <rect x="8" y="-4" width="16" height="12" fill="#ffffff"/>
        <!-- Head -->
        <rect x="12" y="-12" width="8" height="8" fill="#ffccaa"/>
        <!-- Wheels -->
        <circle cx="8" cy="20" r="6" fill="#111"/>
        <circle cx="32" cy="20" r="6" fill="#111"/>
      </g>
      <!-- P2 Car (Right) -->
      <g transform="translate(160, 76)">
        <rect x="0" y="8" width="40" height="12" fill="#ff007f"/>
        <rect x="16" y="-4" width="16" height="12" fill="#ffffff"/>
        <!-- Head -->
        <rect x="20" y="-12" width="8" height="8" fill="#ffccaa"/>
        <!-- Wheels -->
        <circle cx="8" cy="20" r="6" fill="#111"/>
        <circle cx="32" cy="20" r="6" fill="#111"/>
      </g>
      <text x="120" y="40" text-anchor="middle" fill="${color}" font-family="'Press Start 2P', monospace" font-size="10">VS</text>
    </svg>`;
  }

  if (kind === "zombie") {
    // COLD SNAP — 8-bit Isometric Suburban Apocalypse
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#0c0304"/>
      <!-- Blood Moon with Atmospheric Crimson Halo -->
      <circle cx="196" cy="26" r="18" fill="#660808"/>
      <circle cx="194" cy="24" r="14" fill="#dc2626"/>
      <circle cx="191" cy="22" r="10" fill="#ff5555" opacity="0.4"/>
      <!-- Barricaded Suburban House Silhouettes -->
      <polygon points="14,84 46,54 78,84" fill="#241212"/>
      <rect x="20" y="84" width="52" height="26" fill="#1a0b0b"/>
      <!-- Boarded-up Window with Generator Light -->
      <rect x="34" y="88" width="14" height="14" fill="#1f381f" stroke="#ff2233" stroke-width="0.8"/>
      <line x1="32" y1="91" x2="50" y2="91" stroke="#a06020" stroke-width="1.8"/>
      <line x1="32" y1="97" x2="50" y2="97" stroke="#a06020" stroke-width="1.8"/>
      <!-- Street & Blood Spatter -->
      <rect x="0" y="96" width="240" height="24" fill="#120506"/>
      <line x1="0" y1="96" x2="240" y2="96" stroke="#dc2626" stroke-width="1.5"/>
      <circle cx="86" cy="106" r="5" fill="#880000"/><circle cx="138" cy="110" r="7" fill="#880000"/>
      <!-- Survivor Hero with Shotgun (Center Left) -->
      <g transform="translate(68, 72)">
        <rect x="4" y="0" width="6" height="6" fill="#ffd5a0"/>
        <rect x="2" y="6" width="10" height="12" fill="#3a2e1b"/>
        <!-- Shotgun & Muzzle Flash -->
        <rect x="10" y="8" width="16" height="3" fill="#64748b"/>
        <polygon points="26,8 34,5 30,10" fill="#ffb700"/>
        <rect x="3" y="18" width="3" height="10" fill="#182234"/><rect x="8" y="18" width="3" height="10" fill="#182234"/>
      </g>
      <!-- 8-BIT ZOMBIE HORDE (Right) -->
      <g transform="translate(112, 68)">
        <!-- Zombie 1 (Reaching Forward) -->
        <rect x="4" y="2" width="6" height="6" fill="#2d4a2d"/>
        <rect x="5" y="4" width="1" height="1" fill="#ff0000"/><rect x="8" y="4" width="1" height="1" fill="#ff0000"/>
        <rect x="3" y="8" width="8" height="12" fill="#1b2e1b"/>
        <rect x="11" y="8" width="8" height="3" fill="#2d4a2d"/>
        <rect x="4" y="20" width="3" height="8" fill="#111c11"/><rect x="8" y="20" width="3" height="8" fill="#111c11"/>
      </g>
      <g transform="translate(142, 64)">
        <!-- Zombie 2 (Lumbering) -->
        <rect x="4" y="2" width="6" height="6" fill="#2d4a2d"/>
        <rect x="5" y="4" width="1" height="1" fill="#ff0000"/><rect x="8" y="4" width="1" height="1" fill="#ff0000"/>
        <rect x="3" y="8" width="8" height="14" fill="#2e1b1b"/>
        <rect x="0" y="9" width="4" height="3" fill="#2d4a2d"/><rect x="11" y="9" width="7" height="3" fill="#2d4a2d"/>
        <rect x="4" y="22" width="3" height="10" fill="#111c11"/><rect x="8" y="22" width="3" height="10" fill="#111c11"/>
      </g>
      <g transform="translate(172, 72)">
        <!-- Zombie 3 (Crawling on Road) -->
        <rect x="14" y="10" width="6" height="6" fill="#2d4a2d"/>
        <rect x="17" y="11" width="1" height="1" fill="#ff0000"/>
        <rect x="2" y="14" width="14" height="6" fill="#1b2e1b"/>
        <rect x="14" y="16" width="8" height="3" fill="#2d4a2d"/>
      </g>
      <!-- Moodles Status Icons (Upper Left) -->
      <g transform="translate(14, 22)">
        <rect x="0" y="0" width="10" height="10" fill="#8a1818" stroke="#ff4444" stroke-width="0.8"/>
        <text x="5" y="8" text-anchor="middle" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="5">!</text>
        <rect x="14" y="0" width="10" height="10" fill="#225588" stroke="#44aaff" stroke-width="0.8"/>
        <text x="19" y="8" text-anchor="middle" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="5">*</text>
      </g>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">COLD SNAP // OUTBREAK</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">12 MOODLES // UTILITIES OFF</text>
      <text x="226" y="112" text-anchor="end" fill="#dc2626" font-family="'Press Start 2P', monospace" font-size="5.5">PERMADEATH</text>
    </svg>`;
  }

  if (kind === "jet") {
    // ACE VECTOR — High-Fidelity Energy Dogfighter Jet
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#020510"/>
          <stop offset="42%" stop-color="#0b1b36"/>
          <stop offset="70%" stop-color="#1f3b5c"/>
          <stop offset="100%" stop-color="#3d5a7d"/>
        </linearGradient>
        <linearGradient id="oceanGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#102538"/>
          <stop offset="100%" stop-color="#07121c"/>
        </linearGradient>
        <linearGradient id="burnerGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="30%" stop-color="#00f0ff"/>
          <stop offset="70%" stop-color="#ff9900"/>
          <stop offset="100%" stop-color="#ff2200"/>
        </linearGradient>
      </defs>

      <!-- Stratosphere Sky -->
      <rect width="240" height="120" fill="url(#skyGrad)"/>

      <!-- Distant Starfield & Stratospheric Dust -->
      <circle cx="28" cy="14" r="0.7" fill="#ffffff" opacity="0.8"/>
      <circle cx="82" cy="8" r="0.9" fill="#ffffff" opacity="0.9"/>
      <circle cx="145" cy="18" r="0.6" fill="#ffffff" opacity="0.6"/>
      <circle cx="210" cy="11" r="0.8" fill="#ffffff" opacity="0.85"/>

      <!-- High-Altitude Cirrus Clouds / Cloud Strata -->
      <ellipse cx="60" cy="45" rx="75" ry="10" fill="#ffffff" opacity="0.12"/>
      <ellipse cx="205" cy="40" rx="55" ry="8" fill="#ffffff" opacity="0.09"/>

      <!-- Distant Mountain Peaks (Parallax Ridge) -->
      <polygon points="0,96 28,78 62,90 98,72 135,88 172,70 208,86 240,74 240,120 0,120" fill="#132438"/>
      <!-- Snowcaps on Distant Peaks -->
      <polygon points="28,78 20,83 36,83" fill="#ffffff" opacity="0.35"/>
      <polygon points="98,72 88,78 108,78" fill="#ffffff" opacity="0.35"/>
      <polygon points="172,70 162,76 182,76" fill="#ffffff" opacity="0.35"/>

      <!-- Foreground Mountain Crags & Pine Ridges -->
      <polygon points="0,105 34,84 55,95 86,81 122,100 160,83 194,97 226,82 240,90 240,120 0,120" fill="#192b23"/>
      <!-- Snowcaps on Mid Peaks -->
      <polygon points="34,84 25,90 42,90" fill="#e8f4fc" opacity="0.7"/>
      <polygon points="86,81 77,88 95,88" fill="#e8f4fc" opacity="0.7"/>
      <polygon points="160,83 150,89 168,89" fill="#e8f4fc" opacity="0.7"/>
      <polygon points="226,82 218,88 234,88" fill="#e8f4fc" opacity="0.7"/>

      <!-- Pine Trees Silhouette Silhouettes on Ridge -->
      <polygon points="48,93 50,89 52,93" fill="#0d1813"/>
      <polygon points="52,94 54,90 56,94" fill="#0d1813"/>
      <polygon points="112,98 114,93 116,98" fill="#0d1813"/>
      <polygon points="116,99 118,94 120,99" fill="#0d1813"/>
      <polygon points="138,94 140,89 142,94" fill="#0d1813"/>

      <!-- Coastal Waters & Ocean Surf -->
      <rect x="0" y="106" width="240" height="14" fill="url(#oceanGrad)"/>
      <line x1="12" y1="110" x2="68" y2="110" stroke="#00f0ff" stroke-width="1" opacity="0.4"/>
      <line x1="84" y1="113" x2="160" y2="113" stroke="#00f0ff" stroke-width="0.8" opacity="0.3"/>
      <line x1="178" y1="109" x2="232" y2="109" stroke="#ffffff" stroke-width="0.9" opacity="0.5"/>

      <!-- Radar Target Lock Box & Lead Pursuit Reticle (Upper Right) -->
      <g stroke="#ff3b30" stroke-width="1.2" fill="none">
        <!-- Target Box around Enemy -->
        <path d="M 166,22 L 162,22 L 162,26 M 186,22 L 190,22 L 190,26 M 162,40 L 162,44 L 166,44 M 190,40 L 190,44 L 186,44"/>
        <circle cx="176" cy="33" r="14" stroke-dasharray="2 3" opacity="0.75"/>
        <line x1="158" y1="33" x2="194" y2="33" stroke-dasharray="1 3" opacity="0.6"/>
        <line x1="176" y1="15" x2="176" y2="51" stroke-dasharray="1 3" opacity="0.6"/>
      </g>
      <text x="194" y="24" fill="#ff3b30" font-family="'Press Start 2P', monospace" font-size="4.5">TRK 0.4s</text>
      <text x="194" y="32" fill="#ff9500" font-family="'Press Start 2P', monospace" font-size="4">FOX-2 LOCK</text>

      <!-- ENEMY BANDIT: Su-27 Flanker Evading Bank (Upper Right) -->
      <g transform="translate(176, 33) rotate(-28) scale(0.85)">
        <!-- Twin Afterburners -->
        <polygon points="-16,-5 -30,-4 -16,-3" fill="#ff5500"/>
        <polygon points="-16,3 -30,4 -16,5" fill="#ff5500"/>
        <polygon points="-15,-4 -24,-4 -15,-3" fill="#ffff88"/>
        <polygon points="-15,4 -24,4 -15,5" fill="#ffff88"/>
        <!-- Flanker Blended Wing-Body Silhouette -->
        <polygon points="26,0 12,5 4,11 -12,24 -16,14 -22,18 -18,6 -24,0 -18,-6 -22,-18 -16,-14 -12,-24 4,-11 12,-5" fill="#2d1b22" stroke="#ff3b30" stroke-width="1.4"/>
        <!-- Cockpit Glass -->
        <polygon points="14,0 4,3 0,0 4,-3" fill="#ff8888" opacity="0.9"/>
        <!-- Tail Stinger Probe -->
        <line x1="-18" y1="0" x2="-28" y2="0" stroke="#ff3b30" stroke-width="1.2"/>
        <!-- Flares / Decoy Sparkles Ejected -->
        <circle cx="-32" cy="-12" r="1.5" fill="#ffffff"/>
        <circle cx="-38" cy="-8" r="1.2" fill="#ffcc00"/>
        <circle cx="-44" cy="-16" r="1" fill="#ff6600"/>
      </g>

      <!-- AIM-9X Sidewinder Missile In Flight With Smoke Trail -->
      <path d="M 108,55 Q 135,46 162,37" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3 2" fill="none" opacity="0.85"/>
      <line x1="154" y1="40" x2="162" y2="37" stroke="#ffcc00" stroke-width="2.2"/>
      <polygon points="164,36 158,35 159,39" fill="#ffffff"/>

      <!-- PLAYER FIGHTER: F-22A Raptor in High-G Climb (Center Left) -->
      <g transform="translate(68, 62) rotate(-16)">
        <!-- Wingtip Vapor Vortices (High-G Turn Trails) -->
        <path d="M -16,-26 C -32,-30 -50,-33 -72,-34" stroke="#e0f7fa" stroke-width="1.2" fill="none" opacity="0.6" stroke-dasharray="2 2"/>
        <path d="M -16,26 C -32,30 -50,33 -72,34" stroke="#e0f7fa" stroke-width="1.2" fill="none" opacity="0.6" stroke-dasharray="2 2"/>

        <!-- Twin Vectoring Afterburner Plumes with Mach Diamonds -->
        <polygon points="-16,-4 -36,-3 -16,-1" fill="#ff5500"/>
        <polygon points="-16,1 -36,3 -16,4" fill="#ff5500"/>
        <polygon points="-15,-3 -28,-3 -15,-2" fill="#00f0ff"/>
        <polygon points="-15,2 -28,3 -15,3" fill="#00f0ff"/>
        <!-- Mach Shock Diamond cones -->
        <polygon points="-20,-3 -24,-2.5 -20,-2" fill="#ffffff"/>
        <polygon points="-20,2 -24,2.5 -20,3" fill="#ffffff"/>

        <!-- F-22 Stealth Fuselage & Diamond Delta Wings -->
        <polygon points="34,0 16,5 2,9 -16,26 -20,16 -28,20 -22,8 -24,0 -22,-8 -28,-20 -20,-16 -16,-26 2,-9 16,-5" fill="#1b2533" stroke="${color}" stroke-width="1.6"/>
        
        <!-- Panel Lines & Chine Edge Highlights -->
        <line x1="16" y1="-5" x2="-14" y2="-5" stroke="#334d66" stroke-width="0.8"/>
        <line x1="16" y1="5" x2="-14" y2="5" stroke="#334d66" stroke-width="0.8"/>
        <polygon points="6,0 -4,5 -12,0 -4,-5" fill="#131c26"/>

        <!-- Gold-Tinted Stealth Cockpit Canopy -->
        <polygon points="20,0 8,3.5 0,0 8,-3.5" fill="#00f0ff" stroke="#ffffff" stroke-width="0.6"/>

        <!-- Underwing Sidewinder Missiles -->
        <rect x="-12" y="-27" width="10" height="2" fill="#ffffff"/>
        <rect x="-12" y="25" width="10" height="2" fill="#ffffff"/>
      </g>

      <!-- HUD Flight Path & Energy Ladder -->
      <g stroke="#ffb700" stroke-width="0.9" opacity="0.65">
        <line x1="110" y1="48" x2="124" y2="48"/><line x1="134" y1="48" x2="148" y2="48"/>
        <line x1="114" y1="68" x2="124" y2="68"/><line x1="134" y1="68" x2="144" y2="68"/>
        <!-- Flight Path Marker (circle with wings) -->
        <circle cx="102" cy="56" r="3.5" fill="none"/>
        <line x1="94" y1="56" x2="98" y2="56"/>
        <line x1="106" y1="56" x2="110" y2="56"/>
        <line x1="102" y1="52" x2="102" y2="50"/>
      </g>

      <!-- Tactical Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>

      <!-- Typography & Telemetry -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">ACE VECTOR // DOGFIGHTER</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">MACH 2.4  ALT: 3,400 FT</text>
      <text x="226" y="112" text-anchor="end" fill="#00f0ff" font-family="'Press Start 2P', monospace" font-size="5.5">ENERGY FIGHT</text>
    </svg>`;
  }

  if (kind === "swarm") {
    // SWARMLINE — 8-bit Auto-Attack Roguelite Horde & Weapon Evolutions
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#09010a"/>
      <!-- Gothic Cobblestone Grid Floor -->
      <path d="M0 24h240M0 48h240M0 72h240M0 96h240" stroke="#ff007f" stroke-width="1" stroke-opacity="0.12"/>
      <path d="M24 0v120M48 0v120M72 0v120M96 0v120M120 0v120M144 0v120M168 0v120M192 0v120M216 0v120" stroke="#ff007f" stroke-width="1" stroke-opacity="0.12"/>
      <!-- Orbiting Sacred Books Ring (Unholy Vespers) -->
      <circle cx="120" cy="60" r="34" fill="none" stroke="#ff007f" stroke-width="1.2" stroke-dasharray="4 4"/>
      <rect x="114" y="22" width="12" height="8" fill="#00f0ff" stroke="#ffffff" stroke-width="1"/>
      <rect x="114" y="90" width="12" height="8" fill="#00f0ff" stroke="#ffffff" stroke-width="1"/>
      <rect x="82" y="56" width="8" height="12" fill="#00f0ff" stroke="#ffffff" stroke-width="1"/>
      <rect x="150" y="56" width="8" height="12" fill="#00f0ff" stroke="#ffffff" stroke-width="1"/>
      <!-- Holy Water Blue Flame Pool on Ground -->
      <ellipse cx="92" cy="74" rx="14" ry="6" fill="#00f0ff" opacity="0.35"/>
      <polygon points="90,74 94,66 96,74" fill="#00f0ff"/>
      <!-- Radiating Magic Projectiles & Arcane Lightning -->
      <line x1="120" y1="60" x2="52" y2="30" stroke="#ffff00" stroke-width="2.5"/>
      <line x1="120" y1="60" x2="188" y2="38" stroke="#ffff00" stroke-width="2.5"/>
      <line x1="120" y1="60" x2="170" y2="88" stroke="#ff007f" stroke-width="2"/>
      <polyline points="120,60 135,45 145,55 160,35" stroke="#00f0ff" stroke-width="1.5" fill="none"/>
      <!-- Center Survivor Hero (8-Bit Wizard in Robes) -->
      <g transform="translate(112, 46)">
        <!-- Pointed Hat -->
        <polygon points="8,-2 1,12 15,12" fill="#00f0ff"/>
        <rect x="0" y="11" width="16" height="3" fill="#0088ff"/>
        <!-- Face & Beard -->
        <rect x="5" y="14" width="6" height="6" fill="#ffe0bd"/>
        <rect x="4" y="18" width="8" height="4" fill="#ffffff"/>
        <!-- Robe & Staff -->
        <rect x="3" y="20" width="10" height="14" fill="#ff007f"/>
        <line x1="16" y1="10" x2="16" y2="34" stroke="#d2a679" stroke-width="2"/>
        <circle cx="16" cy="9" r="3" fill="#00f0ff"/>
      </g>
      <!-- Bat & Demon Swarm Horde Circling In -->
      <g fill="#ff0055">
        <polygon points="36,28 30,20 42,24"/><polygon points="36,28 42,20 30,24"/>
        <polygon points="52,42 46,34 58,38"/>
        <polygon points="194,36 188,28 200,32"/>
        <polygon points="208,54 202,46 214,50"/>
        <polygon points="186,82 180,74 192,78"/>
        <polygon points="60,82 54,74 66,78"/>
        <polygon points="32,64 26,56 38,60"/>
        <polygon points="216,80 210,72 222,76"/>
      </g>
      <!-- Scattered Glowing Blue & Green XP Gems -->
      <polygon points="86,38 90,42 86,46 82,42" fill="#00f0ff"/>
      <polygon points="152,34 156,38 152,42 148,38" fill="#00f0ff"/>
      <polygon points="98,86 102,90 98,94 94,90" fill="#00ff66"/>
      <polygon points="144,82 148,86 144,90 140,86" fill="#00ff66"/>
      <!-- Golden Vampire Chest with Upward Light Beam (Left) -->
      <rect x="18" y="78" width="14" height="10" fill="#ffd700" stroke="#ffffff" stroke-width="1"/>
      <line x1="25" y1="78" x2="25" y2="20" stroke="#ffd700" stroke-width="1.5" stroke-dasharray="2 2" stroke-opacity="0.6"/>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">SWARMLINE // BULLET HEAVEN</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">6 WEAPONS  8 EVOLUTIONS</text>
      <text x="226" y="112" text-anchor="end" fill="#ff007f" font-family="'Press Start 2P', monospace" font-size="5.5">SURVIVE 20:00</text>
    </svg>`;
  }

  if (kind === "tower") {
    // LAST TOWER — 8-bit Grid Maze Defense
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#010d05"/>
      <!-- Tactical Holographic Command Defense Matrix Grid -->
      <path d="M0 24h240M0 48h240M0 72h240M0 96h240" stroke="#00e676" stroke-width="1" stroke-opacity="0.15"/>
      <path d="M30 0v120M60 0v120M90 0v120M120 0v120M150 0v120M180 0v120M210 0v120" stroke="#00e676" stroke-width="1" stroke-opacity="0.15"/>
      <!-- Spawn Portal & Exit Portal -->
      <rect x="4" y="50" width="18" height="18" fill="none" stroke="#00f0ff" stroke-width="2"/>
      <rect x="7" y="53" width="12" height="12" fill="#00f0ff" opacity="0.6"/>
      <rect x="216" y="50" width="18" height="18" fill="none" stroke="#ff3333" stroke-width="2"/>
      <rect x="219" y="53" width="12" height="12" fill="#ff3333" opacity="0.6"/>
      <!-- Projected Dynamic A* Winding Maze Path -->
      <polyline points="22,59 60,59 60,34 120,34 120,86 180,86 180,59 216,59" fill="none" stroke="#00e676" stroke-width="3" stroke-dasharray="4 3"/>
      <!-- TOWERS ALONG THE MAZE -->
      <!-- Tower 1: Dual Gatling Turret -->
      <rect x="64" y="38" width="22" height="22" fill="#0a2612" stroke="#00e676" stroke-width="1.5"/>
      <circle cx="75" cy="49" r="6" fill="#00e676"/>
      <line x1="75" y1="49" x2="88" y2="40" stroke="#ffff00" stroke-width="2"/>
      <!-- Tower 2: Tesla Arc Coil (Branching Violet Lightning) -->
      <rect x="94" y="38" width="22" height="22" fill="#140a26" stroke="#9933ff" stroke-width="1.5"/>
      <circle cx="105" cy="49" r="6" fill="#9933ff"/>
      <polyline points="105,49 116,42 122,50 134,36" fill="none" stroke="#d946ef" stroke-width="1.8"/>
      <!-- Tower 3: Mortar / Heavy Cannon -->
      <rect x="124" y="62" width="22" height="22" fill="#291a08" stroke="#ffaa00" stroke-width="1.5"/>
      <circle cx="135" cy="73" r="7" fill="#ffaa00"/>
      <!-- Tower 4: Cryo Freeze Tower -->
      <rect x="154" y="38" width="22" height="22" fill="#051f2d" stroke="#00f0ff" stroke-width="1.5"/>
      <polygon points="165,42 169,49 161,49" fill="#00f0ff"/>
      <!-- Marching Robotic Invader Creeps & Boss Walker with HP Bar -->
      <circle cx="82" cy="34" r="4" fill="#ffff00" stroke="#000" stroke-width="1"/>
      <circle cx="100" cy="34" r="4" fill="#ffff00" stroke="#000" stroke-width="1"/>
      <circle cx="120" cy="58" r="8" fill="#ff2233" stroke="#000" stroke-width="1.5"/>
      <rect x="112" y="46" width="16" height="3" fill="#ff2233"/><rect x="112" y="46" width="10" height="3" fill="#00ff66"/>
      <!-- Defense Core Glow (Right) -->
      <circle cx="225" cy="59" r="16" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="2 2"/>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">LAST TOWER // GRID DEFENSE</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">DYNAMIC A*  6 TOWERS</text>
      <text x="226" y="112" text-anchor="end" fill="#10b981" font-family="'Press Start 2P', monospace" font-size="5.5">WAVE 30/30</text>
    </svg>`;
  }

  if (kind === "asteroid") {
    // ORE RUNNER — 8-bit Newtonian Asteroid Miner
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#040201"/>
      <!-- Deep Space Cosmic Dust & Starfield -->
      <rect x="18" y="18" width="1.5" height="1.5" fill="#ffffff"/><rect x="62" y="10" width="2" height="2" fill="#ffd700"/>
      <rect x="108" y="22" width="1" height="1" fill="#ffffff"/><rect x="138" y="14" width="2" height="2" fill="#00f0ff"/>
      <rect x="190" y="16" width="1.5" height="1.5" fill="#ffffff"/><rect x="226" y="24" width="2" height="2" fill="#ff7700"/>
      <!-- Distant Central Refinery Station Depot (Left) -->
      <g transform="translate(34, 60)">
        <circle cx="0" cy="0" r="26" fill="none" stroke="#f97316" stroke-width="1.5" stroke-dasharray="4 4"/>
        <circle cx="0" cy="0" r="16" fill="#1f0e04" stroke="#f97316" stroke-width="2"/>
        <rect x="-3" y="-3" width="6" height="6" fill="#00f0ff"/>
        <text x="0" y="4" text-anchor="middle" fill="#ffd700" font-family="'Press Start 2P', monospace" font-size="4.5">DEPOT</text>
      </g>
      <!-- Giant Cracking Unstable Core Asteroid (Right) -->
      <g transform="translate(182, 60)">
        <polygon points="-30,-16 -14,-30 20,-26 34,-8 30,20 10,30 -18,28 -30,8" fill="#ff2233" stroke="#ffffff" stroke-width="1.5"/>
        <!-- Molten Cracking Veins -->
        <polyline points="-14,-10 0,2 16,-6" stroke="#ffff00" stroke-width="2"/>
        <polyline points="0,2 -4,18 8,24" stroke="#ffff00" stroke-width="2"/>
        <circle cx="0" cy="2" r="4" fill="#ffffff"/>
        <text x="0" y="40" text-anchor="middle" fill="#ff3333" font-family="'Press Start 2P', monospace" font-size="5">DETONATION 4s!</text>
      </g>
      <!-- Mining Ship (Center) -->
      <g transform="translate(104, 58)">
        <!-- Cyan Mining Laser Beam Fracturing Rock -->
        <line x1="16" y1="0" x2="54" y2="2" stroke="#00f0ff" stroke-width="3"/>
        <line x1="16" y1="0" x2="54" y2="2" stroke="#ffffff" stroke-width="1"/>
        <!-- Ship Hull & Cargo Hold -->
        <polygon points="16,0 -12,11 -8,0 -12,-11" fill="#381b07" stroke="${color}" stroke-width="1.5"/>
        <!-- Cargo Pods Mounted on Sides -->
        <rect x="-6" y="-14" width="8" height="4" fill="#ffd700"/><rect x="-6" y="10" width="8" height="4" fill="#ffd700"/>
        <!-- Twin Retro-Thruster & Main Flame -->
        <polygon points="-10,-3 -20,0 -10,3" fill="#ffaa00"/>
        <polygon points="-8,-2 -16,0 -8,2" fill="#ffffff"/>
      </g>
      <!-- Floating Sparkling Ore Chunks -->
      <polygon points="132,48 138,44 140,50 134,54" fill="#ffd700"/>
      <polygon points="144,66 150,62 153,68 147,72" fill="#00f0ff"/>
      <polygon points="128,68 132,65 134,70 130,73" fill="#ffd700"/>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">ORE RUNNER // ASTEROID BELT</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">NEWTONIAN DRIFT  CARGO MASS</text>
      <text x="226" y="112" text-anchor="end" fill="#f97316" font-family="'Press Start 2P', monospace" font-size="5.5">BANK OR DIE</text>
    </svg>`;
  }

  if (kind === "doodle") {
    // SKYDOODLE — Dark Cosmic Cyber Climber
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <!-- Dark Cosmic Deep Space Background -->
      <rect width="240" height="120" fill="#040812"/>
      <!-- Subtle Nebula Center Glow -->
      <radialGradient id="sd-nebula" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stop-color="#0e2238" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#040812" stop-opacity="0"/>
      </radialGradient>
      <rect width="240" height="120" fill="url(#sd-nebula)"/>
      <!-- Subtle Altitude Grid Lines -->
      <path d="M0 24h240M0 48h240M0 72h240M0 96h240" stroke="#38bdf8" stroke-width="0.6" stroke-opacity="0.08" stroke-dasharray="2 3"/>
      <!-- Distant Twinkling Stars & Nebula Dust -->
      <rect x="20" y="32" width="1.5" height="1.5" fill="#38bdf8" opacity="0.6"/>
      <rect x="54" y="16" width="2" height="2" fill="#a3e635" opacity="0.75"/>
      <rect x="80" y="36" width="1" height="1" fill="#ffffff" opacity="0.8"/>
      <rect x="132" y="14" width="1.5" height="1.5" fill="#fbbf24" opacity="0.75"/>
      <rect x="176" y="46" width="2" height="2" fill="#38bdf8" opacity="0.6"/>
      <rect x="216" y="60" width="1.5" height="1.5" fill="#a3e635" opacity="0.8"/>
      <rect x="108" y="80" width="1" height="1" fill="#ffffff" opacity="0.5"/>
      <rect x="38" y="90" width="1.5" height="1.5" fill="#38bdf8" opacity="0.7"/>
      <rect x="194" y="84" width="2" height="2" fill="#fbbf24" opacity="0.65"/>
      <!-- Neon Altitude Ruler on Left (stops cleanly before bottom HUD) -->
      <line x1="32" y1="18" x2="32" y2="88" stroke="#38bdf8" stroke-width="1.2" stroke-opacity="0.35"/>
      <path d="M28 28h4M28 50h4M28 72h4" stroke="#38bdf8" stroke-width="1" stroke-opacity="0.6"/>
      <text x="26" y="31" text-anchor="end" fill="#38bdf8" font-family="'Press Start 2P', monospace" font-size="4" opacity="0.85">6000M</text>
      <text x="26" y="53" text-anchor="end" fill="#38bdf8" font-family="'Press Start 2P', monospace" font-size="4" opacity="0.85">4000M</text>
      <text x="26" y="75" text-anchor="end" fill="#38bdf8" font-family="'Press Start 2P', monospace" font-size="4" opacity="0.85">2000M</text>
      <!-- Best Record Notch -->
      <line x1="30" y1="42" x2="36" y2="42" stroke="#fbbf24" stroke-width="2"/>
      <polygon points="36,42 40,40 40,44" fill="#fbbf24"/>
      <text x="26" y="45" text-anchor="end" fill="#fbbf24" font-family="'Press Start 2P', monospace" font-size="4" font-weight="bold">BEST</text>
      <!-- Platforms -->
      <!-- 1. Neon Green Spring Platform (Bottom Center) -->
      <rect x="68" y="94" width="56" height="8" rx="3" fill="#14532d" stroke="#22c55e" stroke-width="1.5"/>
      <rect x="71" y="95" width="50" height="2" rx="1" fill="#86efac" opacity="0.85"/>
      <!-- Golden Spring Coil -->
      <path d="M96 94v-3h8v-3h-8v-3h8v-3" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <rect x="95" y="80" width="10" height="2" rx="1" fill="#f59e0b"/>
      <ellipse cx="100" cy="98" rx="16" ry="2.5" fill="#a3e635" opacity="0.25"/>
      <!-- 2. Cyber Jet Platform (Middle Right) -->
      <rect x="150" y="70" width="48" height="8" rx="3" fill="#0369a1" stroke="#38bdf8" stroke-width="1.5"/>
      <rect x="153" y="71" width="42" height="2" rx="1" fill="#bae6fd" opacity="0.9"/>
      <polygon points="155,74 159,71 159,77" fill="#ffffff"/>
      <polygon points="193,74 189,71 189,77" fill="#ffffff"/>
      <circle cx="147" cy="74" r="1.5" fill="#38bdf8" opacity="0.8"/>
      <circle cx="201" cy="74" r="1.5" fill="#38bdf8" opacity="0.8"/>
      <!-- 3. Cracking Magma Hazard Ledge (Middle Left) -->
      <rect x="46" y="52" width="40" height="7" rx="2" fill="#78350f" stroke="#f59e0b" stroke-width="1.2"/>
      <path d="M62 52l3 4-2 3" stroke="#ef4444" stroke-width="1.5" fill="none"/>
      <rect x="65" y="61" width="2" height="2" fill="#f59e0b" opacity="0.8"/>
      <rect x="61" y="63" width="1.5" height="1.5" fill="#ef4444" opacity="0.7"/>
      <!-- 4. High Altitude Emerald Ledge (Upper Right) -->
      <rect x="136" y="32" width="46" height="8" rx="3" fill="#15803d" stroke="#4ade80" stroke-width="1.5"/>
      <rect x="139" y="33" width="40" height="2" rx="1" fill="#bbf7d0" opacity="0.85"/>
      <!-- Alien Flying UFO in Upper Sky -->
      <g transform="translate(196, 20)">
        <polygon points="-7,4 7,4 18,22 -18,22" fill="#00f0ff" opacity="0.18"/>
        <ellipse cx="0" cy="0" rx="15" ry="5" fill="#334155" stroke="#94a3b8" stroke-width="1.5"/>
        <ellipse cx="0" cy="-2.5" rx="7" ry="4" fill="#38bdf8" stroke="#0284c7" stroke-width="1"/>
        <circle cx="0" cy="-3" r="1.8" fill="#a3e635"/>
        <circle cx="-7" cy="1" r="1.3" fill="#ef4444"/><circle cx="0" cy="1.3" r="1.3" fill="#fbbf24"/><circle cx="7" cy="1" r="1.3" fill="#38bdf8"/>
      </g>
      <!-- Floating Propeller Beanie Power-Up -->
      <g transform="translate(130, 26)">
        <circle cx="0" cy="0" r="4.5" fill="#1e1b4b" stroke="#a855f7" stroke-width="1"/>
        <path d="M-4 -1.5h8M0 -3.5v7" stroke="#facc15" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="0" cy="0" r="1.5" fill="#fbbf24"/>
      </g>
      <!-- Iconic Doodle Climber Character (Propelling Upward) -->
      <g transform="translate(100, 54)">
        <!-- Jump Jet Particles -->
        <polygon points="-5,14 -3,17 -7,17" fill="#fbbf24"/>
        <polygon points="5,14 7,17 3,17" fill="#fbbf24"/>
        <circle cx="0" cy="15" r="1.8" fill="#38bdf8" opacity="0.75"/>
        <circle cx="0" cy="20" r="1" fill="#38bdf8" opacity="0.5"/>
        <!-- Body -->
        <rect x="-9" y="-14" width="18" height="20" rx="5" fill="#a3e635" stroke="#166534" stroke-width="1.5"/>
        <rect x="-6" y="-6" width="12" height="10" rx="3" fill="#bef264" opacity="0.4"/>
        <!-- Snout Aimed Upward-Right -->
        <rect x="6" y="-10" width="8" height="6" rx="2" fill="#a3e635" stroke="#166534" stroke-width="1.2"/>
        <circle cx="13" cy="-7" r="1" fill="#166534"/>
        <!-- Eyes Tracking Target -->
        <circle cx="-1" cy="-8" r="2.8" fill="#ffffff" stroke="#052e16" stroke-width="0.8"/>
        <circle cx="0" cy="-9" r="1.3" fill="#000000"/>
        <circle cx="5" cy="-8" r="2.8" fill="#ffffff" stroke="#052e16" stroke-width="0.8"/>
        <circle cx="6" cy="-9" r="1.3" fill="#000000"/>
        <!-- 4 Cute Spring Legs -->
        <rect x="-8" y="6" width="3" height="5" rx="1" fill="#4d7c0f"/>
        <rect x="-3" y="6" width="3" height="4" rx="1" fill="#4d7c0f"/>
        <rect x="2" y="6" width="3" height="4" rx="1" fill="#4d7c0f"/>
        <rect x="6" y="6" width="3" height="5" rx="1" fill="#4d7c0f"/>
        <!-- Energy Pellet Fired from Snout -->
        <circle cx="22" cy="-14" r="2" fill="#38bdf8" stroke="#e0f2fe" stroke-width="0.5"/>
        <line x1="16" y1="-10" x2="20" y2="-13" stroke="#38bdf8" stroke-width="1" opacity="0.7"/>
      </g>
      <!-- Neon Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="#a3e635" stroke-width="1.5" stroke-opacity="0.7" fill="none"/>
      <!-- Typography & Telemetry (Spaced with Zero Collisions) -->
      <text x="14" y="14" fill="#a3e635" font-family="'Press Start 2P', monospace" font-size="6">SKYDOODLE</text>
      <text x="226" y="14" text-anchor="end" fill="#38bdf8" font-family="'Press Start 2P', monospace" font-size="5.2">ALT: 5,420M</text>
      <text x="14" y="112" fill="rgba(163,230,53,0.85)" font-family="'Press Start 2P', monospace" font-size="4.8">AUTO-BOUNCE • GYRO TILT</text>
      <text x="226" y="112" text-anchor="end" fill="#fbbf24" font-family="'Press Start 2P', monospace" font-size="4.8">RECORD: 8,950M</text>
    </svg>`;
  }

  if (kind === "sudoku") {
    // GRIDLOCK — Phosphor Terminal 9x9 Sudoku Matrix
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#020b04"/>
      <!-- Subtle Phosphor Scanlines -->
      <path d="M0 6h240M0 14h240M0 22h240M0 30h240M0 38h240M0 46h240M0 54h240M0 62h240M0 70h240M0 78h240M0 86h240M0 94h240M0 102h240M0 110h240" stroke="#00ff41" stroke-width="1" stroke-opacity="0.07"/>
      <!-- 9x9 Sudoku Board Container -->
      <g transform="translate(74, 15)">
        <rect x="0" y="0" width="90" height="90" fill="#041208" stroke="#00ff41" stroke-width="2"/>
        <!-- Thin Cell Grid Lines -->
        <path d="M10 0v90M20 0v90M40 0v90M50 0v90M70 0v90M80 0v90" stroke="#00ff41" stroke-width="0.75" stroke-opacity="0.25"/>
        <path d="M0 10h90M0 20h90M0 40h90M0 50h90M0 70h90M0 80h90" stroke="#00ff41" stroke-width="0.75" stroke-opacity="0.25"/>
        <!-- Bold 3x3 Box Dividers -->
        <line x1="30" y1="0" x2="30" y2="90" stroke="#00ff41" stroke-width="1.8"/>
        <line x1="60" y1="0" x2="60" y2="90" stroke="#00ff41" stroke-width="1.8"/>
        <line x1="0" y1="30" x2="90" y2="30" stroke="#00ff41" stroke-width="1.8"/>
        <line x1="0" y1="60" x2="90" y2="60" stroke="#00ff41" stroke-width="1.8"/>
        <!-- Selected Active Cell with Corner Reticles & Glow -->
        <rect x="30" y="30" width="10" height="10" fill="#00ff41" fill-opacity="0.3" stroke="#55ff77" stroke-width="1.5"/>
        <!-- Peer Crosshair Row & Col Highlighting -->
        <rect x="0" y="30" width="90" height="10" fill="#00ff41" fill-opacity="0.08"/>
        <rect x="30" y="0" width="10" height="90" fill="#00ff41" fill-opacity="0.08"/>
        <!-- Glowing Phosphor Digits -->
        <text x="5" y="8" fill="#00aa30" font-family="'Press Start 2P', monospace" font-size="6.5">5</text>
        <text x="15" y="8" fill="#00ff41" font-family="'Press Start 2P', monospace" font-size="6.5" font-weight="bold">3</text>
        <text x="45" y="8" fill="#00aa30" font-family="'Press Start 2P', monospace" font-size="6.5">7</text>
        <text x="5" y="28" fill="#00aa30" font-family="'Press Start 2P', monospace" font-size="6.5">6</text>
        <text x="45" y="28" fill="#00ff41" font-family="'Press Start 2P', monospace" font-size="6.5" font-weight="bold">9</text>
        <text x="75" y="28" fill="#00aa30" font-family="'Press Start 2P', monospace" font-size="6.5">8</text>
        <text x="15" y="48" fill="#00ff41" font-family="'Press Start 2P', monospace" font-size="6.5" font-weight="bold">8</text>
        <text x="35" y="38" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="7" font-weight="bold">7</text>
        <text x="75" y="48" fill="#00ff41" font-family="'Press Start 2P', monospace" font-size="6.5" font-weight="bold">2</text>
        <text x="5" y="68" fill="#00aa30" font-family="'Press Start 2P', monospace" font-size="6.5">8</text>
        <text x="45" y="78" fill="#00ff41" font-family="'Press Start 2P', monospace" font-size="6.5" font-weight="bold">6</text>
        <text x="85" y="88" fill="#00aa30" font-family="'Press Start 2P', monospace" font-size="6.5">9</text>
      </g>
      <!-- Telemetry Readouts Left & Right -->
      <g fill="#00ff41" font-family="'Press Start 2P', monospace" font-size="5" opacity="0.85">
        <text x="12" y="30">SYS: LOGIC</text>
        <text x="12" y="44">TIER: EXPERT</text>
        <text x="12" y="58">HINTS: 0/3</text>
        <text x="12" y="72">TIME: 03:42</text>
        <text x="172" y="30">WORKER: OK</text>
        <text x="172" y="44">SOL: UNIQUE</text>
        <text x="172" y="58">MISTAKES: 0</text>
        <text x="172" y="72">BONUS: 1.5X</text>
      </g>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="#00ff41" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="#00ff41" font-family="'Press Start 2P', monospace" font-size="6.5">GRIDLOCK // TERMINAL SUDOKU</text>
      <text x="14" y="112" fill="rgba(0,255,65,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">PENCIL MODE  PEER HIGHLIGHT  DAILY</text>
      <text x="226" y="112" text-anchor="end" fill="#00ff41" font-family="'Press Start 2P', monospace" font-size="5.5">9X9 MATRIX</text>
    </svg>`;
  }

  if (kind === "dino") {
    // TERAFORM RUN — 1-Bit Monochrome Endless Runner
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="240" height="120" fill="#000000"/>
      <!-- Moon & Twinkling Stars in 1-Bit Night Sky -->
      <circle cx="206" cy="22" r="10" fill="#ffffff"/>
      <circle cx="202" cy="20" r="8" fill="#000000"/>
      <rect x="22" y="14" width="2" height="2" fill="#ffffff"/><rect x="70" y="24" width="2" height="2" fill="#ffffff"/>
      <rect x="134" y="12" width="2" height="2" fill="#ffffff"/><rect x="168" y="26" width="1" height="1" fill="#ffffff"/>
      <!-- Prehistoric Pterodactyl in Flight (Mid-Sky) -->
      <g transform="translate(182, 38)">
        <polygon points="12,6 0,0 -8,4 -14,-4 -4,-2 4,2 10,4" fill="#ffffff"/>
        <polygon points="-4,-2 6,4 4,12 -2,6" fill="#ffffff"/>
        <rect x="12" y="5" width="4" height="2" fill="#ffffff"/>
      </g>
      <!-- Dotted Desert Ground Line -->
      <line x1="0" y1="92" x2="240" y2="92" stroke="#ffffff" stroke-width="2"/>
      <!-- Pixel Ground Texture Bumps & Pebbles -->
      <rect x="20" y="96" width="6" height="2" fill="#ffffff"/><rect x="66" y="98" width="8" height="2" fill="#ffffff"/>
      <rect x="108" y="95" width="4" height="2" fill="#ffffff"/><rect x="152" y="97" width="10" height="2" fill="#ffffff"/>
      <rect x="210" y="96" width="5" height="2" fill="#ffffff"/>
      <!-- 1-Bit Pixel T-Rex Runner (X=40, Y=60) -->
      <g transform="translate(40, 58)" fill="#ffffff">
        <!-- Head & Snout -->
        <rect x="14" y="0" width="14" height="8"/>
        <rect x="14" y="8" width="10" height="4"/>
        <rect x="16" y="2" width="2" height="2" fill="#000000"/>
        <rect x="22" y="6" width="6" height="2" fill="#000000"/>
        <!-- Neck & Body -->
        <rect x="8" y="8" width="8" height="14"/>
        <rect x="4" y="12" width="12" height="12"/>
        <rect x="0" y="14" width="6" height="8"/>
        <!-- Small Arms -->
        <rect x="18" y="14" width="4" height="2"/><rect x="20" y="16" width="2" height="3"/>
        <!-- Tail -->
        <rect x="-4" y="16" width="6" height="4"/><rect x="-8" y="14" width="6" height="3"/>
        <!-- Running Legs -->
        <rect x="4" y="24" width="3" height="7"/><rect x="2" y="31" width="5" height="2"/>
        <rect x="11" y="24" width="3" height="9"/><rect x="11" y="31" width="4" height="2"/>
        <!-- Running Dust Puff Particles behind feet -->
        <rect x="-6" y="28" width="2" height="2" fill="#ffffff"/><rect x="-10" y="26" width="3" height="2" fill="#ffffff"/>
      </g>
      <!-- Triple Saguaro Cactus Cluster Obstacle Ahead (X=120, Y=66) -->
      <g transform="translate(120, 66)" fill="#ffffff">
        <!-- Center Large Cactus -->
        <rect x="8" y="0" width="5" height="26"/>
        <rect x="2" y="6" width="6" height="3"/><rect x="2" y="6" width="3" height="8"/>
        <rect x="13" y="10" width="6" height="3"/><rect x="16" y="4" width="3" height="9"/>
        <!-- Left Small Cactus -->
        <rect x="-6" y="8" width="4" height="18"/>
        <rect x="-10" y="13" width="4" height="2"/><rect x="-10" y="11" width="2" height="4"/>
        <!-- Right Small Cactus -->
        <rect x="24" y="10" width="4" height="16"/>
        <rect x="28" y="15" width="4" height="2"/><rect x="30" y="13" width="2" height="4"/>
      </g>
      <!-- Pixel Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="#ffffff" stroke-width="1.5" fill="none"/>
      <!-- Typography -->
      <text x="14" y="14" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="6.5">TERAFORM RUN // 1-BIT DINO</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">MULTI-BOX HITBOX  FAST-FALL SLAM</text>
      <text x="226" y="112" text-anchor="end" fill="#ffffff" font-family="'Press Start 2P', monospace" font-size="5.5">HI 09840</text>
    </svg>`;
  }

  if (kind === "ironclad") {
    // IRONCLAD — Side-View Naval RTS Battlecruiser Duel at Sunset
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <defs>
        <linearGradient id="ironcladSunset" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#180a1e"/>
          <stop offset="38%" stop-color="#4a1525"/>
          <stop offset="65%" stop-color="#8c2e1b"/>
          <stop offset="78%" stop-color="#c96f24"/>
          <stop offset="100%" stop-color="#24384d"/>
        </linearGradient>
        <linearGradient id="ironcladSea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f263d"/>
          <stop offset="100%" stop-color="#040b12"/>
        </linearGradient>
      </defs>

      <!-- Flooded World Sunset Sky -->
      <rect width="240" height="88" fill="url(#ironcladSunset)"/>
      
      <!-- Sinking Industrial Sun -->
      <circle cx="120" cy="72" r="22" fill="#ffb830" opacity="0.85"/>
      <circle cx="120" cy="72" r="16" fill="#ffe066"/>

      <!-- Distant Industrial Ruins / Sunken Cranes Silhouette -->
      <polygon points="102,88 106,62 108,62 110,88" fill="#1f1124" opacity="0.6"/>
      <polygon points="132,88 135,66 137,66 140,88" fill="#1f1124" opacity="0.6"/>
      <line x1="104" y1="68" x2="118" y2="68" stroke="#1f1124" stroke-width="1" opacity="0.6"/>

      <!-- Ocean Sea Body -->
      <rect x="0" y="88" width="240" height="32" fill="url(#ironcladSea)"/>
      <line x1="0" y1="88" x2="240" y2="88" stroke="#4682b4" stroke-width="1.2" opacity="0.8"/>
      <!-- Water Waves Shimmer -->
      <line x1="14" y1="94" x2="52" y2="94" stroke="#00f0ff" stroke-width="0.8" opacity="0.4"/>
      <line x1="82" y1="92" x2="158" y2="92" stroke="#ffb830" stroke-width="1" opacity="0.5"/>
      <line x1="184" y1="95" x2="226" y2="95" stroke="#ff3344" stroke-width="0.8" opacity="0.4"/>

      <!-- ALLIED BATTLECRUISER (Left: X=12 to 84, Waterline Y=88) -->
      <g transform="translate(12, 54)">
        <!-- Hex Shield Dome (Over midship deck) -->
        <path d="M 12,34 A 32,28 0 0,1 62,34" fill="none" stroke="#00f0ff" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.8"/>
        
        <!-- Hull Armor Plates -->
        <polygon points="0,34 10,24 64,24 74,34" fill="#112233" stroke="#4682b4" stroke-width="1.4"/>
        <line x1="16" y1="29" x2="58" y2="29" stroke="#1b3652" stroke-width="1"/>
        
        <!-- Superstructure Decks & Mast -->
        <rect x="18" y="16" width="34" height="8" fill="#1b3652" stroke="#4682b4" stroke-width="1"/>
        <rect x="28" y="8" width="14" height="8" fill="#234568" stroke="#4682b4" stroke-width="1"/>
        <!-- Tall Radar Mast -->
        <line x1="35" y1="8" x2="35" y2="0" stroke="#4682b4" stroke-width="1.2"/>
        <line x1="31" y1="2" x2="39" y2="2" stroke="#00f0ff" stroke-width="1"/>

        <!-- Forward Deck Artillery Turret -->
        <polygon points="54,20 62,20 64,24 52,24" fill="#334e68"/>
        <line x1="60" y1="21" x2="72" y2="13" stroke="#4682b4" stroke-width="1.8"/>

        <!-- Bow Ion Cannon Mount -->
        <rect x="68" y="30" width="8" height="4" fill="#00f0ff"/>

        <!-- Midship LasCannon Structure -->
        <rect x="22" y="11" width="6" height="5" fill="#334e68"/>
        <line x1="28" y1="13" x2="42" y2="5" stroke="#00f0ff" stroke-width="1.5"/>

        <!-- Builder Drones Hovering -->
        <circle cx="16" cy="6" r="2" fill="#ffd700"/>
        <line x1="16" y1="8" x2="20" y2="14" stroke="#ffd700" stroke-width="0.8" stroke-dasharray="1 1"/>
        <circle cx="48" cy="2" r="2" fill="#ffd700"/>
      </g>

      <!-- LasCannon Continuous Beam (Cyan) from Left to Right -->
      <line x1="54" y1="59" x2="182" y2="68" stroke="#00f0ff" stroke-width="1.8"/>
      <line x1="54" y1="59" x2="182" y2="68" stroke="#ffffff" stroke-width="0.8"/>

      <!-- Artillery Shell Ballistic Arc (Amber) -->
      <path d="M 84,67 Q 135,26 186,64" fill="none" stroke="#ffb830" stroke-width="1.2" stroke-dasharray="3 3"/>
      <circle cx="140" cy="38" r="2" fill="#ffffff"/>
      <circle cx="140" cy="38" r="3.5" fill="none" stroke="#ffb830" stroke-width="0.8"/>

      <!-- ENEMY BATTLECRUISER (Right: X=166 to 228, Waterline Y=88) -->
      <g transform="translate(166, 52)">
        <!-- Red Shield Impact Flash -->
        <path d="M 6,36 A 28,24 0 0,1 48,36" fill="none" stroke="#ff3344" stroke-width="1" stroke-dasharray="2 2" opacity="0.65"/>
        <circle cx="16" cy="16" r="4" fill="#ff3344" opacity="0.8"/>
        
        <!-- Dark Red Hull -->
        <polygon points="6,36 16,26 62,26 62,36" fill="#221118" stroke="#ff3344" stroke-width="1.4"/>
        <rect x="22" y="16" width="30" height="10" fill="#381822" stroke="#ff3344" stroke-width="1"/>
        <rect x="30" y="8" width="14" height="8" fill="#4d1f2d" stroke="#ff3344" stroke-width="1"/>
        <line x1="37" y1="8" x2="37" y2="2" stroke="#ff3344" stroke-width="1.2"/>

        <!-- Heavy Mortar Turret firing -->
        <line x1="22" y1="22" x2="12" y2="15" stroke="#ff3344" stroke-width="2"/>
        <circle cx="10" cy="13" r="3" fill="#ffaa00"/>

        <!-- Rear Flak Battery -->
        <line x1="54" y1="20" x2="48" y2="10" stroke="#ff3344" stroke-width="1.5"/>
      </g>

      <!-- Autonomous AttackRIB in Water Midfield -->
      <polygon points="112,88 116,84 124,84 126,88" fill="#00f0ff"/>
      <line x1="110" y1="88" x2="104" y2="88" stroke="#ffffff" stroke-width="1" opacity="0.7"/>

      <!-- Flak Smoke Puffs in Sky -->
      <circle cx="150" cy="48" r="3" fill="#ffffff" opacity="0.4"/>
      <circle cx="153" cy="46" r="2" fill="#ff7700" opacity="0.6"/>

      <!-- Tactical Corner Brackets -->
      <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>

      <!-- Typography -->
      <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">IRONCLAD // NAVAL RTS</text>
      <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">DRONES: 6/6  TECH LAB: READY</text>
      <text x="226" y="112" text-anchor="end" fill="#ffb830" font-family="'Press Start 2P', monospace" font-size="5.5">SIDE-VIEW RTS</text>
    </svg>`;
  }

  // DEFAULT / "dome" — MARS BASE (8-bit Space Colony & Red Planet Outpost)
  return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
    <rect width="240" height="120" fill="#050206"/>
    <!-- Pixel Stars in Black Martian Sky -->
    <rect x="22" y="16" width="2" height="2" fill="#ffffff"/>
    <rect x="68" y="10" width="2" height="2" fill="#ffd5a0"/>
    <rect x="110" y="20" width="1" height="1" fill="#ffffff"/>
    <rect x="156" y="12" width="2" height="2" fill="#ffffff"/>
    <rect x="180" y="24" width="1" height="1" fill="#ffd5a0"/>
    <rect x="226" y="14" width="2" height="2" fill="#ffffff"/>
    <!-- 8-Bit Pixel Moons (Phobos & Deimos) -->
    <rect x="194" y="16" width="8" height="8" fill="#8a756b"/>
    <rect x="196" y="18" width="2" height="2" fill="#52443f"/>
    <rect x="200" y="20" width="2" height="2" fill="#52443f"/>
    <rect x="216" y="28" width="3" height="3" fill="#66524b"/>
    <!-- Stepped Distant Mountain Horizons -->
    <polygon points="0,78 36,66 74,72 120,60 166,70 208,64 240,74 240,120 0,120" fill="#210603"/>
    <polygon points="0,84 46,76 96,82 142,74 186,80 240,77 240,120 0,120" fill="#3a1008"/>
    <!-- Foreground Martian Regolith with Checkerboard Dither -->
    <rect x="0" y="88" width="240" height="32" fill="#5c1605"/>
    <path d="M0 88H240M0 96H240M0 104H240M0 112H240" stroke="#8a2205" stroke-width="1"/>
    <!-- Dither blocks for coarse Martian soil -->
    <g fill="#eb4412" opacity="0.6">
      <rect x="4" y="90" width="4" height="2"/>
      <rect x="16" y="92" width="4" height="2"/>
      <rect x="32" y="90" width="4" height="2"/>
      <rect x="64" y="94" width="4" height="2"/>
      <rect x="180" y="92" width="4" height="2"/>
      <rect x="212" y="90" width="4" height="2"/>
      <rect x="232" y="94" width="4" height="2"/>
      <rect x="12" y="100" width="4" height="2"/>
      <rect x="48" y="102" width="4" height="2"/>
      <rect x="160" y="100" width="4" height="2"/>
      <rect x="198" y="102" width="4" height="2"/>
    </g>
    <!-- 8-BIT MARS ROVER (Left, X=36, Y=78) -->
    <g transform="translate(36, 78)">
      <!-- Chassis -->
      <rect x="4" y="6" width="22" height="8" fill="#ffd700" stroke="${color}" stroke-width="1"/>
      <!-- Mastcam Antenna & Red Beacon -->
      <line x1="20" y1="6" x2="20" y2="-4" stroke="${color}" stroke-width="1.5"/>
      <rect x="19" y="-6" width="3" height="3" fill="#ff2233"/>
      <!-- Headlight Beam (Dithered yellow) -->
      <polygon points="26,8 44,5 44,14 26,11" fill="#ffff55" opacity="0.3"/>
      <!-- 6 Blocky Wheels -->
      <rect x="2" y="12" width="5" height="5" fill="#111115"/>
      <rect x="12" y="12" width="5" height="5" fill="#111115"/>
      <rect x="22" y="12" width="5" height="5" fill="#111115"/>
    </g>
    <!-- 8-BIT GEODESIC HABITAT DOME (Center, X=88 to 152, Y=54 to 88) -->
    <g transform="translate(88, 54)">
      <!-- Stepped Outer Dome Arc -->
      <rect x="16" y="0" width="32" height="4" fill="${color}"/>
      <rect x="10" y="4" width="44" height="6" fill="${color}"/>
      <rect x="6" y="10" width="52" height="8" fill="${color}"/>
      <rect x="2" y="18" width="60" height="8" fill="${color}"/>
      <rect x="0" y="26" width="64" height="8" fill="${color}"/>
      <!-- Inner Dome Chamber (Dark Transparent Glass) -->
      <rect x="18" y="2" width="28" height="4" fill="#0e0508"/>
      <rect x="12" y="6" width="40" height="6" fill="#0e0508"/>
      <rect x="8" y="12" width="48" height="8" fill="#0e0508"/>
      <rect x="4" y="20" width="56" height="8" fill="#0e0508"/>
      <rect x="2" y="28" width="60" height="6" fill="#0e0508"/>
      <!-- Structural Struts -->
      <line x1="32" y1="2" x2="32" y2="34" stroke="${color}" stroke-width="1"/>
      <line x1="32" y1="2" x2="12" y2="34" stroke="${color}" stroke-width="1"/>
      <line x1="32" y1="2" x2="52" y2="34" stroke="${color}" stroke-width="1"/>
      <line x1="8" y1="20" x2="56" y2="20" stroke="${color}" stroke-width="1"/>
      <!-- Glowing Green Hydroponic Crops Inside -->
      <rect x="16" y="24" width="8" height="6" fill="#00ff66"/>
      <rect x="40" y="24" width="8" height="6" fill="#00ff66"/>
      <rect x="18" y="22" width="4" height="3" fill="#afffd0"/>
      <rect x="42" y="22" width="4" height="3" fill="#afffd0"/>
      <!-- Illuminated Golden Airlock Portal -->
      <rect x="26" y="24" width="12" height="10" fill="#ffd700" stroke="${color}" stroke-width="1"/>
      <rect x="29" y="26" width="6" height="8" fill="#ff7700"/>
    </g>
    <!-- 8-BIT SOLAR ARRAYS (Right, X=168, Y=68) -->
    <g transform="translate(168, 68)">
      <!-- Panel 1 -->
      <polygon points="0,14 10,2 24,2 14,14" fill="#082038" stroke="#00f0ff" stroke-width="1"/>
      <line x1="6" y1="7" x2="18" y2="7" stroke="#00f0ff" stroke-width="0.5"/>
      <rect x="6" y="14" width="2" height="8" fill="#556677"/>
      <!-- Panel 2 -->
      <polygon points="18,14 28,2 42,2 32,14" fill="#082038" stroke="#00f0ff" stroke-width="1"/>
      <line x1="24" y1="7" x2="36" y2="7" stroke="#00f0ff" stroke-width="0.5"/>
      <rect x="24" y="14" width="2" height="8" fill="#556677"/>
    </g>
    <!-- Pixel Corner Brackets -->
    <path d="M4 12V4H12M228 4H236V12M4 108V116H12M228 116H236V108" stroke="${color}" stroke-width="1.5" fill="none"/>
    <!-- Typography -->
    <text x="14" y="14" fill="${color}" font-family="'Press Start 2P', monospace" font-size="6.5">MARS BASE // SOL 042</text>
    <text x="14" y="112" fill="rgba(255,255,255,0.7)" font-family="'Press Start 2P', monospace" font-size="5.5">O2: 98%  HAB: OK</text>
    <text x="226" y="112" text-anchor="end" fill="#00ff66" font-family="'Press Start 2P', monospace" font-size="5.5">COLONY 100%</text>
  </svg>`;
}
