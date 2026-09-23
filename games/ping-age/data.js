/**
 * SYS://TIMESINK.NET — Ping Age: Digital Archaeology & Culture Matrix
 * 12 culturally authentic questions spanning Web 1.0 dial-up to hyper-accelerated brainrot.
 */

export const ERAS = [
  {
    id: "dialup",
    name: "DIAL-UP NATIVE",
    dates: "1995 — 2001",
    themeClass: "era-dialup",
    color: "#00ff66",
    accent: "green",
    archetype: "Web 1.0 Pioneer & Modem Whisperer",
    desc: "You remember the screeching handshake of a 56k USRobotics modem, waiting 12 minutes for a single interlaced GIF to load scanline by scanline, and genuine family screaming matches when someone picked up the kitchen telephone mid-download. You built tables-based GeoCities pages with animated flame dividers and survived the dawn of the internet.",
    dossier: {
      relic: "A 3.5\" Verbatim Floppy Disk containing a 140KB Doom II text walkthrough",
      habitat: "The family beige computer tower in the living room under strict 45-minute parental curfew",
      trauma: "Mom picking up the landline phone at 99.4% download completion of a 4MB file",
      superpower: "Can predict the exact baud rate of an internet connection strictly by the pitch of modem squeals",
    },
  },
  {
    id: "myspace",
    name: "MYSPACE GENERATION",
    dates: "2002 — 2008",
    themeClass: "era-myspace",
    color: "#ff007f",
    accent: "pink",
    archetype: "Rawr xD Sovereign & HTML Alchemist",
    desc: "You taught yourself advanced CSS stylesheets just to embed autoplaying Hawthorne Heights songs and custom glitter cursors on your profile. Your MySpace Top 8 rankings caused catastrophic real-world diplomatic fallouts among middle school friends, and AIM away messages were tactical weapons of passive-aggressive emotional warfare.",
    dossier: {
      relic: "A hot-pink rhinestone-studded Motorola RAZR V3 with cracked antenna stub",
      habitat: "Hunched over a Gateway desktop in a dark bedroom editing HTML stylesheets at 1:45 AM",
      trauma: "Being ruthlessly demoted from #1 to #8 on your best friend's public MySpace Top 8 without warning",
      superpower: "Can type 85 words per minute on a numeric T9 keypad under your desk without looking",
    },
  },
  {
    id: "meme",
    name: "GOLDEN MEME ERA",
    dates: "2009 — 2014",
    themeClass: "era-meme",
    color: "#ff5500",
    accent: "orange",
    archetype: "Decentralized Chaos Lord & Golden Age Veteran",
    desc: "Impact font top-and-bottom text macros, Rage Comics with 'Trollface' and 'Me Gusta', 6-second Vine loops, and the Harlem Shake flash mob. You witnessed the untamed wild-west renaissance of user-generated internet culture before algorithmic surveillance and corporate monopolies sanitised the web.",
    dossier: {
      relic: "A jailbroken 2nd-generation cracked iPod Touch running pirated Doodle Jump on iOS 4",
      habitat: "Middle school computer lab frantically hitting Alt+Tab away from Happy Wheels before the teacher looks",
      trauma: "Clicking a disguised link sent by your best friend and getting blast-screamed by the Scary Maze Exorcist face",
      superpower: "Can quote entire 2011 YouTube Poop and Charlie the Unicorn videos verbatim from memory",
    },
  },
  {
    id: "feed",
    name: "THE FEED ERA",
    dates: "2015 — 2020",
    themeClass: "era-feed",
    color: "#9d4edd",
    accent: "purple",
    archetype: "Curated Nihilist & Algorithmic Prisoner",
    desc: "Infinite scroll, algorithmic dopamine feedback loops, dark-mode aesthetic despair, and Instagram stories. You watched the entire creative expanse of the worldwide web consolidate into four giant corporate walled gardens engineered to monetize your exact attention span down to the millisecond.",
    dossier: {
      relic: "A cracked rose-gold iPhone with a marble PopSocket and tangled white wired Apple earbuds",
      habitat: "Cocooned in bedsheets in total darkness doomscrolling an algorithmic FYP until 4:18 AM",
      trauma: "Accidentally hearting a 7-year-old vacation photo on an ex's profile during a 3:14 AM stalking session",
      superpower: "Can identify an influencer's exact apartment block from a 0.4-second reflection in their sunglasses",
    },
  },
  {
    id: "brainrot",
    name: "BRAINROT PROTOCOL",
    dates: "2021 — PRESENT",
    themeClass: "era-brainrot",
    color: "#00f0ff",
    accent: "cyan",
    archetype: "Hyper-Stimulated Oracle of the Multiverse",
    desc: "Skibidi Ohio Fanum tax gigachad sigma rizzler. Kinetic sand slicing and Subway Surfers gameplay occupying the bottom half of the screen because a single video stream cannot hold your attention. Your cognitive operating system operates at 3.5x playback speed and reality itself feels like a deep-fried simulation.",
    dossier: {
      relic: "A rainbow RGB mechanical gaming keyboard missing the W key and coated in spicy Takis dust",
      habitat: "A battle station glowing radioactive magenta running Discord, Roblox, and 3 TikTok streams at once",
      trauma: "Accidentally unmuting ear-destroying distorted phonk meme audio during a dead-silent lecture hall",
      superpower: "Can simultaneously absorb, synthesize, and judge four independent high-speed media streams without blinking",
    },
  },
];

