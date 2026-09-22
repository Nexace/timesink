// Scientific checkpoints and helper functions for Scale Jump // Powers of Ten

export const CATEGORIES = [
  { id: "quantum", label: "QUANTUM", log: -35, color: "#a855f7" },
  { id: "subatomic", label: "SUBATOMIC", log: -18, color: "#c084fc" },
  { id: "atomic", label: "ATOMIC", log: -10, color: "#00f0ff" },
  { id: "cellular", label: "CELLULAR", log: -6, color: "#22c55e" },
  { id: "human", label: "HUMAN", log: 0, color: "#ffd166" },
  { id: "planetary", label: "PLANETARY", log: 7, color: "#f97316" },
  { id: "stellar", label: "STELLAR", log: 11, color: "#ef4444" },
  { id: "galactic", label: "GALACTIC", log: 18, color: "#ec4899" },
  { id: "cosmic", label: "COSMIC", log: 25, color: "#38bdf8" },
];

export const COMPARE_PRESETS = [
  { name: "Atom vs Cathedral", a: "atom_hydrogen", b: "pitch", note: "If an atom were a stadium, its nucleus would be a marble at the center." },
  { name: "DNA vs Human Hair", a: "dna", b: "hair", note: "A single human hair is roughly 40,000 DNA double-helices wide." },
  { name: "Human vs Planet Earth", a: "human", b: "earth", note: "Earth is approximately 7.28 million human bodies tall stacked end-to-end." },
  { name: "The Sun vs Milky Way", a: "sun", b: "milkyway", note: "The Milky Way is about 720 billion times wider than our Sun." },
  { name: "Virus vs Blue Whale", a: "virus_sars", b: "whale", note: "A blue whale is 300 million times longer than a single coronavirus particle." },
  { name: "Neutron Star vs Grand Canyon", a: "neutron_star", b: "grand_canyon", note: "A neutron star could sit comfortably inside the Grand Canyon." },
];