export const REACTIONS = {
  dialup: {
    sound: "dialup",
    text: "[AOL MODEM SQUEAL: 56K HANDSHAKE CONNECTED]",
    tag: "DIAL-UP HANDSHAKE",
  },
  myspace: {
    sound: "good",
    text: "[MSN MESSENGER NUDGE: *BUZZ* - AWAY STATUS POSTED]",
    tag: "TOP 8 DIPLOMACY",
  },
  meme: {
    sound: "coin",
    text: "[TROLLFACE DEPLOYED: PROBLEM, OFFICER?]",
    tag: "RAGE COMIC VIBE",
  },
  feed: {
    sound: "hover",
    text: "[ALGORITHMIC DOPAMINE HIT: +1 NOTIFICATION]",
    tag: "FEED REFRESH",
  },
  brainrot: {
    sound: "bad",
    text: "[SKIBIDI FREQUENCY DETECTED: +1000 AURA NO CAP]",
    tag: "BRAINROT OVERLOAD",
  },
};

export const QUESTIONS = [
  {
    category: "COMMUNICATION PROTOCOL",
    text: "A message alert breaks the silence. How are you handling this incoming ping?",
    options: [
      {
        label: "A/S/L? before frantically typing '*BRB gotta log off, mom needs to call Aunt Linda*'",
        eras: ["dialup"],
      },
      {
        label: "Change your MSN / AIM status to vague passive-aggressive Dashboard Confessional lyrics in alternating caps",
        eras: ["myspace"],
      },
      {
        label: "Reply with an Advice Animal image macro or a hand-drawn MS Paint Rage Comic ('U JELLY, BRO?')",
        eras: ["meme"],
      },
      {
        label: "Leave on 'Delivered' for 14 hours, then send an unprompted pitch-black Snapchat selfie with no caption",
        eras: ["feed"],
      },
      {
        label: "Reply 'blud really thought he was him 💀' with 17 skull emojis and a deep-fried cat gif",
        eras: ["brainrot"],
      },
    ],
  },
  {
    category: "AUDIO INGESTION & PIRACY",
    text: "How did your ears acquire their musical sustenance on a desktop computer?",
    options: [
      {
        label: "Winamp with an alien neon-green skin, listening to 'It really whips the llama's ass!' on repeat at 64kbps",
        eras: ["dialup"],
      },
      {
        label: "LimeWire downloading 'Linkin_Park_InTheEnd_REAL_NO_VIRUS.mp3.exe' (computer caught 48 trojan toolbars)",
        eras: ["myspace"],
      },
      {
        label: "240p YouTube video with Windows Movie Maker blue title card and 009 Sound System 'Dreamscape' playing over a Notepad tutorial",
        eras: ["meme"],
      },
      {
        label: "Spotify Discover Weekly or SoundCloud rap algorithm feeding you customized 2 AM melancholia",
        eras: ["feed"],
      },
      {
        label: "7-second 2.5x bass-boosted Brazilian Phonk loop overlaid onto an ASMR kinetic sand slicing video",
        eras: ["brainrot"],
      },
    ],
  },
  {
    category: "DIGITAL CATASTROPHE",
    text: "What technological crisis caused you genuine, room-spinning cold sweats?",
    options: [
      {
        label: "A 14MB RealPlayer video download stalling out at 99% because your sibling picked up the kitchen telephone",
        eras: ["dialup"],
      },
      {
        label: "Leaving your AIM away message active on a public high-school library computer containing your diary",
        eras: ["myspace"],
      },
      {
        label: "Sending your friend a link to the 'Scary Maze Game' and hearing their parents scream downstairs at the exorcist face",
        eras: ["meme"],
      },
      {
        label: "Accidentally double-tapping to 'Like' an ex-partner's vacation photo from July 2013 at 3:14 AM",
        eras: ["feed"],
      },
      {
        label: "Your phone blasting distorted ear-destroying TikTok audio at maximum volume in an eerily silent waiting room",
        eras: ["brainrot"],
      },
    ],
  },
  {
    category: "DEFINITIVE GAMING ADDICTION",
    text: "Which sacred digital playground devoured your formative waking hours?",
    options: [
      {
        label: "3D Pinball: Space Cadet & Microsoft Encarta MindMaze while listening to the CD-ROM drive whirr like a jet engine",
        eras: ["dialup"],
      },
      {
        label: "Club Penguin iceberg tipping vigils, Habbo Hotel pool closures, and rushing home to feed your Neopets omelette",
        eras: ["myspace"],
      },
      {
        label: "Happy Wheels obstacle courses on TotalJerkface, Coolmath Games Run 2, and dodging Slender Man in the woods",
        eras: ["meme"],
      },
      {
        label: "Dropping Tilted Towers with the boys in Fortnite Season 3 or emergency meetings in Among Us over Discord",
        eras: ["feed"],
      },
      {
        label: "A Roblox 'Escape Grimace Shake Skibidi Toilet Obby [FREE ADMIN]' with rainbow speed coils",
        eras: ["brainrot"],
      },
    ],
  },
  {
    category: "SOCIAL DOMINANCE & FLEX",
    text: "What was the absolute pinnacle flex that established you as digital royalty?",
    options: [
      {
        label: "Memorizing a 6-digit ICQ number and hitting 10,000 visitors on your GeoCities visitor counter gif",
        eras: ["dialup"],
      },
      {
        label: "Cold-bloodedly banishing your best friend from #1 to #7 on your MySpace Top 8 without an explanation",
        eras: ["myspace"],
      },
      {
        label: "Having your sarcastic parody tweet retweeted by @Horse_ebooks or featured on Tosh.0",
        eras: ["meme"],
      },
      {
        label: "Being granted access to someone's private 9-person Close Friends story or flexing a 500-day Snap streak",
        eras: ["feed"],
      },
      {
        label: "Gifting 50 Tier 3 subs in Kai Cenat's stream and having chat spam 'W RIZZ' for 1.8 seconds",
        eras: ["brainrot"],
      },
    ],
  },
  {
    category: "PERMANENT VIRAL CINEMA",
    text: "Which legendary moving picture is permanently etched into your cerebral cortex?",
    options: [
      {
        label: "The 1996 Dancing Baby (Ooga-Chaka) 3D rendered looping gif and the dancing hamster song",
        eras: ["dialup"],
      },
      {
        label: "Charlie the Unicorn Candy Mountain, Potter Puppet Pals ('Snape, Snape, Severus Snape'), and Evolution of Dance",
        eras: ["myspace"],
      },
      {
        label: "The Harlem Shake classroom explosions, Gangnam Style hitting 1 Billion views, and Nyan Cat on a 10-hour loop",
        eras: ["meme"],
      },
      {
        label: "The Area 51 Naruto runner caught live behind a news anchor and MrBeast's real-life Squid Game",
        eras: ["feed"],
      },
      {
        label: "Skibidi Toilet Episode 70 epic Titan Cameraman war saga with full orchestral Hans Zimmer mixing",
        eras: ["brainrot"],
      },
    ],
  },
  {
    category: "HARDWARE RELIC & STREET CRED",
    text: "Which physical device or setup conferred immediate god-tier street status?",
    options: [
      {
        label: "A Bondi-blue translucent Apple iMac G3 with matching hockey-puck mouse and dial-up external USRobotics modem",
        eras: ["dialup"],
      },
      {
        label: "A hot-pink or metallic brushed Motorola RAZR V3 snapped shut with extreme violent finality",
        eras: ["myspace"],
      },
      {
        label: "A jailbroken iPod Touch 2nd Gen with custom cracked glass and Cydia pirated Doodle Jump installed",
        eras: ["meme"],
      },
      {
        label: "Matte rose-gold iPhone with a matching marble PopSocket and tangled white Apple wired earbuds",
        eras: ["feed"],
      },
      {
        label: "A triple-monitor desk setup glowing radioactive magenta with custom coiled aviator cable and vertical TikTok screen",
        eras: ["brainrot"],
      },
    ],
  },
  {
    category: "PHOTOGRAPHIC AESTHETIC",
    text: "What visual filter or photographic crime defined every image you uploaded?",
    options: [
      {
        label: "A 320x240 webcam grain snapshot with the date 'OCT 14 1998' burned in bright radioactive yellow",
        eras: ["dialup"],
      },
      {
        label: "The signature 75-degree overhead arm-stretch angle with blinding mirror flash hiding half your face",
        eras: ["myspace"],
      },
      {
        label: "Clarendon or Valencia filter cranked to 100% saturation with a thick white square border framing everything",
        eras: ["meme"],
      },
      {
        label: "A blurry candid 0.5x ultra-wide lens flash photo taken in an elevator with a sparkle emoji caption",
        eras: ["feed"],
      },
      {
        label: "Deep-fried red laser flare eyes, heavy motion blur, and a bottom caption reading 'Bros aura is unmatched'",
        eras: ["brainrot"],
      },
    ],
  },
  {
    category: "THE INTERNET CIVIL WAR",
    text: "Which seismic debate split your entire social circle into violently opposing factions?",
    options: [
      {
        label: "Whether The Blair Witch Project was genuine police evidence recovered from the Black Hills Forest",
        eras: ["dialup"],
      },
      {
        label: "The international scientific outrage over Pluto being stripped of its official planetary classification",
        eras: ["myspace"],
      },
      {
        label: "Is The Dress blue-and-black or white-and-gold? (Followed by the Yanny vs. Laurel auditory panic)",
        eras: ["meme"],
      },
      {
        label: "The 'Storm Area 51: They Can't Stop All of Us' invasion strategy and Team Edward vs Team Jacob",
        eras: ["feed"],
      },
      {
        label: "Debating who possesses more negative aura: Baby Gronk rizzing Livvy Dunne or the Ohio Rizzler",
        eras: ["brainrot"],
      },
    ],
  },
  {
    category: "RESEARCH PROTOCOL",
    text: "You urgently need answers to a burning life question. Where is your query directed?",
    options: [
      {
        label: "Typing a polite query into Ask Jeeves, or popping in Microsoft Encarta 97 CD-ROM Disc 2",
        eras: ["dialup"],
      },
      {
        label: "Yahoo! Answers ('How is babby formed? How girl get pragnent?') hoping a top contributor replies",
        eras: ["myspace"],
      },
      {
        label: "A 4-hour midnight Wikipedia hyperlink binge starting at Ancient Rome and ending at Quantum Entanglement",
        eras: ["meme"],
      },
      {
        label: "Typing your query into Google followed strictly by the magical keyword 'reddit' to bypass sponsored SEO sludge",
        eras: ["feed"],
      },
      {
        label: "Asking ChatGPT to explain the geopolitical collapse of the USSR while watching Minecraft parkour on splitscreen",
        eras: ["brainrot"],
      },
    ],
  },
  {
    category: "INCURABLE LINGO",
    text: "Which cursed dialect phrase occasionally escapes your lips in civilized conversation?",
    options: [
      {
        label: "'WAZZUUUP?!', 'L8R SK8R', 'Talk to the hand', or 'Totally radical, dude!'",
        eras: ["dialup"],
      },
      {
        label: "'Rawr xD means I love you in dinosaur', 'EPIC FAIL', 'Pwned', and ':3 c:'",
        eras: ["myspace"],
      },
      {
        label: "'YOLO', 'Much doge, very wow', 'Such amaze', and 'Cool story bro, tell it again'",
        eras: ["meme"],
      },
      {
        label: "'Living rent-free in my head', 'Big mood', 'I'm screaming', and 'It's the audacity for me'",
        eras: ["feed"],
      },
      {
        label: "'Mewing streak', 'What the sigma', 'Fanum tax', and 'Bro has zero gyatt'",
        eras: ["brainrot"],
      },
    ],
  },
  {
    category: "THE 2:37 AM PSYCHE",
    text: "The clock strikes 2:37 AM on a school/work night. What glowing phantom holds you in its trance?",
    options: [
      {
        label: "The 3D Pipes / 3D Maze Windows 98 screensaver undulating endlessly in a pitch-black wood-paneled room",
        eras: ["dialup"],
      },
      {
        label: "Staring at an empty AIM buddy list, refreshing your profile to test if the autoplaying Fall Out Boy song loops",
        eras: ["myspace"],
      },
      {
        label: "Reading Russian Sleep Experiment and Smile Dog creepypastas under bedsheets with the flashlight on",
        eras: ["meme"],
      },
      {
        label: "Doomscrolling an infinite algorithmic video feed while the 24/7 Lofi Hip Hop Girl studies eternally",
        eras: ["feed"],
      },
      {
        label: "A live streamer whispering 'Ice cream so good, gang gang, yes yes yes' while dancing on a green screen",
        eras: ["brainrot"],
      },
    ],
  },
];

/**
 * Fisher-Yates shuffle returning a new copy of array
 */
export function shuffleArray(arr, rng = Math.random) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Determine the winning era, with tie-breaking favoring earlier historical eras
 */
export function calculateWinningEra(scores, eras = ERAS) {
  let maxScore = -1;
  let winner = eras[0];

  for (const era of eras) {
    const s = scores[era.id] || 0;
    if (s > maxScore) {
      maxScore = s;
      winner = era;
    }
  }
  return winner;
}

/**
 * Compute the Hybrid DNA breakdown percentages for all eras
 */
export function calculateHybridDna(scores, total = 12, eras = ERAS) {
  return eras.map((era) => {
    const count = scores[era.id] || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return {
      id: era.id,
      name: era.name,
      dates: era.dates,
      color: era.color,
      count,
      pct,
    };
  });
}

/**
 * Check if the selections represent a Time Traveller (spans 3+ non-adjacent eras)
 */
export function checkTimeTraveller(chosenEraIndices) {
  const uniqueIndices = [...new Set(chosenEraIndices)].sort((a, b) => a - b);
  if (uniqueIndices.length >= 3) {
    const span = uniqueIndices[uniqueIndices.length - 1] - uniqueIndices[0];
    let nonAdjacent = 0;
    for (let i = 1; i < uniqueIndices.length; i++) {
      if (uniqueIndices[i] - uniqueIndices[i - 1] > 1) {
        nonAdjacent++;
      }
    }
    return span >= 3 || nonAdjacent >= 1;
  }
  return false;
}