export const CHECKPOINTS = [
  // ── QUANTUM REGIME (10^-35 to 10^-20) ─────────────────────────
  {
    id: "planck",
    name: "Planck Length",
    category: "quantum",
    log: -35,
    exactM: 1.616e-35,
    metric: "1.6 × 10⁻³⁵ m",
    imperial: "6.36 × 10⁻³⁴ in",
    fact: "The theoretical minimum limit of physical measurement in quantum physics. Below this scale, spacetime becomes an untamable quantum foam.",
    analogy: "If a single proton were magnified to the size of the entire observable universe, the Planck length would still be smaller than a grain of sand inside it.",
    draw: (c) => `
      <defs>
        <radialGradient id="pl_g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff" stop-opacity="0.9"/>
          <stop offset="40%" stop-color="${c}" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#020308" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="48" fill="url(#pl_g)"/>
      <rect x="56" y="56" width="8" height="8" fill="#fff" stroke="${c}" stroke-width="1.5"/>
      <path d="M40 60h40M60 40v40" stroke="${c}" stroke-dasharray="2 3" opacity="0.6"/>
      <circle cx="60" cy="60" r="28" fill="none" stroke="${c}" stroke-dasharray="3 3" opacity="0.5"/>
    `,
  },
  {
    id: "string",
    name: "String Theory String",
    category: "quantum",
    log: -34,
    exactM: 1.0e-34,
    metric: "1.0 × 10⁻³⁴ m",
    imperial: "3.94 × 10⁻³³ in",
    fact: "In theoretical physics, fundamental matter is not point-like particles, but 1-dimensional vibrating loops of pure energy.",
    analogy: "Different vibrational frequencies produce different particles—just as different notes on a violin string create different musical pitches.",
    draw: (c) => `
      <defs>
        <linearGradient id="st_g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff00ff"/>
          <stop offset="50%" stop-color="${c}"/>
          <stop offset="100%" stop-color="#00ffff"/>
        </linearGradient>
      </defs>
      <path d="M25 60 Q40 30, 60 60 T95 60 Q80 90, 60 60 T25 60" fill="none" stroke="url(#st_g)" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="60" cy="60" r="3" fill="#fff"/>
      <circle cx="42" cy="45" r="2" fill="${c}" opacity="0.8"/>
      <circle cx="78" cy="75" r="2" fill="#ff00ff" opacity="0.8"/>
    `,
  },
  {
    id: "gut_scale",
    name: "GUT Unification Scale",
    category: "quantum",
    log: -32,
    exactM: 1.0e-32,
    metric: "1.0 × 10⁻³² m",
    imperial: "3.94 × 10⁻³¹ in",
    fact: "The threshold where the strong nuclear, weak nuclear, and electromagnetic forces merge into one unified interaction.",
    analogy: "These conditions last existed just 10⁻³⁶ seconds after the Big Bang, during the cosmic inflationary burst.",
    draw: (c) => `
      <polygon points="60,25 95,85 25,85" fill="none" stroke="${c}" stroke-width="2.5"/>
      <circle cx="60" cy="25" r="6" fill="#a855f7"/>
      <circle cx="95" cy="85" r="6" fill="#00f0ff"/>
      <circle cx="25" cy="85" r="6" fill="#ffd166"/>
      <circle cx="60" cy="65" r="10" fill="none" stroke="#fff" stroke-dasharray="3 2"/>
      <circle cx="60" cy="65" r="3" fill="#fff"/>
    `,
  },
  {
    id: "planck_mass_radius",
    name: "Planck Mass Horizon",
    category: "quantum",
    log: -30,
    exactM: 1.0e-30,
    metric: "1.0 × 10⁻³⁰ m",
    imperial: "3.94 × 10⁻²⁹ in",
    fact: "The theoretical event horizon radius of a micro black hole possessing the Planck mass (21.8 micrograms).",
    analogy: "At this scale, general relativity and quantum mechanics collide: a particle's Compton wavelength equals its gravitational horizon.",
    draw: (c) => `
      <circle cx="60" cy="60" r="32" fill="#000" stroke="${c}" stroke-width="2.5"/>
      <ellipse cx="60" cy="60" rx="46" ry="16" fill="none" stroke="#ffd166" stroke-width="2" transform="rotate(-20 60 60)"/>
      <circle cx="60" cy="60" r="4" fill="#fff"/>
      <text x="60" y="110" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">QUANTUM GRAVITY</text>
    `,
  },
  {
    id: "neutrino_wave",
    name: "Cosmic Ray Neutrino Wavelength",
    category: "quantum",
    log: -28,
    exactM: 1.0e-28,
    metric: "1.0 × 10⁻²⁸ m",
    imperial: "3.94 × 10⁻²⁷ in",
    fact: "The quantum de Broglie wavelength of ultra-high-energy PeV cosmic neutrinos recorded in deep Antarctic ice.",
    analogy: "A wavelength so unimaginably narrow that the particle travels through millions of light-years of solid rock without deflection.",
    draw: (c) => `
      <path d="M15 60 Q26 40, 37 60 T59 60 T81 60 T103 60" fill="none" stroke="${c}" stroke-width="2"/>
      <circle cx="60" cy="60" r="4" fill="#fff"/>
      <line x1="20" y1="75" x2="100" y2="75" stroke="${c}" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>
    `,
  },
  {
    id: "uher_proton",
    name: "Ultra-High Energy Cosmic Ray",
    category: "quantum",
    log: -26,
    exactM: 1.0e-26,
    metric: "1.0 × 10⁻²⁶ m",
    imperial: "3.94 × 10⁻²⁵ in",
    fact: "The quantum wavelength of the 'Oh-My-God' particle—a cosmic ray proton traveling at 99.99999999999999999999951% the speed of light.",
    analogy: "A single microscopic subatomic particle carrying the kinetic impact energy of a fast-pitch baseball thrown at 100 km/h.",
    draw: (c) => `
      <line x1="15" y1="60" x2="105" y2="60" stroke="#ef4444" stroke-width="3"/>
      <circle cx="60" cy="60" r="8" fill="#ffd166"/>
      <polygon points="105,60 92,52 92,68" fill="#ef4444"/>
      <text x="60" y="95" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">v ≈ 0.999999999 c</text>
    `,
  },
  {
    id: "neutrino_cross",
    name: "Neutrino Interaction Radius",
    category: "quantum",
    log: -24,
    exactM: 1.0e-24,
    metric: "1.0 × 10⁻²⁴ m",
    imperial: "3.94 × 10⁻²³ in",
    fact: "The tiny effective cross-section through which a low-energy neutrino interacts via the weak nuclear force.",
    analogy: "About 100 trillion neutrinos from the Sun pass through your thumbnail every second without touching a single cell.",
    draw: (c) => `
      <circle cx="60" cy="60" r="36" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.4"/>
      <circle cx="60" cy="60" r="14" fill="none" stroke="${c}" stroke-width="2"/>
      <circle cx="60" cy="60" r="3" fill="#fff"/>
      <path d="M15 60 L105 60" stroke="#00f0ff" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"/>
    `,
  },
  {
    id: "majorana_scale",
    name: "Majorana Seesaw Scale",
    category: "quantum",
    log: -22,
    exactM: 1.0e-22,
    metric: "1.0 × 10⁻²² m",
    imperial: "3.94 × 10⁻²¹ in",
    fact: "The postulated interaction scale of hypothetical right-handed Majorana neutrinos in the seesaw mechanism of particle physics.",
    analogy: "Provides the leading theoretical explanation for why observed neutrinos have such bizarrely tiny masses compared to quarks and electrons.",
    draw: (c) => `
      <line x1="25" y1="75" x2="95" y2="45" stroke="${c}" stroke-width="3"/>
      <polygon points="60,60 52,78 68,78" fill="#ffd166"/>
      <circle cx="28" cy="72" r="8" fill="#38bdf8"/>
      <circle cx="92" cy="48" r="4" fill="#a855f7"/>
      <text x="60" y="105" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">SEESAW MECHANISM</text>
    `,
  },
  {
    id: "qgp_core",
    name: "Quark-Gluon Plasma Core",
    category: "quantum",
    log: -20,
    exactM: 1.0e-20,
    metric: "1.0 × 10⁻²⁰ m",
    imperial: "3.94 × 10⁻¹⁹ in",
    fact: "The primordial liquid state created in ultra-relativistic gold or lead ion collisions inside particle accelerators.",
    analogy: "At 4 trillion degrees Celsius, nucleons dissolve into a nearly frictionless fluid of unbound quarks and gluons.",
    draw: (c) => `
      <circle cx="60" cy="60" r="38" fill="rgba(255,80,0,0.15)" stroke="#ff5500" stroke-width="1.5"/>
      <circle cx="48" cy="50" r="6" fill="#ff007f"/>
      <circle cx="72" cy="52" r="6" fill="#00f0ff"/>
      <circle cx="60" cy="74" r="6" fill="#ffd166"/>
      <path d="M48 50 Q60 52 72 52 Q66 63 60 74 Q54 62 48 50" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="3 2"/>
    `,
  },

  // ── SUBATOMIC REGIME (10^-19 to 10^-14) ───────────────────────
  {
    id: "w_boson",
    name: "Weak Force Boson Range",
    category: "subatomic",
    log: -19,
    exactM: 1.0e-19,
    metric: "1.0 × 10⁻¹⁹ m",
    imperial: "3.94 × 10⁻¹⁸ in",
    fact: "The operative range of the massive W and Z intermediate vector bosons, mediating radioactive beta decay.",
    analogy: "Because W and Z bosons are over 80 times heavier than a proton, quantum uncertainty limits their reach to a subatomic whisper.",
    draw: (c) => `
      <circle cx="60" cy="60" r="42" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="5 5" opacity="0.5"/>
      <circle cx="60" cy="60" r="18" fill="rgba(168,85,247,0.2)" stroke="#a855f7" stroke-width="2"/>
      <text x="60" y="66" font-size="16" font-family="monospace" font-weight="bold" fill="#fff" text-anchor="middle">W±</text>
    `,
  },
  {
    id: "quark_top",
    name: "Top Quark",
    category: "subatomic",
    log: -18,
    exactM: 1.0e-18,
    metric: "1.0 × 10⁻¹⁸ m",
    imperial: "3.94 × 10⁻¹⁷ in",
    fact: "The heaviest known elementary particle, possessing a mass comparable to an entire atom of gold.",
    analogy: "Its lifetime is so brief (5 × 10⁻²⁵ seconds) that it decays before it even has time to bind with other quarks.",
    draw: (c) => `
      <circle cx="60" cy="60" r="24" fill="rgba(239,68,68,0.25)" stroke="#ef4444" stroke-width="2"/>
      <circle cx="60" cy="60" r="10" fill="#ef4444"/>
      <circle cx="60" cy="60" r="4" fill="#fff"/>
      <text x="60" y="98" font-size="11" font-family="monospace" fill="${c}" text-anchor="middle">m = 173 GeV</text>
    `,
  },
  {
    id: "quark_up",
    name: "Up Valence Quark",
    category: "subatomic",
    log: -17,
    exactM: 1.0e-17,
    metric: "1.0 × 10⁻¹⁷ m",
    imperial: "3.94 × 10⁻¹⁶ in",
    fact: "Elementary fermion with an electric charge of +2/3e. Two up quarks combine with one down quark to form a proton.",
    analogy: "Quarks can never be isolated due to color confinement; pulling them apart creates new quark pairs from the energy.",
    draw: (c) => `
      <circle cx="60" cy="60" r="30" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="4 2"/>
      <circle cx="60" cy="60" r="14" fill="${c}"/>
      <text x="60" y="65" font-size="14" font-family="monospace" font-weight="bold" fill="#000" text-anchor="middle">u</text>
      <text x="60" y="105" font-size="11" font-family="monospace" fill="#00f0ff" text-anchor="middle">+2/3 e</text>
    `,
  },
  {
    id: "strong_force",
    name: "Strong Nuclear Force Range",
    category: "subatomic",
    log: -16,
    exactM: 1.0e-16,
    metric: "1.0 × 10⁻¹⁶ m",
    imperial: "3.94 × 10⁻¹⁵ in",
    fact: "The carrier range of the gluon field holding quarks together inside hadrons.",
    analogy: "It is the strongest force in physics—roughly 137 times stronger than electromagnetism and 10³⁸ times stronger than gravity.",
    draw: (c) => `
      <circle cx="60" cy="60" r="44" fill="none" stroke="${c}" stroke-width="2"/>
      <path d="M35 45 Q60 25 85 45 Q60 65 35 45" fill="none" stroke="#22c55e" stroke-width="3"/>
      <path d="M45 75 Q60 95 75 75 Q60 55 45 75" fill="none" stroke="#ffd166" stroke-width="3"/>
      <circle cx="45" cy="50" r="6" fill="#ff007f"/>
      <circle cx="75" cy="50" r="6" fill="#00f0ff"/>
      <circle cx="60" cy="75" r="6" fill="#22c55e"/>
    `,
  },
  {
    id: "proton",
    name: "Proton",
    category: "subatomic",
    log: -15,
    exactM: 0.84e-15,
    metric: "0.84 × 10⁻¹⁵ m",
    imperial: "3.31 × 10⁻¹⁴ in",
    fact: "Positively charged composite nucleon made of two up quarks, one down quark, and a churning virtual gluon sea.",
    analogy: "Protons are virtually indestructible, with a theoretical half-life exceeding 10³⁴ years—far longer than the current age of the cosmos.",
    draw: (c) => `
      <circle cx="60" cy="60" r="40" fill="rgba(0,240,255,0.12)" stroke="${c}" stroke-width="2.5"/>
      <circle cx="48" cy="50" r="11" fill="#ef4444"/>
      <circle cx="72" cy="50" r="11" fill="#ef4444"/>
      <circle cx="60" cy="74" r="11" fill="#3b82f6"/>
      <text x="48" y="55" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">u</text>
      <text x="72" y="55" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">u</text>
      <text x="60" y="79" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">d</text>
      <text x="60" y="112" font-size="11" font-family="monospace" fill="${c}" text-anchor="middle">CHARGE +1</text>
    `,
  },
  {
    id: "neutron",
    name: "Neutron",
    category: "subatomic",
    log: -15,
    exactM: 0.87e-15,
    metric: "0.87 × 10⁻¹⁵ m",
    imperial: "3.43 × 10⁻¹⁴ in",
    fact: "Neutral nucleon made of one up quark and two down quarks. Vital for gluing multi-proton atomic nuclei together.",
    analogy: "Free neutrons outside a nucleus are radioactive, decaying into a proton, electron, and antineutrino in roughly 14 minutes.",
    draw: (c) => `
      <circle cx="60" cy="60" r="40" fill="rgba(148,163,184,0.15)" stroke="#94a3b8" stroke-width="2.5"/>
      <circle cx="48" cy="50" r="11" fill="#ef4444"/>
      <circle cx="72" cy="50" r="11" fill="#3b82f6"/>
      <circle cx="60" cy="74" r="11" fill="#3b82f6"/>
      <text x="48" y="55" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">u</text>
      <text x="72" y="55" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">d</text>
      <text x="60" y="79" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">d</text>
      <text x="60" y="112" font-size="11" font-family="monospace" fill="#94a3b8" text-anchor="middle">CHARGE 0</text>
    `,
  },
  {
    id: "nucleus_uranium",
    name: "Uranium-238 Nucleus",
    category: "subatomic",
    log: -14,
    exactM: 1.5e-14,
    metric: "1.5 × 10⁻¹⁴ m",
    imperial: "5.91 × 10⁻¹³ in",
    fact: "One of the heaviest naturally occurring nuclei, densely packed with 92 protons and 146 neutrons on the edge of nuclear fission.",
    analogy: "Despite containing 238 nucleons, its radius is only 1/10,000th the diameter of the atom it anchors.",
    draw: (c) => `
      <defs>
        <radialGradient id="u_nuc" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffd166"/>
          <stop offset="60%" stop-color="#ef4444"/>
          <stop offset="100%" stop-color="#7f1d1d"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="36" fill="url(#u_nuc)" stroke="${c}" stroke-width="2"/>
      <circle cx="50" cy="50" r="5" fill="#ef4444"/>
      <circle cx="68" cy="52" r="5" fill="#3b82f6"/>
      <circle cx="58" cy="66" r="5" fill="#ef4444"/>
      <circle cx="70" cy="70" r="5" fill="#3b82f6"/>
      <circle cx="44" cy="68" r="5" fill="#3b82f6"/>
      <text x="60" y="112" font-size="10" font-family="monospace" fill="${c}" text-anchor="middle">92p + 146n</text>
    `,
  },

  // ── ATOMIC & MOLECULAR REGIME (10^-13 to 10^-8) ───────────────
  {
    id: "gamma_ray",
    name: "Gamma-Ray Wavelength",
    category: "atomic",
    log: -13,
    exactM: 1.0e-13,
    metric: "1.0 × 10⁻¹³ m",
    imperial: "3.94 × 10⁻¹² in",
    fact: "The highest-energy electromagnetic radiation, emitted by nuclear transitions, pulsars, and cosmic cataclysms.",
    analogy: "A single gamma-ray photon carries more than a million times the energy of the visible light photons striking your retina.",
    draw: (c) => `
      <path d="M10 60 Q22 35 35 60 T60 60 T85 60 T110 60" fill="none" stroke="${c}" stroke-width="3"/>
      <circle cx="60" cy="60" r="5" fill="#fff"/>
      <line x1="20" y1="20" x2="100" y2="20" stroke="#ff007f" stroke-width="1" stroke-dasharray="3 2"/>
      <text x="60" y="15" font-size="10" font-family="monospace" fill="#ff007f" text-anchor="middle">λ = 0.1 pm</text>
    `,
  },
  {
    id: "electron_shell_1s",
    name: "Inner 1s Electron Shell",
    category: "atomic",
    log: -12,
    exactM: 1.0e-12,
    metric: "1.0 × 10⁻¹² m",
    imperial: "3.94 × 10⁻¹¹ in",
    fact: "In heavy elements like gold or uranium, inner 1s electrons orbit at relativistic speeds exceeding half the speed of light.",
    analogy: "Relativistic mass increase pulls this shell tightly inward, directly causing gold's yellow luster and mercury's liquid state.",
    draw: (c) => `
      <circle cx="60" cy="60" r="8" fill="#ffd166"/>
      <circle cx="60" cy="60" r="32" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="4 3"/>
      <circle cx="88" cy="45" r="4" fill="#00f0ff"/>
      <circle cx="32" cy="75" r="4" fill="#00f0ff"/>
      <text x="60" y="108" font-size="10" font-family="monospace" fill="${c}" text-anchor="middle">v ≈ 0.58 c</text>
    `,
  },
  {
    id: "xray_wave",
    name: "Hard X-Ray Wavelength",
    category: "atomic",
    log: -11,
    exactM: 1.0e-11,
    metric: "1.0 × 10⁻¹¹ m",
    imperial: "3.94 × 10⁻¹⁰ in",
    fact: "Electromagnetic waves whose wavelength matches crystal lattice planes, enabling X-ray diffraction crystallography.",
    analogy: "Rosalind Franklin used X-rays at this exact wavelength in 1952 to capture the historic Photo 51 revealing DNA's structure.",
    draw: (c) => `
      <path d="M15 60 Q30 40 45 60 T75 60 T105 60" fill="none" stroke="${c}" stroke-width="2.5"/>
      <rect x="25" y="80" width="10" height="10" fill="#475569"/>
      <rect x="55" y="80" width="10" height="10" fill="#475569"/>
      <rect x="85" y="80" width="10" height="10" fill="#475569"/>
      <text x="60" y="105" font-size="10" font-family="monospace" fill="${c}" text-anchor="middle">CRYSTAL LATTICE</text>
    `,
  },
  {
    id: "atom_hydrogen",
    name: "Hydrogen Atom",
    category: "atomic",
    log: -10,
    exactM: 1.06e-10,
    metric: "1.06 × 10⁻¹⁰ m",
    imperial: "4.17 × 10⁻⁹ in",
    fact: "The simplest atom in existence: 1 proton and 1 electron. 99.9999999% of its volume is completely empty space.",
    analogy: "If the proton were enlarged to the size of a marble in the center of a stadium, the electron would circle as a speck of dust in the highest seats.",
    draw: (c) => `
      <defs>
        <radialGradient id="h_cloud" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.35"/>
          <stop offset="70%" stop-color="#00f0ff" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="#00f0ff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="48" fill="url(#h_cloud)"/>
      <ellipse cx="60" cy="60" rx="42" ry="22" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="4 3" transform="rotate(-25 60 60)"/>
      <circle cx="60" cy="60" r="6" fill="#ef4444"/>
      <circle cx="95" cy="45" r="3.5" fill="#00f0ff"/>
      <text x="60" y="112" font-size="10" font-family="monospace" fill="${c}" text-anchor="middle">1 PROTON + 1 ELECTRON</text>
    `,
  },
  {
    id: "atom_carbon",
    name: "Carbon Atom",
    category: "atomic",
    log: -10,
    exactM: 1.54e-10,
    metric: "1.54 × 10⁻¹⁰ m",
    imperial: "6.06 × 10⁻⁹ in",
    fact: "The tetravalent backbone of organic chemistry, forming four stable covalent bonds to build proteins, DNA, and life.",
    analogy: "Every carbon atom in your DNA was forged inside the fiery core of an ancient dying red giant star billions of years ago.",
    draw: (c) => `
      <circle cx="60" cy="60" r="14" fill="#334155" stroke="#94a3b8" stroke-width="2"/>
      <text x="60" y="65" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">C</text>
      <line x1="60" y1="46" x2="60" y2="20" stroke="${c}" stroke-width="3"/>
      <line x1="60" y1="74" x2="60" y2="100" stroke="${c}" stroke-width="3"/>
      <line x1="46" y1="60" x2="20" y2="60" stroke="${c}" stroke-width="3"/>
      <line x1="74" y1="60" x2="100" y2="60" stroke="${c}" stroke-width="3"/>
      <circle cx="60" cy="18" r="4" fill="#00f0ff"/>
      <circle cx="60" cy="102" r="4" fill="#00f0ff"/>
      <circle cx="18" cy="60" r="4" fill="#00f0ff"/>
      <circle cx="102" cy="60" r="4" fill="#00f0ff"/>
    `,
  },
  {
    id: "molecule_water",
    name: "Water Molecule (H₂O)",
    category: "atomic",
    log: -10,
    exactM: 2.75e-10,
    metric: "2.75 × 10⁻¹⁰ m",
    imperial: "1.08 × 10⁻⁸ in",
    fact: "A bent polar molecule with a 104.5° angle. Strong hydrogen bonds give water high surface tension and life-sustaining properties.",
    analogy: "A single standard drop of water contains roughly 1.5 sextillion (1.5 × 10²¹) individual water molecules.",
    draw: (c) => `
      <circle cx="60" cy="50" r="18" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>
      <text x="60" y="55" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">O</text>
      <line x1="48" y1="62" x2="35" y2="78" stroke="${c}" stroke-width="3.5"/>
      <line x1="72" y1="62" x2="85" y2="78" stroke="${c}" stroke-width="3.5"/>
      <circle cx="32" cy="82" r="12" fill="#00f0ff" stroke="#fff" stroke-width="1.5"/>
      <circle cx="88" cy="82" r="12" fill="#00f0ff" stroke="#fff" stroke-width="1.5"/>
      <text x="32" y="86" font-size="11" font-weight="bold" fill="#000" text-anchor="middle">H</text>
      <text x="88" y="86" font-size="11" font-weight="bold" fill="#000" text-anchor="middle">H</text>
      <text x="60" y="108" font-size="10" font-family="monospace" fill="${c}" text-anchor="middle">ANGLE: 104.5°</text>
    `,
  },
  {
    id: "buckyball",
    name: "Buckminsterfullerene (C₆₀)",
    category: "atomic",
    log: -9,
    exactM: 1.0e-9,
    metric: "1.0 × 10⁻⁹ m",
    imperial: "3.94 × 10⁻⁸ in",
    fact: "Geodesic spherical carbon allotrope composed of 20 hexagons and 12 pentagons, perfectly matching a soccer ball.",
    analogy: "Its hollow interior cavity can trap radioactive isotopes or noble gas atoms like an impenetrable atomic cage.",
    draw: (c) => `
      <circle cx="60" cy="60" r="38" fill="none" stroke="${c}" stroke-width="2"/>
      <polygon points="60,40 75,52 70,68 50,68 45,52" fill="none" stroke="#ffd166" stroke-width="2"/>
      <line x1="60" y1="40" x2="60" y2="22" stroke="${c}" stroke-width="1.5"/>
      <line x1="75" y1="52" x2="94" y2="48" stroke="${c}" stroke-width="1.5"/>
      <line x1="70" y1="68" x2="88" y2="82" stroke="${c}" stroke-width="1.5"/>
      <line x1="50" y1="68" x2="32" y2="82" stroke="${c}" stroke-width="1.5"/>
      <line x1="45" y1="52" x2="26" y2="48" stroke="${c}" stroke-width="1.5"/>
    `,
  },
  {
    id: "dna",
    name: "DNA Double Helix",
    category: "atomic",
    log: -9,
    exactM: 2.5e-9,
    metric: "2.5 × 10⁻⁹ m",
    imperial: "9.84 × 10⁻⁸ in",
    fact: "The 2.5 nm wide double-stranded genetic blueprint encoding cellular machinery across pairs of A-T and C-G nucleotides.",
    analogy: "If unraveled, the DNA in a single human cell would measure 2 metres long, yet fits neatly inside a 6-micrometre nucleus.",
    draw: (c) => `
      <path d="M40 18 Q60 40 80 18 T40 70 T80 102" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M80 18 Q60 40 40 18 T80 70 T40 102" fill="none" stroke="#00f0ff" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="46" y1="28" x2="74" y2="28" stroke="#ffd166" stroke-width="2.5"/>
      <line x1="56" y1="44" x2="64" y2="44" stroke="#ef4444" stroke-width="2.5"/>
      <line x1="46" y1="60" x2="74" y2="60" stroke="#22c55e" stroke-width="2.5"/>
      <line x1="46" y1="78" x2="74" y2="78" stroke="#ffd166" stroke-width="2.5"/>
      <line x1="56" y1="92" x2="64" y2="92" stroke="#ef4444" stroke-width="2.5"/>
    `,
  },
  {
    id: "lipid_bilayer",
    name: "Cell Membrane Lipid Bilayer",
    category: "atomic",
    log: -8,
    exactM: 7.5e-9,
    metric: "7.5 × 10⁻⁹ m",
    imperial: "2.95 × 10⁻⁷ in",
    fact: "Amphiphilic phospholipid membrane with hydrophilic heads and fatty acid tails that keeps living cellular chemistry contained.",
    analogy: "Thinner than a soap bubble, yet strong enough to maintain electrical voltage potentials that power your thoughts.",
    draw: (c) => `
      <g fill="#00f0ff">
        <circle cx="30" cy="35" r="6"/><circle cx="45" cy="35" r="6"/>
        <circle cx="60" cy="35" r="6"/><circle cx="75" cy="35" r="6"/><circle cx="90" cy="35" r="6"/>
        <circle cx="30" cy="85" r="6"/><circle cx="45" cy="85" r="6"/>
        <circle cx="60" cy="85" r="6"/><circle cx="75" cy="85" r="6"/><circle cx="90" cy="85" r="6"/>
      </g>
      <path d="M30 41v16 M45 41v16 M60 41v16 M75 41v16 M90 41v16 M30 79v-16 M45 79v-16 M60 79v-16 M75 79v-16 M90 79v-16" stroke="${c}" stroke-width="2"/>
      <rect x="52" y="28" width="16" height="64" rx="4" fill="#a855f7" opacity="0.8"/>
      <text x="60" y="108" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">PROTEIN CHANNEL</text>
    `,
  },
  {
    id: "ribosome",
    name: "Ribosome",
    category: "cellular",
    log: -8,
    exactM: 2.5e-8,
    metric: "2.5 × 10⁻⁸ m",
    imperial: "9.84 × 10⁻⁷ in",
    fact: "The universal macromolecular machine inside all living cells that translates mRNA codes into functional chains of proteins.",
    analogy: "A single rapidly dividing mammalian cell contains over 10 million ribosomes assembling 200 amino acids every second.",
    draw: (c) => `
      <ellipse cx="60" cy="50" rx="34" ry="20" fill="rgba(34,197,94,0.3)" stroke="#22c55e" stroke-width="2.5"/>
      <ellipse cx="60" cy="74" rx="24" ry="14" fill="rgba(0,240,255,0.3)" stroke="${c}" stroke-width="2.5"/>
      <path d="M20 62 Q60 66 100 62" stroke="#ffd166" stroke-width="3" stroke-dasharray="4 2"/>
      <circle cx="60" cy="38" r="4" fill="#fff"/>
      <text x="60" y="105" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">mRNA TRANSLATION</text>
    `,
  },
  {
    id: "transistor_gate",
    name: "3nm Transistor Gate",
    category: "cellular",
    log: -8,
    exactM: 3.0e-8,
    metric: "3.0 × 10⁻⁸ m",
    imperial: "1.18 × 10⁻⁶ in",
    fact: "The nanoscale physical gate dimension of advanced semiconductor silicon microchips carved with extreme ultraviolet (EUV) light.",
    analogy: "Modern smartphone microprocessors pack over 16 billion of these microscopic gates on a chip the size of a fingernail.",
    draw: (c) => `
      <rect x="25" y="65" width="70" height="24" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
      <rect x="42" y="32" width="36" height="34" fill="${c}" stroke="#fff" stroke-width="1.5"/>
      <rect x="30" y="45" width="8" height="20" fill="#ffd166"/>
      <rect x="82" y="45" width="8" height="20" fill="#ffd166"/>
      <text x="60" y="54" font-size="10" font-weight="bold" fill="#000" text-anchor="middle">GATE</text>
      <text x="60" y="105" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">3nm SILICON NODE</text>
    `,
  },

  // ── MICROSCOPIC & CELLULAR (10^-7 to 10^-4) ───────────────────
  {
    id: "virus_sars",
    name: "SARS-CoV-2 / Coronavirus",
    category: "cellular",
    log: -7,
    exactM: 1.0e-7,
    metric: "1.0 × 10⁻⁷ m",
    imperial: "3.94 × 10⁻⁶ in",
    fact: "Enveloped spherical RNA virus decorated with iconic spike glycoproteins that dock into human ACE2 cell surface receptors.",
    analogy: "More than 50 million individual coronavirus particles could comfortably line up on the surface of an ordinary postage stamp.",
    draw: (c) => `
      <circle cx="60" cy="60" r="30" fill="rgba(239,68,68,0.2)" stroke="#ef4444" stroke-width="2.5"/>
      <g stroke="#ffd166" stroke-width="2.5" stroke-linecap="round">
        <line x1="60" y1="30" x2="60" y2="18"/><circle cx="60" cy="16" r="3" fill="#ffd166"/>
        <line x1="60" y1="90" x2="60" y2="102"/><circle cx="60" cy="104" r="3" fill="#ffd166"/>
        <line x1="30" y1="60" x2="18" y2="60"/><circle cx="16" cy="60" r="3" fill="#ffd166"/>
        <line x1="90" y1="60" x2="102" y2="60"/><circle cx="104" cy="60" r="3" fill="#ffd166"/>
        <line x1="39" y1="39" x2="30" y2="30"/><circle cx="28" cy="28" r="3" fill="#ffd166"/>
        <line x1="81" y1="81" x2="90" y2="90"/><circle cx="92" cy="92" r="3" fill="#ffd166"/>
        <line x1="39" y1="81" x2="30" y2="90"/><circle cx="28" cy="92" r="3" fill="#ffd166"/>
        <line x1="81" y1="39" x2="90" y2="30"/><circle cx="92" cy="28" r="3" fill="#ffd166"/>
      </g>
      <circle cx="60" cy="60" r="16" fill="none" stroke="${c}" stroke-dasharray="3 3"/>
    `,
  },
  {
    id: "light_wave",
    name: "Visible Green Light Wavelength",
    category: "cellular",
    log: -7,
    exactM: 5.5e-7,
    metric: "5.5 × 10⁻⁷ m",
    imperial: "2.16 × 10⁻⁵ in",
    fact: "The peak spectral wavelength of solar radiation reaching Earth's surface (550 nm), perfectly matched to human eye photopigments.",
    analogy: "Because visible light cannot resolve objects smaller than half its wavelength, viruses and atoms are completely invisible to optical microscopes.",
    draw: (c) => `
      <path d="M15 60 Q37 20 60 60 T105 60" fill="none" stroke="#22c55e" stroke-width="4" stroke-linecap="round"/>
      <line x1="15" y1="85" x2="105" y2="85" stroke="${c}" stroke-width="1.5" stroke-dasharray="4 2"/>
      <text x="60" y="105" font-size="10" font-family="monospace" fill="#22c55e" text-anchor="middle">λ = 550 nm (GREEN)</text>
    `,
  },
  {
    id: "mitochondria",
    name: "Mitochondrion",
    category: "cellular",
    log: -6,
    exactM: 1.5e-6,
    metric: "1.5 × 10⁻⁶ m",
    imperial: "5.91 × 10⁻⁵ in",
    fact: "The cellular powerhouse containing its own circular DNA, converting nutrients into ATP fuel across folded inner cristae membranes.",
    analogy: "Descended from ancient free-living bacteria that were engulfed by ancestral host cells 1.5 billion years ago.",
    draw: (c) => `
      <ellipse cx="60" cy="60" rx="42" ry="24" fill="rgba(249,115,22,0.2)" stroke="#f97316" stroke-width="2.5"/>
      <path d="M28 60 Q40 45 45 60 T60 60 T75 60 T92 60" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="38" cy="52" r="2" fill="#ffd166"/>
      <circle cx="72" cy="68" r="2" fill="#ffd166"/>
      <text x="60" y="102" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">CRISTAE & ATP</text>
    `,
  },
  {
    id: "bacterium",
    name: "E. Coli Bacterium",
    category: "cellular",
    log: -6,
    exactM: 2.0e-6,
    metric: "2.0 × 10⁻⁶ m",
    imperial: "7.87 × 10⁻⁵ in",
    fact: "Single-celled prokaryotic rod organism equipped with microscopic rotary flagellar motors spinning at over 1,000 RPM.",
    analogy: "In warm, nutrient-rich conditions, an E. coli colony can double its total population every twenty minutes.",
    draw: (c) => `
      <rect x="32" y="44" width="56" height="32" rx="16" fill="rgba(6,214,160,0.25)" stroke="#06d6a0" stroke-width="2.5"/>
      <path d="M32 60 Q18 45 10 50 M32 66 Q15 68 8 78 M32 54 Q16 40 12 30" fill="none" stroke="${c}" stroke-width="2"/>
      <circle cx="50" cy="56" r="3" fill="#06d6a0"/>
      <circle cx="70" cy="64" r="3" fill="#06d6a0"/>
      <text x="60" y="102" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">ROTARY FLAGELLA</text>
    `,
  },
  {
    id: "rbc",
    name: "Red Blood Cell (Erythrocyte)",
    category: "cellular",
    log: -5,
    exactM: 7.5e-6,
    metric: "7.5 × 10⁻⁶ m",
    imperial: "2.95 × 10⁻⁴ in",
    fact: "Flexible biconcave disc containing 270 million hemoglobin molecules transporting oxygen to trillions of human tissue cells.",
    analogy: "Your bone marrow produces approximately 2.4 million brand new red blood cells every single second.",
    draw: (c) => `
      <circle cx="60" cy="60" r="38" fill="#ef4444" stroke="#b91c1c" stroke-width="3"/>
      <circle cx="60" cy="60" r="20" fill="#991b1b"/>
      <ellipse cx="56" cy="54" rx="14" ry="10" fill="#dc2626"/>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">BICONCAVE O₂ CARRIER</text>
    `,
  },
  {
    id: "macrophage",
    name: "Macrophage Immune Cell",
    category: "cellular",
    log: -5,
    exactM: 2.0e-5,
    metric: "2.0 × 10⁻⁵ m",
    imperial: "7.87 × 10⁻⁴ in",
    fact: "Large sentinel white blood cell that patrols human tissues, extending pseudopodia to engulf and digest cellular waste and microbes.",
    analogy: "Its name literally translates to 'big eater'—a single macrophage can engulf over 100 bacteria before expiring.",
    draw: (c) => `
      <path d="M35 35 Q60 20 85 35 Q105 60 85 85 Q60 100 35 85 Q15 60 35 35" fill="rgba(168,85,247,0.25)" stroke="#a855f7" stroke-width="2.5"/>
      <circle cx="56" cy="56" r="14" fill="#7e22ce"/>
      <circle cx="42" cy="40" r="4" fill="#ef4444"/>
      <circle cx="75" cy="72" r="5" fill="#ffd166"/>
      <text x="60" y="110" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">PHAGOCYTOSIS</text>
    `,
  },
  {
    id: "plant_stoma",
    name: "Plant Stoma Pore",
    category: "cellular",
    log: -5,
    exactM: 3.5e-5,
    metric: "3.5 × 10⁻⁵ m",
    imperial: "1.38 × 10⁻³ in",
    fact: "Microscopic mouth-like valve on leaf undersides flanked by sausage-shaped guard cells that open and close to regulate gas exchange.",
    analogy: "Breathes in carbon dioxide for photosynthesis while releasing oxygen and regulating the water cycle of our planet.",
    draw: (c) => `
      <ellipse cx="60" cy="60" rx="38" ry="24" fill="rgba(34,197,94,0.2)" stroke="#22c55e" stroke-width="2"/>
      <ellipse cx="48" cy="60" rx="10" ry="18" fill="#15803d" stroke="#22c55e" stroke-width="2"/>
      <ellipse cx="72" cy="60" rx="10" ry="18" fill="#15803d" stroke="#22c55e" stroke-width="2"/>
      <ellipse cx="60" cy="60" rx="4" ry="14" fill="#020308"/>
      <text x="60" y="105" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">GUARD CELL PORE</text>
    `,
  },
  {
    id: "hair",
    name: "Human Hair Diameter",
    category: "cellular",
    log: -4,
    exactM: 1.0e-4,
    metric: "1.0 × 10⁻⁴ m",
    imperial: "0.0039 in (100 µm)",
    fact: "Tough keratin protein strand averaging 100 micrometres wide, defining the threshold limit of unaided human eyesight.",
    analogy: "Human hair grows approximately 1.25 centimetres per month—which works out to about 1 nanometre every 2 seconds.",
    draw: (c) => `
      <rect x="42" y="15" width="36" height="90" rx="4" fill="rgba(245,158,11,0.25)" stroke="#f59e0b" stroke-width="2.5"/>
      <line x1="42" y1="35" x2="78" y2="35" stroke="${c}" stroke-width="1.5" stroke-dasharray="3 3"/>
      <line x1="42" y1="55" x2="78" y2="55" stroke="${c}" stroke-width="1.5" stroke-dasharray="3 3"/>
      <line x1="42" y1="75" x2="78" y2="75" stroke="${c}" stroke-width="1.5" stroke-dasharray="3 3"/>
      <text x="60" y="118" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">KERATIN FIBER</text>
    `,
  },
  {
    id: "human_ovum",
    name: "Human Ovum (Egg Cell)",
    category: "cellular",
    log: -4,
    exactM: 1.2e-4,
    metric: "1.2 × 10⁻⁴ m",
    imperial: "0.0047 in (120 µm)",
    fact: "The largest single cell produced in the human body, barely visible to the naked human eye as an incandescent speck.",
    analogy: "It has roughly 85,000 times the volume of the microscopic sperm cell that fertilizes it.",
    draw: (c) => `
      <circle cx="60" cy="60" r="42" fill="rgba(236,72,153,0.2)" stroke="#ec4899" stroke-width="2.5"/>
      <circle cx="60" cy="60" r="16" fill="rgba(236,72,153,0.5)" stroke="#fff" stroke-width="1.5"/>
      <circle cx="60" cy="60" r="5" fill="#fff"/>
      <circle cx="60" cy="60" r="45" fill="none" stroke="${c}" stroke-dasharray="3 4" opacity="0.6"/>
      <text x="60" y="116" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">ZONA PELLUCIDA</text>
    `,
  },
  {
    id: "tardigrade",
    name: "Tardigrade (Water Bear)",
    category: "cellular",
    log: -4,
    exactM: 3.5e-4,
    metric: "3.5 × 10⁻⁴ m",
    imperial: "0.0138 in (350 µm)",
    fact: "Microscopic eight-legged animal capable of cryptobiosis, surviving temperatures from -272°C to 150°C and the vacuum of space.",
    analogy: "Can expel 99% of its body water, curl into a dormant glass-like tun, and awaken decades later when touched with water.",
    draw: (c) => `
      <ellipse cx="60" cy="58" rx="34" ry="20" fill="rgba(6,214,160,0.3)" stroke="#06d6a0" stroke-width="2.5"/>
      <circle cx="28" cy="58" r="10" fill="#06d6a0"/>
      <circle cx="24" cy="56" r="2.5" fill="#000"/>
      <line x1="42" y1="78" x2="38" y2="88" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
      <line x1="56" y1="78" x2="54" y2="88" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
      <line x1="70" y1="78" x2="72" y2="88" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
      <line x1="84" y1="74" x2="90" y2="84" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
      <text x="60" y="106" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">8 CLAWED LEGS</text>
    `,
  },

  // ── HUMAN & EVERYDAY SCALE (10^-3 to 10^3) ────────────────────
  {
    id: "sand",
    name: "Fine Grain of Sand",
    category: "human",
    log: -3,
    exactM: 1.0e-3,
    metric: "1.0 × 10⁻³ m",
    imperial: "0.039 in (1 mm)",
    fact: "Granular quartz mineral fragment rounded down by millennia of river runoff and pounding ocean surf.",
    analogy: "There are estimated to be roughly 7.5 quintillion (7.5 × 10¹⁸) grains of sand across all the beaches and deserts of Earth.",
    draw: (c) => `
      <polygon points="60,25 90,45 80,88 38,92 28,50" fill="rgba(253,224,71,0.3)" stroke="#fde047" stroke-width="2.5"/>
      <line x1="60" y1="25" x2="55" y2="60" stroke="${c}" stroke-width="1.5"/>
      <line x1="90" y1="45" x2="55" y2="60" stroke="${c}" stroke-width="1.5"/>
      <line x1="80" y1="88" x2="55" y2="60" stroke="${c}" stroke-width="1.5"/>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">QUARTZ CRYSTAL</text>
    `,
  },
  {
    id: "pinhead",
    name: "Sewing Pinhead",
    category: "human",
    log: -3,
    exactM: 1.5e-3,
    metric: "1.5 × 10⁻³ m",
    imperial: "0.059 in (1.5 mm)",
    fact: "Spherical brass or plastic cap on a dressmaker's pin, measuring 1.5 millimetres across.",
    analogy: "Famous in the medieval philosophical debate: 'How many angels can dance on the head of a pin?'",
    draw: (c) => `
      <circle cx="60" cy="42" r="18" fill="#e2e8f0" stroke="${c}" stroke-width="2.5"/>
      <rect x="57" y="60" width="6" height="48" fill="#94a3b8"/>
      <line x1="60" y1="108" x2="60" y2="114" stroke="#475569" stroke-width="2"/>
    `,
  },
  {
    id: "ant",
    name: "Worker Ant",
    category: "human",
    log: -2,
    exactM: 4.5e-3,
    metric: "4.5 × 10⁻³ m",
    imperial: "0.18 in (4.5 mm)",
    fact: "Colonial eusocial insect capable of carrying up to 50 times its own body weight and communicating via pheromone trails.",
    analogy: "The combined mass of the 20 quadrillion ants on Earth exceeds the biomass of all wild birds and mammals combined.",
    draw: (c) => `
      <ellipse cx="36" cy="60" rx="9" ry="7" fill="${c}"/>
      <ellipse cx="54" cy="60" rx="7" ry="6" fill="${c}"/>
      <ellipse cx="78" cy="60" rx="14" ry="9" fill="${c}"/>
      <path d="M54 60 L45 80 M54 60 L62 80 M54 60 L40 40 M54 60 L68 40" stroke="#f59e0b" stroke-width="2.5"/>
      <line x1="30" y1="56" x2="20" y2="50" stroke="${c}" stroke-width="2"/>
      <line x1="30" y1="64" x2="20" y2="70" stroke="${c}" stroke-width="2"/>
      <text x="60" y="105" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">EXOSKELETON</text>
    `,
  },
  {
    id: "honeybee",
    name: "Honeybee",
    category: "human",
    log: -2,
    exactM: 1.5e-2,
    metric: "1.5 × 10⁻² m",
    imperial: "0.59 in (15 mm)",
    fact: "Crucial agricultural pollinator that communicates distances and angles to nectar flowers using a complex waggle dance.",
    analogy: "Beats its wings 230 times per second and visits up to 1,000 flowers in a single foraging excursion.",
    draw: (c) => `
      <ellipse cx="60" cy="62" rx="22" ry="14" fill="#facc15" stroke="#78350f" stroke-width="2"/>
      <line x1="52" y1="48" x2="52" y2="76" stroke="#000" stroke-width="4"/>
      <line x1="64" y1="48" x2="64" y2="76" stroke="#000" stroke-width="4"/>
      <ellipse cx="52" cy="40" rx="14" ry="8" fill="rgba(255,255,255,0.7)" stroke="${c}" stroke-width="1.5" transform="rotate(-30 52 40)"/>
      <ellipse cx="68" cy="40" rx="14" ry="8" fill="rgba(255,255,255,0.7)" stroke="${c}" stroke-width="1.5" transform="rotate(30 68 40)"/>
    `,
  },
  {
    id: "egg",
    name: "Chicken Egg",
    category: "human",
    log: -2,
    exactM: 5.5e-2,
    metric: "5.5 × 10⁻² m",
    imperial: "2.16 in (5.5 cm)",
    fact: "A self-contained biological gestation chamber protected by a semi-permeable calcium carbonate shell pierced by 10,000 breathing pores.",
    analogy: "Its curved dome geometry distributes external weight so evenly that a fresh egg can support surprising compressive forces.",
    draw: (c) => `
      <path d="M60 22 C42 22, 34 50, 34 68 C34 86, 45 98, 60 98 C75 98, 86 86, 86 68 C86 50, 78 22, 60 22 Z" fill="rgba(254,243,199,0.3)" stroke="#fef3c7" stroke-width="2.5"/>
      <ellipse cx="60" cy="68" rx="14" ry="12" fill="#f59e0b"/>
      <text x="60" y="114" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">CALCIUM SHELL</text>
    `,
  },
  {
    id: "smartphone",
    name: "Smartphone",
    category: "human",
    log: -1,
    exactM: 0.15,
    metric: "1.5 × 10⁻¹ m",
    imperial: "5.9 in (15 cm)",
    fact: "Handheld pocket supercomputer containing billions of transistors connected via electromagnetic radio waves to global satellites.",
    analogy: "Possesses over 100,000 times more processing power than the Apollo 11 Lunar Module guidance computer that put humans on the Moon.",
    draw: (c) => `
      <rect x="42" y="20" width="36" height="76" rx="6" fill="#0f172a" stroke="${c}" stroke-width="2.5"/>
      <rect x="45" y="28" width="30" height="60" fill="#0284c7" opacity="0.8"/>
      <circle cx="60" cy="24" r="1.5" fill="#fff"/>
      <line x1="52" y1="92" x2="68" y2="92" stroke="#fff" stroke-width="1.5"/>
    `,
  },
  {
    id: "basketball",
    name: "Basketball",
    category: "human",
    log: -1,
    exactM: 0.24,
    metric: "2.4 × 10⁻¹ m",
    imperial: "9.4 in (24 cm)",
    fact: "Standard regulation inflated composite leather sphere with a circumference of 75 centimetres.",
    analogy: "If the Sun were scaled down to the size of this basketball, Earth would be a tiny 2-millimetre speck 26 metres away.",
    draw: (c) => `
      <circle cx="60" cy="60" r="36" fill="#ea580c" stroke="#c2410c" stroke-width="3"/>
      <line x1="24" y1="60" x2="96" y2="60" stroke="#000" stroke-width="2.5"/>
      <line x1="60" y1="24" x2="60" y2="96" stroke="#000" stroke-width="2.5"/>
      <path d="M35 35 Q60 60 35 85" fill="none" stroke="#000" stroke-width="2.5"/>
      <path d="M85 35 Q60 60 85 85" fill="none" stroke="#000" stroke-width="2.5"/>
    `,
  },
  {
    id: "human",
    name: "Adult Human Being",
    category: "human",
    log: 0,
    exactM: 1.75,
    metric: "1.75 × 10⁰ m",
    imperial: "5 ft 9 in (1.75 m)",
    fact: "Bipedal conscious hominid possessing 86 billion brain neurons, capable of scientific inquiry and contemplating cosmic scales.",
    analogy: "Standing squarely at the geometric midpoint between the subatomic Planck scale (10⁻³⁵ m) and the observable cosmos (10²⁷ m).",
    draw: (c) => `
      <circle cx="60" cy="28" r="10" fill="none" stroke="${c}" stroke-width="2.5"/>
      <line x1="60" y1="38" x2="60" y2="72" stroke="${c}" stroke-width="3.5"/>
      <line x1="36" y1="48" x2="84" y2="48" stroke="${c}" stroke-width="3"/>
      <line x1="60" y1="72" x2="44" y2="105" stroke="${c}" stroke-width="3.5"/>
      <line x1="60" y1="72" x2="76" y2="105" stroke="${c}" stroke-width="3.5"/>
      <circle cx="60" cy="28" r="4" fill="#ffd166"/>
    `,
  },
  {
    id: "cat",
    name: "Housecat",
    category: "human",
    log: 0,
    exactM: 0.45,
    metric: "4.5 × 10⁻¹ m",
    imperial: "17.7 in (45 cm)",
    fact: "Agile domestic feline with 244 bones, non-functional floating collarbones, and night vision requiring 1/6th the light humans need.",
    analogy: "Can sprint up to 48 km/h (30 mph) and rotate its ears 180 degrees using 32 separate ear muscles.",
    draw: (c) => `
      <polygon points="40,35 48,15 54,32" fill="${c}"/>
      <polygon points="66,32 72,15 80,35" fill="${c}"/>
      <circle cx="60" cy="42" r="18" fill="rgba(203,213,225,0.2)" stroke="${c}" stroke-width="2.5"/>
      <ellipse cx="60" cy="74" rx="22" ry="16" fill="rgba(203,213,225,0.2)" stroke="${c}" stroke-width="2.5"/>
      <circle cx="53" cy="40" r="3" fill="#22c55e"/>
      <circle cx="67" cy="40" r="3" fill="#22c55e"/>
      <path d="M82 74 Q96 65 92 50" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    `,
  },
  {
    id: "elephant",
    name: "African Bush Elephant",
    category: "human",
    log: 1,
    exactM: 6.5,
    metric: "6.5 × 10⁰ m",
    imperial: "21.3 ft (6.5 m)",
    fact: "The largest living terrestrial mammal on Earth, weighing up to 6,000 kg and communicating through subterranean infrasound rumbles.",
    analogy: "Its trunk contains over 40,000 individual muscle fascicles—delicate enough to pluck a single blade of grass or strong enough to uproot trees.",
    draw: (c) => `
      <ellipse cx="60" cy="55" rx="34" ry="24" fill="rgba(148,163,184,0.3)" stroke="#94a3b8" stroke-width="2.5"/>
      <circle cx="34" cy="48" r="14" fill="#94a3b8"/>
      <path d="M26 50 Q16 65 14 85 Q18 90 22 84" fill="none" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
      <path d="M28 58 Q34 68 40 65" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <rect x="42" y="76" width="8" height="26" fill="#64748b"/>
      <rect x="70" y="76" width="8" height="26" fill="#64748b"/>
    `,
  },
  {
    id: "whale",
    name: "Blue Whale",
    category: "human",
    log: 1,
    exactM: 30.0,
    metric: "3.0 × 10¹ m",
    imperial: "98.4 ft (30 m)",
    fact: "The largest animal ever known to have existed in Earth's history, weighing up to 190 metric tonnes.",
    analogy: "Its tongue alone weighs as much as an entire adult elephant, and its aorta is wide enough for a human toddler to crawl through.",
    draw: (c) => `
      <ellipse cx="60" cy="60" rx="44" ry="16" fill="rgba(14,165,233,0.3)" stroke="#0ea5e9" stroke-width="2.5"/>
      <polygon points="100,60 115,46 115,74" fill="#0ea5e9"/>
      <circle cx="28" cy="58" r="2.5" fill="#fff"/>
      <path d="M24 64 Q45 72 65 64" fill="none" stroke="#fff" stroke-width="2"/>
      <polygon points="56,66 50,78 62,72" fill="#0ea5e9"/>
    `,
  },
  {
    id: "boeing747",
    name: "Boeing 747-8 Jetliner",
    category: "human",
    log: 1,
    exactM: 76.3,
    metric: "7.6 × 10¹ m",
    imperial: "250 ft (76.3 m)",
    fact: "The iconic Queen of the Skies widebody airliner spanning 76.3 metres from nose to tail with a wingspan of 68.4 metres.",
    analogy: "The Wright Brothers' historic first powered flight in 1903 (37 metres) was shorter than the economy seating section of this aircraft.",
    draw: (c) => `
      <ellipse cx="60" cy="60" rx="48" ry="8" fill="rgba(226,232,240,0.3)" stroke="#cbd5e1" stroke-width="2.5"/>
      <polygon points="12,60 20,54 26,60" fill="${c}"/>
      <polygon points="54,60 38,20 48,20 70,60" fill="#38bdf8"/>
      <polygon points="54,60 38,100 48,100 70,60" fill="#38bdf8"/>
      <polygon points="102,60 110,40 114,40 108,60" fill="#38bdf8"/>
    `,
  },
  {
    id: "pitch",
    name: "FIFA Football Pitch",
    category: "human",
    log: 2,
    exactM: 105.0,
    metric: "1.05 × 10² m",
    imperial: "344 ft (105 m)",
    fact: "Standard international football stadium pitch measuring 105 metres by 68 metres.",
    analogy: "A beam of light traveling in a vacuum covers the entire length of this football field in just 350 nanoseconds.",
    draw: (c) => `
      <rect x="20" y="32" width="80" height="56" fill="rgba(34,197,94,0.25)" stroke="#22c55e" stroke-width="2.5"/>
      <line x1="60" y1="32" x2="60" y2="88" stroke="#fff" stroke-width="1.5"/>
      <circle cx="60" cy="60" r="12" fill="none" stroke="#fff" stroke-width="1.5"/>
      <rect x="20" y="44" width="14" height="32" fill="none" stroke="#fff" stroke-width="1.5"/>
      <rect x="86" y="44" width="14" height="32" fill="none" stroke="#fff" stroke-width="1.5"/>
    `,
  },
  {
    id: "eiffel",
    name: "Eiffel Tower",
    category: "human",
    log: 2,
    exactM: 330.0,
    metric: "3.3 × 10² m",
    imperial: "1,083 ft (330 m)",
    fact: "Puddled wrought-iron lattice landmark in Paris, France, completed in 1889 and standing 330 metres tall.",
    analogy: "Thermal expansion of the iron lattice causes the tower to grow up to 15 centimetres (6 inches) taller during hot summer days.",
    draw: (c) => `
      <polygon points="60,15 54,45 66,45" fill="${c}"/>
      <polygon points="52,48 44,80 76,80 68,48" fill="none" stroke="${c}" stroke-width="2"/>
      <path d="M40 105 Q60 85 80 105" fill="none" stroke="${c}" stroke-width="3"/>
      <line x1="36" y1="105" x2="44" y2="80" stroke="${c}" stroke-width="3"/>
      <line x1="84" y1="105" x2="76" y2="80" stroke="${c}" stroke-width="3"/>
      <circle cx="60" cy="15" r="2" fill="#fff"/>
    `,
  },
  {
    id: "burj",
    name: "Burj Khalifa",
    category: "human",
    log: 2,
    exactM: 828.0,
    metric: "8.28 × 10² m",
    imperial: "2,717 ft (828 m)",
    fact: "The tallest man-made skyscraper on Earth, soaring 828 metres above Dubai with 163 habitable floors.",
    analogy: "The building is so tall that you can watch the sunset from the ground floor, ride the high-speed elevator to the top, and watch the sun set a second time.",
    draw: (c) => `
      <polygon points="60,10 57,40 63,40" fill="#fff"/>
      <polygon points="56,40 54,70 66,70 64,40" fill="rgba(0,240,255,0.4)" stroke="${c}" stroke-width="1.5"/>
      <polygon points="52,70 48,105 72,105 68,70" fill="rgba(0,240,255,0.4)" stroke="${c}" stroke-width="2"/>
      <line x1="60" y1="10" x2="60" y2="105" stroke="#fff" stroke-width="1"/>
    `,
  },
  {
    id: "central_park",
    name: "Central Park NYC",
    category: "human",
    log: 3,
    exactM: 4000.0,
    metric: "4.0 × 10³ m",
    imperial: "2.49 mi (4.0 km)",
    fact: "Manhattan's iconic rectangular green space stretching 4.0 kilometres north-to-south and 800 metres east-to-west.",
    analogy: "Spans 843 acres of preserved landscape—larger than the entire sovereign nation of Monaco.",
    draw: (c) => `
      <rect x="42" y="15" width="36" height="90" fill="rgba(34,197,94,0.3)" stroke="#22c55e" stroke-width="2.5"/>
      <ellipse cx="60" cy="45" rx="10" ry="14" fill="#0284c7"/>
      <ellipse cx="58" cy="78" rx="8" ry="6" fill="#0284c7"/>
      <text x="60" y="118" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">MANHATTAN GRID</text>
    `,
  },
  {
    id: "everest",
    name: "Mount Everest",
    category: "human",
    log: 3,
    exactM: 8848.86,
    metric: "8.85 × 10³ m",
    imperial: "29,032 ft (8.85 km)",
    fact: "The highest mountain on Earth above sea level, rising 8,848.86 metres on the Himalayan tectonic boundary.",
    analogy: "Continental collision between the Indian and Eurasian plates pushes Everest roughly 4 millimetres higher every year.",
    draw: (c) => `
      <polygon points="60,25 20,95 100,95" fill="rgba(100,116,139,0.3)" stroke="#94a3b8" stroke-width="2.5"/>
      <polygon points="60,25 48,50 60,56 72,50" fill="#fff"/>
      <path d="M60,56 L60,95" stroke="${c}" stroke-width="1.5" stroke-dasharray="3 3"/>
      <text x="60" y="110" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">8,848.86 METRES</text>
    `,
  },

  // ── GEOGRAPHIC & PLANETARY (10^4 to 10^8) ──────────────────────
  {
    id: "mariana",
    name: "Mariana Trench Depth",
    category: "planetary",
    log: 4,
    exactM: 10994.0,
    metric: "1.1 × 10⁴ m",
    imperial: "36,070 ft (11 km)",
    fact: "The deepest known oceanic trench on Earth, plunging 10,994 metres down in the western Pacific Challenger Deep.",
    analogy: "If Mount Everest were placed at the bottom of the trench, its peak would still be submerged under more than 2 kilometres of dark ocean water.",
    draw: (c) => `
      <polygon points="15,25 50,95 70,95 105,25" fill="rgba(3,105,161,0.3)" stroke="#0284c7" stroke-width="2.5"/>
      <line x1="10" y1="25" x2="110" y2="25" stroke="#38bdf8" stroke-width="2"/>
      <circle cx="60" cy="95" r="3" fill="#ffd166"/>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">CHALLENGER DEEP</text>
    `,
  },
  {
    id: "neutron_star",
    name: "Neutron Star",
    category: "planetary",
    log: 4,
    exactM: 20000.0,
    metric: "2.0 × 10⁴ m",
    imperial: "12.4 mi (20 km)",
    fact: "Superdense collapsed stellar core packing up to 2.1 solar masses into a sphere the size of a city, spinning up to 700 times per second.",
    analogy: "A single teaspoon of neutron star material would weigh approximately 6 billion tonnes on Earth—as heavy as Mount Everest.",
    draw: (c) => `
      <circle cx="60" cy="60" r="28" fill="#38bdf8" stroke="#fff" stroke-width="2.5"/>
      <polygon points="60,60 20,10 40,10" fill="rgba(255,255,255,0.7)"/>
      <polygon points="60,60 100,110 80,110" fill="rgba(255,255,255,0.7)"/>
      <ellipse cx="60" cy="60" rx="42" ry="14" fill="none" stroke="${c}" stroke-dasharray="3 3"/>
      <text x="60" y="116" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">RELATIVISTIC BEAM</text>
    `,
  },
  {
    id: "grand_canyon",
    name: "Grand Canyon Length",
    category: "planetary",
    log: 5,
    exactM: 446000.0,
    metric: "4.46 × 10⁵ m",
    imperial: "277 mi (446 km)",
    fact: "Colossal river gorge in Arizona carved by the Colorado River, stretching 446 kilometres long and up to 29 kilometres wide.",
    analogy: "Its vertical walls expose nearly 2 billion years of continuous Earth geological history in vivid sedimentary bands.",
    draw: (c) => `
      <path d="M15 45 Q40 65 60 40 T105 55" fill="none" stroke="#0284c7" stroke-width="4"/>
      <path d="M15 35 Q40 55 60 30 T105 45" fill="none" stroke="#ea580c" stroke-width="3"/>
      <path d="M15 55 Q40 75 60 50 T105 65" fill="none" stroke="#ea580c" stroke-width="3"/>
      <text x="60" y="105" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">COLORADO RIVER</text>
    `,
  },
  {
    id: "ceres",
    name: "Dwarf Planet Ceres",
    category: "planetary",
    log: 5,
    exactM: 940000.0,
    metric: "9.4 × 10⁵ m",
    imperial: "584 mi (940 km)",
    fact: "The largest body in the main asteroid belt between Mars and Jupiter, containing 1/3rd of the entire asteroid belt's mass.",
    analogy: "Harbors bright sodium carbonate deposits inside Occator Crater and likely has a subsurface reservoir of salty water.",
    draw: (c) => `
      <circle cx="60" cy="60" r="38" fill="#475569" stroke="#94a3b8" stroke-width="2.5"/>
      <circle cx="48" cy="50" r="3" fill="#fff"/>
      <circle cx="70" cy="66" r="4" fill="#334155"/>
      <circle cx="52" cy="74" r="5" fill="#334155"/>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">ASTEROID BELT</text>
    `,
  },
  {
    id: "pluto",
    name: "Pluto",
    category: "planetary",
    log: 6,
    exactM: 2376000.0,
    metric: "2.38 × 10⁶ m",
    imperial: "1,476 mi (2,376 km)",
    fact: "Icy Kuiper Belt dwarf planet featuring towering water-ice mountains, nitrogen glaciers, and a prominent heart-shaped plain.",
    analogy: "Pluto's total surface area is slightly smaller than the land area of Russia.",
    draw: (c) => `
      <circle cx="60" cy="60" r="36" fill="#78350f" stroke="#b45309" stroke-width="2.5"/>
      <path d="M52 50 C48 40, 68 40, 68 55 C68 68, 52 75, 52 75 C52 75, 36 68, 36 55 C36 40, 52 40, 52 50 Z" fill="#fef3c7" opacity="0.8"/>
      <text x="60" y="110" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">TOMBAUGH REGIO</text>
    `,
  },
  {
    id: "moon",
    name: "The Moon",
    category: "planetary",
    log: 6,
    exactM: 3474800.0,
    metric: "3.47 × 10⁶ m",
    imperial: "2,159 mi (3,475 km)",
    fact: "Earth's fifth-largest natural satellite, tidally locked in synchronous orbit so the same lunar hemisphere always faces Earth.",
    analogy: "The gravitational pull of the Moon stabilizes Earth's axial wobble, preventing wild climatic swings that would endanger life.",
    draw: (c) => `
      <circle cx="60" cy="60" r="38" fill="#94a3b8" stroke="#cbd5e1" stroke-width="2.5"/>
      <circle cx="48" cy="46" r="9" fill="#64748b"/>
      <circle cx="72" cy="54" r="11" fill="#64748b"/>
      <circle cx="56" cy="74" r="14" fill="#64748b"/>
      <circle cx="42" cy="70" r="4" fill="#475569"/>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">LUNAR CRATERS</text>
    `,
  },
  {
    id: "earth",
    name: "Planet Earth",
    category: "planetary",
    log: 7,
    exactM: 12742000.0,
    metric: "1.27 × 10⁷ m",
    imperial: "7,917 mi (12,742 km)",
    fact: "The cradle of conscious life, protected by a liquid-iron geodynamo magnetic shield and vast liquid oceans of water.",
    analogy: "The only known oasis in the cosmos where matter has evolved into conscious observers exploring their own origins.",
    draw: (c) => `
      <defs>
        <radialGradient id="ea_g" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="60%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#082f49"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="40" fill="url(#ea_g)" stroke="#38bdf8" stroke-width="2"/>
      <path d="M42 42 Q54 30 68 38 Q78 48 68 62 Q54 66 42 54 Z" fill="#22c55e" opacity="0.9"/>
      <path d="M68 68 Q78 64 82 76 Q76 86 66 82 Z" fill="#22c55e" opacity="0.9"/>
      <path d="M30 62 Q36 56 40 68 Q34 76 28 70 Z" fill="#22c55e" opacity="0.9"/>
      <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(0,240,255,0.4)" stroke-width="1.5"/>
    `,
  },
  {
    id: "saturn_rings",
    name: "Saturn's Ring System",
    category: "planetary",
    log: 8,
    exactM: 282000000.0,
    metric: "2.82 × 10⁸ m",
    imperial: "175,000 mi (282,000 km)",
    fact: "Spectacular planetary debris disc composed of 99% pure water ice particles, spanning 282,000 km but averaging only 10 metres thick.",
    analogy: "Proportionally speaking, Saturn's rings are thousands of times thinner than a standard sheet of paper.",
    draw: (c) => `
      <ellipse cx="60" cy="60" rx="54" ry="16" fill="none" stroke="#ffd166" stroke-width="5" transform="rotate(-18 60 60)"/>
      <ellipse cx="60" cy="60" rx="46" ry="13" fill="none" stroke="#000" stroke-width="2" transform="rotate(-18 60 60)"/>
      <circle cx="60" cy="60" r="22" fill="#d97706" stroke="#b45309" stroke-width="2"/>
    `,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    category: "planetary",
    log: 8,
    exactM: 142984000.0,
    metric: "1.43 × 10⁸ m",
    imperial: "88,846 mi (142,984 km)",
    fact: "The monarch gas giant possessing more than twice the combined mass of all other planets in our solar system combined.",
    analogy: "Its legendary Great Red Spot is an anticyclonic storm larger than the entire diameter of planet Earth.",
    draw: (c) => `
      <defs>
        <linearGradient id="jup_g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#b45309"/>
          <stop offset="25%" stop-color="#fef3c7"/>
          <stop offset="50%" stop-color="#b45309"/>
          <stop offset="75%" stop-color="#fed7aa"/>
          <stop offset="100%" stop-color="#78350f"/>
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="42" fill="url(#jup_g)" stroke="#f59e0b" stroke-width="2.5"/>
      <ellipse cx="76" cy="72" rx="10" ry="6" fill="#ef4444"/>
      <text x="60" y="114" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">GREAT RED SPOT</text>
    `,
  },

  // ── STELLAR & SOLAR SYSTEM (10^9 to 10^14) ────────────────────
  {
    id: "sun",
    name: "The Sun",
    category: "stellar",
    log: 9,
    exactM: 1392700000.0,
    metric: "1.39 × 10⁹ m",
    imperial: "865,370 mi (1.39M km)",
    fact: "G-type main-sequence star comprising 99.86% of all the mass in the entire Solar System.",
    analogy: "Fuses 600 million metric tonnes of hydrogen into helium every single second in its core.",
    draw: (c) => `
      <defs>
        <radialGradient id="sun_g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff"/>
          <stop offset="40%" stop-color="#facc15"/>
          <stop offset="80%" stop-color="#ea580c"/>
          <stop offset="100%" stop-color="#7c2d12"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="40" fill="url(#sun_g)" stroke="#f59e0b" stroke-width="2"/>
      <path d="M60 12v6 M60 102v6 M12 60h6 M102 60h6 M26 26l5 5 M89 89l5 5 M26 94l5-5 M89 31l5-5" stroke="#f97316" stroke-width="3" stroke-linecap="round"/>
    `,
  },
  {
    id: "mercury_orbit",
    name: "Mercury's Orbit",
    category: "stellar",
    log: 10,
    exactM: 1.15e10,
    metric: "1.15 × 10¹⁰ m",
    imperial: "7.15M mi (0.39 AU)",
    fact: "The orbital diameter of innermost planet Mercury around the blazing Sun, completed every 88 Earth days.",
    analogy: "The subtle relativistic precession of Mercury's orbit provided the very first empirical proof for Einstein's General Relativity.",
    draw: (c) => `
      <circle cx="60" cy="60" r="6" fill="#f59e0b"/>
      <ellipse cx="60" cy="60" rx="36" ry="32" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="3 3"/>
      <circle cx="96" cy="60" r="3.5" fill="#94a3b8"/>
      <text x="60" y="110" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">0.39 AU ORBIT</text>
    `,
  },
  {
    id: "earth_orbit",
    name: "Earth's Orbit (1 AU)",
    category: "stellar",
    log: 11,
    exactM: 1.496e11,
    metric: "1.50 × 10¹¹ m",
    imperial: "93.0M mi (1 AU)",
    fact: "The average distance between the Sun and Earth, designated as the baseline Astronomical Unit (AU) in celestial mechanics.",
    analogy: "A beam of light takes 8 minutes and 20 seconds to make this journey across the vacuum of interplanetary space.",
    draw: (c) => `
      <ellipse cx="60" cy="60" rx="44" ry="44" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="4 3"/>
      <circle cx="60" cy="60" r="8" fill="#f59e0b"/>
      <circle cx="104" cy="60" r="4" fill="#0284c7"/>
      <line x1="60" y1="60" x2="104" y2="60" stroke="#ffd166" stroke-width="1.5"/>
      <text x="82" y="55" font-size="8" font-family="monospace" fill="#ffd166">1 AU</text>
    `,
  },
  {
    id: "betelgeuse",
    name: "Betelgeuse (Red Supergiant)",
    category: "stellar",
    log: 12,
    exactM: 1.2e12,
    metric: "1.2 × 10¹² m",
    imperial: "745M mi (1.2B km)",
    fact: "Colossal pulsating red supergiant star in the constellation Orion, with a volume roughly 700 times larger than our Sun.",
    analogy: "If placed at the center of our Solar System, its surface would engulf Mercury, Venus, Earth, Mars, and Jupiter.",
    draw: (c) => `
      <defs>
        <radialGradient id="bet_g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="60%" stop-color="#ef4444"/>
          <stop offset="100%" stop-color="#450a0a"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="46" fill="url(#bet_g)" stroke="#dc2626" stroke-width="2.5"/>
      <circle cx="60" cy="60" r="4" fill="#fff"/>
      <text x="60" y="116" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">SUPERNOVA CANDIDATE</text>
    `,
  },
  {
    id: "jupiter_orbit",
    name: "Jupiter's Orbit",
    category: "stellar",
    log: 12,
    exactM: 1.56e12,
    metric: "1.56 × 10¹² m",
    imperial: "969M mi (10.4 AU)",
    fact: "The full diameter of Jupiter's orbital oval around the Sun, spanning 10.4 Astronomical Units.",
    analogy: "It takes Jupiter 11.86 Earth years to complete a single grand revolution along this massive orbital loop.",
    draw: (c) => `
      <ellipse cx="60" cy="60" rx="46" ry="46" fill="none" stroke="${c}" stroke-width="2"/>
      <ellipse cx="60" cy="60" rx="14" ry="14" fill="none" stroke="#64748b" stroke-dasharray="3 3"/>
      <circle cx="60" cy="60" r="6" fill="#f59e0b"/>
      <circle cx="106" cy="60" r="6" fill="#d97706"/>
      <text x="60" y="115" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">5.2 AU RADIUS</text>
    `,
  },
  {
    id: "solar_system",
    name: "Solar System to Neptune",
    category: "stellar",
    log: 13,
    exactM: 9.0e12,
    metric: "9.0 × 10¹² m",
    imperial: "5.6B mi (60 AU)",
    fact: "The primary planetary boundary of our solar system, bounded by Neptune's chilly orbit at 30 AU from the Sun.",
    analogy: "Radio messages traveling at the ultimate speed of light take over 4 hours to reach Earth from Neptune.",
    draw: (c) => `
      <circle cx="60" cy="60" r="5" fill="#f59e0b"/>
      <circle cx="60" cy="60" r="14" fill="none" stroke="#475569"/>
      <circle cx="60" cy="60" r="24" fill="none" stroke="#475569"/>
      <circle cx="60" cy="60" r="34" fill="none" stroke="#475569"/>
      <circle cx="60" cy="60" r="44" fill="none" stroke="${c}" stroke-width="2"/>
      <circle cx="104" cy="60" r="3.5" fill="#38bdf8"/>
    `,
  },
  {
    id: "voyager",
    name: "Voyager 1 Distance",
    category: "stellar",
    log: 13,
    exactM: 2.4e13,
    metric: "2.4 × 10¹³ m",
    imperial: "15.0B mi (162 AU)",
    fact: "Launched in 1977, Voyager 1 is the farthest human-made probe from Earth, traveling through interstellar space at 61,000 km/h.",
    analogy: "Its 23-watt radio signal takes more than 22 hours to make the one-way trip to NASA's Deep Space Network dishes.",
    draw: (c) => `
      <circle cx="60" cy="60" r="18" fill="none" stroke="#64748b" stroke-dasharray="3 3"/>
      <circle cx="60" cy="60" r="42" fill="none" stroke="${c}" stroke-width="2"/>
      <path d="M102 52 L94 68 M94 52 L102 68 M98 48 L98 72" stroke="#fff" stroke-width="2"/>
      <circle cx="98" cy="60" r="3" fill="#ffd166"/>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">INTERSTELLAR MEDIUM</text>
    `,
  },
  {
    id: "kuiper_cliff",
    name: "Kuiper Belt Outer Cliff",
    category: "stellar",
    log: 14,
    exactM: 1.5e14,
    metric: "1.5 × 10¹⁴ m",
    imperial: "93B mi (1,000 AU)",
    fact: "The sharp outer perimeter of the Kuiper Belt at roughly 50 AU, where the population of icy trans-Neptunian objects drops off dramatically.",
    analogy: "Believed by some planetary scientists to be gravitational evidence for an elusive giant planet shepherding distant icy debris.",
    draw: (c) => `
      <circle cx="60" cy="60" r="44" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="3 2"/>
      <circle cx="60" cy="60" r="28" fill="none" stroke="#64748b" stroke-dasharray="2 2"/>
      <circle cx="60" cy="60" r="4" fill="#f59e0b"/>
      <circle cx="96" cy="40" r="2" fill="#fff"/>
      <circle cx="30" cy="80" r="2" fill="#fff"/>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">KUIPER CLIFF (50 AU)</text>
    `,
  },

  // ── INTERSTELLAR & GALACTIC (10^15 to 10^21) ───────────────────
  {
    id: "oort_cloud",
    name: "Oort Cloud (Inner Boundary)",
    category: "galactic",
    log: 15,
    exactM: 3.0e15,
    metric: "3.0 × 10¹⁵ m",
    imperial: "1.86T mi (20,000 AU)",
    fact: "Enormous theoretical spherical reservoir of trillions of icy cometary planetesimals surrounding our solar system.",
    analogy: "The celestial home that launches long-period comets like Hale-Bopp on millions-of-years-long swoops toward the Sun.",
    draw: (c) => `
      <circle cx="60" cy="60" r="44" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="4 4"/>
      <circle cx="60" cy="60" r="20" fill="rgba(255,255,255,0.05)"/>
      <circle cx="60" cy="60" r="4" fill="#ffd166"/>
      <circle cx="88" cy="40" r="1.5" fill="#fff"/>
      <circle cx="34" cy="78" r="1.5" fill="#fff"/>
      <circle cx="75" cy="85" r="1.5" fill="#fff"/>
    `,
  },
  {
    id: "light_year",
    name: "One Light-Year",
    category: "galactic",
    log: 16,
    exactM: 9.46e15,
    metric: "9.46 × 10¹⁵ m",
    imperial: "5.88T mi (63,241 AU)",
    fact: "The astronomical distance a beam of light travels through a vacuum in one Julian year (365.25 days).",
    analogy: "If you drove a standard automobile non-stop at 100 km/h (60 mph), it would take over 10.8 million years to traverse this distance.",
    draw: (c) => `
      <line x1="20" y1="60" x2="100" y2="60" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
      <polygon points="100,60 88,52 88,68" fill="${c}"/>
      <circle cx="20" cy="60" r="4" fill="#fff"/>
      <text x="60" y="52" font-size="10" font-family="monospace" fill="${c}" text-anchor="middle">c × 1 YEAR</text>
      <text x="60" y="80" font-size="9" font-family="monospace" fill="#94a3b8" text-anchor="middle">9.46 TRILLION KM</text>
    `,
  },
  {
    id: "proxima",
    name: "Proxima Centauri System",
    category: "galactic",
    log: 16,
    exactM: 4.01e16,
    metric: "4.01 × 10¹⁶ m",
    imperial: "2.49 × 10¹³ mi (4.24 ly)",
    fact: "The nearest known star system to our Sun at 4.24 light-years, hosting the terrestrial-mass exoplanet Proxima b.",
    analogy: "With current chemical rockets, traveling to Proxima Centauri would take over 75,000 years of transit time.",
    draw: (c) => `
      <circle cx="35" cy="50" r="10" fill="#f59e0b"/>
      <circle cx="55" cy="42" r="8" fill="#ea580c"/>
      <circle cx="85" cy="75" r="5" fill="#ef4444"/>
      <circle cx="95" cy="80" r="2" fill="#38bdf8"/>
      <text x="60" y="110" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">TRIPLE STAR SYSTEM</text>
    `,
  },
  {
    id: "crab_nebula",
    name: "Crab Nebula (Supernova Remnant)",
    category: "galactic",
    log: 17,
    exactM: 1.0e17,
    metric: "1.0 × 10¹⁷ m",
    imperial: "11 light-years (1.0 × 10¹⁷ m)",
    fact: "Expanding nebula spanning 11 light-years, the glowing debris of a core-collapse supernova recorded by astronomers in 1054 AD.",
    analogy: "At its core lies a pulsar spinning 30 times a second, firing twin beams of radiation like a cosmic lighthouse.",
    draw: (c) => `
      <path d="M30 40 Q60 15 90 40 Q110 70 85 90 Q45 105 30 75 Z" fill="rgba(239,68,68,0.25)" stroke="#ef4444" stroke-width="2.5"/>
      <path d="M45 45 Q65 30 75 55 Q80 80 55 75 Z" fill="rgba(0,240,255,0.3)" stroke="${c}" stroke-width="2"/>
      <circle cx="60" cy="60" r="3" fill="#fff"/>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">SN 1054 REMNANT</text>
    `,
  },
  {
    id: "pillars_creation",
    name: "Pillars of Creation",
    category: "galactic",
    log: 17,
    exactM: 4.7e17,
    metric: "4.7 × 10¹⁷ m",
    imperial: "5.0 light-years (4.7 × 10¹⁷ m)",
    fact: "Towering finger-like columns of cold interstellar hydrogen gas and dust inside the Eagle Nebula where young stars are actively coalescing.",
    analogy: "The tallest pillar is approximately 4 to 5 light-years tall—stretching farther than the distance from our Sun to Alpha Centauri.",
    draw: (c) => `
      <path d="M38 100 L38 45 Q44 35 50 48 L50 100" fill="rgba(180,83,9,0.5)" stroke="#f59e0b" stroke-width="2"/>
      <path d="M52 100 L52 30 Q58 20 64 32 L64 100" fill="rgba(180,83,9,0.6)" stroke="#f59e0b" stroke-width="2"/>
      <path d="M66 100 L66 50 Q72 40 78 52 L78 100" fill="rgba(180,83,9,0.5)" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="58" cy="24" r="2.5" fill="#fff"/>
      <circle cx="44" cy="38" r="2" fill="#38bdf8"/>
    `,
  },
  {
    id: "orion_nebula",
    name: "Orion Nebula (M42)",
    category: "galactic",
    log: 18,
    exactM: 2.3e18,
    metric: "2.3 × 10¹⁸ m",
    imperial: "24 light-years (2.3 × 10¹⁸ m)",
    fact: "Luminous diffuse nebula in Orion spanning 24 light-years, representing the closest massive star-forming region to Earth.",
    analogy: "Visible to the naked eye as a fuzzy star in Orion's sword, harboring hundreds of protoplanetary disks birthing solar systems.",
    draw: (c) => `
      <defs>
        <radialGradient id="or_g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ec4899"/>
          <stop offset="60%" stop-color="#7c3aed"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="60" rx="46" ry="34" fill="url(#or_g)"/>
      <circle cx="56" cy="56" r="3" fill="#fff"/>
      <circle cx="64" cy="54" r="3" fill="#fff"/>
      <circle cx="58" cy="64" r="2.5" fill="#ffd166"/>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">STELLAR NURSERY</text>
    `,
  },
  {
    id: "omega_centauri",
    name: "Omega Centauri Globular Cluster",
    category: "galactic",
    log: 19,
    exactM: 1.4e19,
    metric: "1.4 × 10¹⁹ m",
    imperial: "150 light-years (1.4 × 10¹⁹ m)",
    fact: "The largest globular cluster orbiting the Milky Way, packing roughly 10 million ancient stars into a sphere 150 light-years across.",
    analogy: "Widely suspected to be the stripped nucleus remnant of a dwarf galaxy captured by the Milky Way billions of years ago.",
    draw: (c) => `
      <circle cx="60" cy="60" r="38" fill="rgba(255,255,255,0.08)" stroke="${c}" stroke-dasharray="3 3"/>
      <g fill="#fff">
        <circle cx="60" cy="60" r="3"/><circle cx="56" cy="54" r="2"/><circle cx="64" cy="66" r="2"/>
        <circle cx="52" cy="62" r="1.5"/><circle cx="68" cy="56" r="1.5"/><circle cx="60" cy="48" r="1.5"/>
        <circle cx="62" cy="72" r="1.5"/><circle cx="48" cy="52" r="1"/><circle cx="72" cy="68" r="1"/>
      </g>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">10 MILLION STARS</text>
    `,
  },
  {
    id: "smc",
    name: "Small Magellanic Cloud",
    category: "galactic",
    log: 20,
    exactM: 6.6e20,
    metric: "6.6 × 10²⁰ m",
    imperial: "7,000 light-years (6.6 × 10²⁰ m)",
    fact: "An irregular dwarf galaxy gravitationally orbiting the Milky Way at 200,000 light-years, containing several hundred million stars.",
    analogy: "Gravitational tides from the Milky Way are actively pulling streams of hydrogen gas out of the cloud into interstellar space.",
    draw: (c) => `
      <path d="M30 65 Q45 35 75 45 Q95 65 70 80 Q45 85 30 65 Z" fill="rgba(168,85,247,0.25)" stroke="#a855f7" stroke-width="2"/>
      <circle cx="55" cy="55" r="3" fill="#fff"/>
      <circle cx="70" cy="60" r="2" fill="#38bdf8"/>
      <circle cx="45" cy="65" r="2" fill="#ffd166"/>
      <text x="60" y="110" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">DWARF GALAXY</text>
    `,
  },
  {
    id: "milkyway",
    name: "Milky Way Galaxy",
    category: "galactic",
    log: 21,
    exactM: 1.0e21,
    metric: "1.0 × 10²¹ m",
    imperial: "100,000 light-years (1.0 × 10²¹ m)",
    fact: "Barred spiral galaxy home to our Solar System and an estimated 100 to 400 billion other stars across four major spiral arms.",
    analogy: "Its supermassive black hole Sagittarius A* at the central core possesses the mass of 4.3 million Suns.",
    draw: (c) => `
      <ellipse cx="60" cy="60" rx="48" ry="18" fill="none" stroke="${c}" stroke-width="2.5" transform="rotate(-25 60 60)"/>
      <ellipse cx="60" cy="60" rx="30" ry="10" fill="none" stroke="#ffd166" stroke-width="2" transform="rotate(-25 60 60)"/>
      <circle cx="60" cy="60" r="7" fill="#fff"/>
      <circle cx="42" cy="52" r="3" fill="#38bdf8"/>
      <text x="32" y="42" font-size="8" font-family="monospace" fill="#38bdf8">YOU ARE HERE</text>
    `,
  },
  {
    id: "andromeda",
    name: "Andromeda Galaxy (M31)",
    category: "galactic",
    log: 21,
    exactM: 2.1e21,
    metric: "2.1 × 10²¹ m",
    imperial: "220,000 light-years (2.1 × 10²¹ m)",
    fact: "The largest galaxy in the Local Group, spanning 220,000 light-years and containing roughly 1 trillion stars.",
    analogy: "Approaching the Milky Way at 110 km/s—the two giants will collide and merge into 'Milkomeda' in roughly 4.5 billion years.",
    draw: (c) => `
      <ellipse cx="60" cy="60" rx="52" ry="20" fill="none" stroke="#38bdf8" stroke-width="2.5" transform="rotate(20 60 60)"/>
      <ellipse cx="60" cy="60" rx="34" ry="12" fill="none" stroke="#c084fc" stroke-width="2" transform="rotate(20 60 60)"/>
      <circle cx="60" cy="60" r="8" fill="#fff"/>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">1 TRILLION STARS</text>
    `,
  },

  // ── EXTRAGALACTIC TO OBSERVABLE UNIVERSE (10^22 to 10^27) ─────
  {
    id: "local_group",
    name: "Local Group of Galaxies",
    category: "cosmic",
    log: 22,
    exactM: 3.0e22,
    metric: "3.0 × 10²² m",
    imperial: "3.18M light-years (3.0 × 10²² m)",
    fact: "Gravitationally bound cluster spanning 10 million light-years, dominated by Andromeda and the Milky Way along with 80 dwarf galaxies.",
    analogy: "Everything inside the Local Group is gravitationally bound; outside it, cosmic expansion carries all other galaxies away.",
    draw: (c) => `
      <circle cx="60" cy="60" r="45" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="4 3"/>
      <ellipse cx="44" cy="48" rx="14" ry="6" fill="#38bdf8" transform="rotate(-15 44 48)"/>
      <ellipse cx="76" cy="68" rx="18" ry="7" fill="#c084fc" transform="rotate(20 76 68)"/>
      <circle cx="35" cy="75" r="2.5" fill="#fff"/>
      <circle cx="82" cy="40" r="2.5" fill="#fff"/>
      <text x="60" y="114" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">80+ BOUND GALAXIES</text>
    `,
  },
  {
    id: "virgo_cluster",
    name: "Virgo Galaxy Cluster",
    category: "cosmic",
    log: 23,
    exactM: 1.4e23,
    metric: "1.4 × 10²³ m",
    imperial: "15M light-years (1.4 × 10²³ m)",
    fact: "Colossal gravitational cluster of 1,500 to 2,000 galaxies anchored by the supermassive elliptical galaxy Messier 87.",
    analogy: "M87 at its heart contains the famous supermassive black hole with a mass of 6.5 billion Suns imaged by the Event Horizon Telescope.",
    draw: (c) => `
      <circle cx="60" cy="60" r="16" fill="rgba(234,179,8,0.4)" stroke="#eab308" stroke-width="2"/>
      <circle cx="60" cy="60" r="5" fill="#fff"/>
      <ellipse cx="38" cy="40" rx="8" ry="4" fill="#38bdf8"/>
      <ellipse cx="80" cy="42" rx="7" ry="3" fill="#c084fc"/>
      <ellipse cx="42" cy="80" rx="6" ry="3" fill="#38bdf8"/>
      <ellipse cx="78" cy="78" rx="9" ry="4" fill="#c084fc"/>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">M87 CORE ANCHOR</text>
    `,
  },
  {
    id: "laniakea",
    name: "Laniakea Supercluster",
    category: "cosmic",
    log: 24,
    exactM: 5.0e24,
    metric: "5.0 × 10²⁴ m",
    imperial: "520M light-years (5.0 × 10²⁴ m)",
    fact: "Immense supercluster spanning 520 million light-years containing 100,000 galaxies all flowing along streamlines toward the Great Attractor.",
    analogy: "Hawaiian for 'immeasurable heaven'—it maps our cosmic gravitational watershed valley in the vast web of space.",
    draw: (c) => `
      <path d="M20 70 Q45 40 60 55 T100 45" fill="none" stroke="${c}" stroke-width="3"/>
      <path d="M30 30 Q55 50 60 55 T85 85" fill="none" stroke="#ec4899" stroke-width="2.5"/>
      <circle cx="60" cy="55" r="6" fill="#ef4444"/>
      <text x="60" y="38" font-size="8" font-family="monospace" fill="#ef4444" text-anchor="middle">GREAT ATTRACTOR</text>
      <text x="60" y="112" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">100,000 GALAXIES</text>
    `,
  },
  {
    id: "cosmic_web",
    name: "The Cosmic Web",
    category: "cosmic",
    log: 25,
    exactM: 2.5e25,
    metric: "2.5 × 10²⁵ m",
    imperial: "2.64B light-years (2.5 × 10²⁵ m)",
    fact: "The largest coherent structure in the cosmos: gigantic filaments of dark matter and gas interconnecting galaxy nodes across giant voids.",
    analogy: "Resembles an infinite biological neural network or sponge, where cosmic voids span hundreds of millions of light-years of near-vacuum.",
    draw: (c) => `
      <path d="M15 25 L50 45 L85 20 M50 45 L60 80 L105 90 M60 80 L25 95" fill="none" stroke="${c}" stroke-width="2"/>
      <path d="M50 45 L60 80" fill="none" stroke="#fff" stroke-width="3"/>
      <circle cx="50" cy="45" r="5" fill="#38bdf8"/>
      <circle cx="60" cy="80" r="5" fill="#38bdf8"/>
      <circle cx="15" cy="25" r="3" fill="#a855f7"/>
      <circle cx="85" cy="20" r="3" fill="#a855f7"/>
      <circle cx="105" cy="90" r="3" fill="#a855f7"/>
      <circle cx="25" cy="95" r="3" fill="#a855f7"/>
      <text x="60" y="114" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">DARK MATTER FILAMENTS</text>
    `,
  },
  {
    id: "cmb_horizon",
    name: "CMB Thermal Horizon",
    category: "cosmic",
    log: 26,
    exactM: 4.4e26,
    metric: "4.4 × 10²⁶ m",
    imperial: "46.5B light-years (4.4 × 10²⁶ m)",
    fact: "The surface of last scattering: relic thermal radiation emitted 380,000 years after the Big Bang when neutral hydrogen atoms first formed.",
    analogy: "The oldest light in the cosmos, redshifted by cosmic expansion into a uniform 2.725 Kelvin microwave bath permeating all of space.",
    draw: (c) => `
      <circle cx="60" cy="60" r="44" fill="none" stroke="#ef4444" stroke-width="3"/>
      <circle cx="60" cy="60" r="38" fill="none" stroke="#00f0ff" stroke-width="2" stroke-dasharray="5 3"/>
      <circle cx="60" cy="60" r="28" fill="none" stroke="#ffd166" stroke-width="1.5" stroke-dasharray="3 2"/>
      <circle cx="60" cy="60" r="4" fill="#fff"/>
      <text x="60" y="114" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">T = 2.725 KELVIN</text>
    `,
  },
  {
    id: "universe",
    name: "Observable Universe",
    category: "cosmic",
    log: 27,
    exactM: 8.8e26,
    metric: "8.8 × 10²⁶ m",
    imperial: "93B light-years (8.8 × 10²⁶ m)",
    fact: "The spherical boundary of reality whose light has had time to reach Earth since the Big Bang 13.8 billion years ago.",
    analogy: "Contains an estimated 2 trillion galaxies and 10⁸⁰ fundamental subatomic particles—and beyond its edge, reality extends onward endlessly.",
    draw: (c) => `
      <defs>
        <radialGradient id="univ_g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff"/>
          <stop offset="25%" stop-color="#38bdf8"/>
          <stop offset="70%" stop-color="#7c3aed"/>
          <stop offset="100%" stop-color="#020308"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="46" fill="url(#univ_g)" stroke="#38bdf8" stroke-width="2.5"/>
      <circle cx="60" cy="60" r="2" fill="#fff"/>
      <text x="60" y="116" font-size="9" font-family="monospace" fill="${c}" text-anchor="middle">93 BILLION LIGHT-YEARS</text>
    `,
  },
];