/**
 * Evaluate all eligible special recognition badges
 */
export function evaluateBadges(scores, chosenEraIndices, eras = ERAS) {
  const badges = [];

  // 1. Time Traveller: spans 3+ non-adjacent eras
  if (checkTimeTraveller(chosenEraIndices)) {
    badges.push({
      id: "time-traveller",
      icon: "⌛",
      name: "TIME TRAVELLER",
      desc: "Answers span 3+ non-adjacent digital epochs across history.",
      badgeClass: "badge-tt",
    });
  }

  // 2. Era Purist: >= 9 answers (75%+) in a single era
  const maxEraScore = Math.max(...eras.map((e) => scores[e.id] || 0));
  if (maxEraScore >= 9) {
    badges.push({
      id: "era-purist",
      icon: "💾",
      name: "ERA PURIST",
      desc: "Over 75% of answers concentrated in a single digital timeline.",
      badgeClass: "badge-purist",
    });
  }

  // 3. Digital Omnivore: at least 1 answer across all 5 eras
  const isOmnivore = eras.every((e) => (scores[e.id] || 0) >= 1);
  if (isOmnivore) {
    badges.push({
      id: "digital-omnivore",
      icon: "🌐",
      name: "DIGITAL OMNIVORE",
      desc: "Touched every single era from dial-up 56k to modern brainrot.",
      badgeClass: "badge-omnivore",
    });
  }

  return badges;
}