export function formatMetricExponent(log) {
  const rounded = Math.round(log);
  if (rounded === 0) return "1.00 METRE (10⁰ m)";
  const sup = String(rounded)
    .replace(/-/g, "⁻")
    .replace(/0/g, "⁰")
    .replace(/1/g, "¹")
    .replace(/2/g, "²")
    .replace(/3/g, "³")
    .replace(/4/g, "⁴")
    .replace(/5/g, "⁵")
    .replace(/6/g, "⁶")
    .replace(/7/g, "⁷")
    .replace(/8/g, "⁸")
    .replace(/9/g, "⁹");
  return `10${sup} METRES`;
}

export function formatScientificNotation(exactM) {
  if (!exactM || exactM <= 0) return "";
  const exp = Math.floor(Math.log10(exactM));
  const coef = (exactM / Math.pow(10, exp)).toFixed(2);
  const sup = String(exp)
    .replace(/-/g, "⁻")
    .replace(/0/g, "⁰")
    .replace(/1/g, "¹")
    .replace(/2/g, "²")
    .replace(/3/g, "³")
    .replace(/4/g, "⁴")
    .replace(/5/g, "⁵")
    .replace(/6/g, "⁶")
    .replace(/7/g, "⁷")
    .replace(/8/g, "⁸")
    .replace(/9/g, "⁹");
  return `${coef} × 10${sup} m`;
}

export function calculateScaleRatio(itemA, itemB) {
  const logDiff = Math.abs(itemA.log - itemB.log);
  const ratio = Math.pow(10, logDiff);
  const bigger = itemA.log >= itemB.log ? itemA : itemB;
  const smaller = itemA.log < itemB.log ? itemA : itemB;
  return { logDiff, ratio, bigger, smaller };
}