/**
 * Generate a clean ASCII / Unicode shareable card
 */
// Word-wrap `text` to `width` columns.
function wrapText(text, width) {
  const out = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    if (!word) continue;
    if (line && (line + " " + word).length > width) {
      out.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

export function formatDossierShareText({ winningEra, dna, badges }) {
  const dnaStr = dna
    .filter((d) => d.pct > 0)
    .map((d) => `${d.pct}% ${d.name}`)
    .join(" | ");

  const badgeStr =
    badges.length > 0
      ? badges.map((b) => `${b.icon} ${b.name}`).join(", ")
      : "NONE (Standard Civilian)";

  // Plain labelled lines wrap cleanly in every chat app (box-drawing art does not).
  const LABEL = 13;
  const row = (label, value) =>
    wrapText(value, 46)
      .map((part, i) => `${(i === 0 ? label : "").padEnd(LABEL)}${part}`)
      .join("\n");

  return [
    "PING AGE // DIGITAL ARCHAEOLOGY REPORT",
    "======================================",
    row("ERA:", `${winningEra.name} (${winningEra.dates})`),
    row("ARCHETYPE:", winningEra.archetype),
    row("HOLY RELIC:", winningEra.dossier.relic),
    row("TRAUMA:", winningEra.dossier.trauma),
    row("HYBRID DNA:", dnaStr),
    row("BADGES:", badgeStr),
    "======================================",
    "Find your era: https://timesink.vercel.app/games/ping-age",
  ].join("\n");
}
