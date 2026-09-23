import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { sfx } from "/shared/sound.js";
import { saveScore } from "/shared/scores.js";

initShell({ crumb: "Ground Zero" });

// DOM Elements
const citySelect = document.getElementById("city-select");
const btnSurprise = document.getElementById("btn-surprise");
const presetSelect = document.getElementById("preset-select");
const yieldSlider = document.getElementById("yield-slider");
const yieldDisplay = document.getElementById("yield-display");
const burstAir = document.getElementById("burst-air");
const burstSurface = document.getElementById("burst-surface");
const falloutControls = document.getElementById("fallout-controls");
const windDirSlider = document.getElementById("wind-dir");
const windDirVal = document.getElementById("wind-dir-val");
const windSpdSlider = document.getElementById("wind-spd");
const windSpdVal = document.getElementById("wind-spd-val");
const btnDetonate = document.getElementById("btn-detonate");
const targetNameEl = document.getElementById("target-name");
const damageReportEl = document.getElementById("damage-report");
const radarSweepEl = document.getElementById("radar-sweep");

let map = null;
let targetMarker = null;
let isProgrammaticMove = false;
let currentTarget = [40.7128, -74.006]; // NYC
let currentBurstType = "air"; // "air" | "surface"
let activeRings = [];
let activeFallout = null;
let effectTimers = [];

const MAJOR_CITIES = [
  { name: "New York City, USA", lat: 40.7128, lng: -74.006 },
  { name: "Washington, D.C., USA", lat: 38.9072, lng: -77.0369 },
  { name: "Los Angeles, USA", lat: 34.0522, lng: -118.2437 },
  { name: "Chicago, USA", lat: 41.8781, lng: -87.6298 },
  { name: "London, UK", lat: 51.5074, lng: -0.1278 },
  { name: "Paris, France", lat: 48.8566, lng: 2.3522 },
  { name: "Berlin, Germany", lat: 52.52, lng: 13.405 },
  { name: "Moscow, Russia", lat: 55.7558, lng: 37.6173 },
  { name: "Kyiv, Ukraine", lat: 50.4501, lng: 30.5234 },
  { name: "Beijing, China", lat: 39.9042, lng: 116.4074 },
  { name: "Tokyo, Japan", lat: 35.6762, lng: 139.6503 },
  { name: "Hiroshima, Japan", lat: 34.3853, lng: 132.4553 },
  { name: "New Delhi, India", lat: 28.6139, lng: 77.209 },
  { name: "Mumbai, India", lat: 19.076, lng: 72.8777 },
  { name: "Tehran, Iran", lat: 35.6892, lng: 51.389 },
  { name: "Tel Aviv, Israel", lat: 32.0853, lng: 34.7818 },
  { name: "Sydney, Australia", lat: -33.8688, lng: 151.2093 },
];

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findClosestCity(lat, lng) {
  let closest = null;
  let minDist = Infinity;
  for (const c of MAJOR_CITIES) {
    const d = getDistanceFromLatLonInKm(lat, lng, c.lat, c.lng);
    if (d < minDist) {
      minDist = d;
      closest = c;
    }
  }
  return { city: closest, distKm: minDist };
}

function formatCoords(lat, lng) {
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
  const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
  return `${latStr}, ${lngStr}`;
}

function updateTargetHUD(lat, lng) {
  const nearest = findClosestCity(lat, lng);
  const coordStr = formatCoords(lat, lng);

  if (nearest && nearest.distKm <= 60) {
    targetNameEl.innerHTML = `TARGET: <b>${escapeHtml(nearest.city.name)}</b> <span class="target-coords">[${coordStr}]</span>`;
    const matchingOption = [...citySelect.options].find((opt) => {
      if (opt.value === "custom") return false;
      const [oLat, oLng] = opt.value.split(",").map(Number);
      return getDistanceFromLatLonInKm(lat, lng, oLat, oLng) <= 40;
    });
    if (matchingOption) {
      citySelect.value = matchingOption.value;
    } else {
      citySelect.value = "custom";
    }
  } else {
    const nearbyHint = nearest && nearest.distKm < 600 ? `(~${Math.round(nearest.distKm)}km from ${nearest.city.name.split(",")[0]})` : "";
    targetNameEl.innerHTML = `TARGET: <b>${coordStr}</b> <span class="target-coords">${escapeHtml(nearbyHint)}</span>`;
    citySelect.value = "custom";
  }
}

function setTargetLocation(lat, lng, shouldCenter = false, triggerSfx = false) {
  currentTarget = [lat, lng];

  if (targetMarker) {
    targetMarker.setLatLng(currentTarget);
  }

  if (shouldCenter && map) {
    isProgrammaticMove = true;
    map.panTo(currentTarget);
    setTimeout(() => {
      isProgrammaticMove = false;
    }, 350);
  }

  updateTargetHUD(lat, lng);

  if (triggerSfx) {
    sfx.click();
  }
}

// Convert slider 0-1000 to log scale 0.01kt (10t) to 100,000kt (100Mt)
function sliderToYield(val) {
  const minLog = Math.log10(0.01);
  const maxLog = Math.log10(100000);
  const logVal = minLog + (val / 1000) * (maxLog - minLog);
  return Math.pow(10, logVal);
}

function yieldToSlider(kt) {
  const minLog = Math.log10(0.01);
  const maxLog = Math.log10(100000);
  const logVal = Math.log10(Math.max(0.01, kt));
  return Math.round(((logVal - minLog) / (maxLog - minLog)) * 1000);
}

function fmtYield(kt) {
  if (kt >= 1000) return `${(kt / 1000).toFixed(kt >= 10000 ? 0 : 1)} Mt (${Math.round(kt).toLocaleString()} kt)`;
  if (kt >= 1) return `${kt >= 100 ? Math.round(kt) : kt.toFixed(1)} kt`;
  return `${(kt * 1000).toFixed(0)} t`;
}

function fmtDist(km) {
  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(2)} km`;
  return `${km.toFixed(1)} km`;
}

function getYield() {
  const p = presetSelect.value;
  if (p !== "custom") return Number(p);
  return sliderToYield(Number(yieldSlider.value));
}

function updateYieldUI() {
  const kt = getYield();
  yieldDisplay.textContent = fmtYield(kt);
}

// Glasstone & Dolan Physics scaling laws (Y in kilotons)
export function calcPhysics(Y) {
  const fireballKm = 0.066 * Math.pow(Y, 0.4);
  const psi20Km = 0.15 * Math.pow(Y, 1 / 3);
  const psi5Km = 0.28 * Math.pow(Y, 1 / 3);
  const psi1Km = 0.79 * Math.pow(Y, 1 / 3);
  const burns3rdKm = 0.38 * Math.pow(Y, 0.41);
  const radiationKm = 0.70 * Math.pow(Y, 0.19);

  return {
    fireballKm,
    psi20Km,
    psi5Km,
    psi1Km,
    burns3rdKm,
    radiationKm,
    hiroshimaEquiv: Y / 15,
  };
}

function initMap() {
  if (typeof L === "undefined") {
    setTimeout(initMap, 200);
    return;
  }

  map = L.map("map", {
    center: currentTarget,
    zoom: 11,
    zoomControl: true,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);

  const targetIcon = L.divIcon({
    className: "gz-target-icon",
    html: `
      <div class="gz-target-marker" title="Drag to reposition Ground Zero">
        <div class="gz-target-ping"></div>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="14" stroke="#ff3b30" stroke-width="2" fill="rgba(255,59,48,0.2)"/>
          <line x1="20" y1="2" x2="20" y2="10" stroke="#ff3b30" stroke-width="2.5"/>
          <line x1="20" y1="30" x2="20" y2="38" stroke="#ff3b30" stroke-width="2.5"/>
          <line x1="2" y1="20" x2="10" y2="20" stroke="#ff3b30" stroke-width="2.5"/>
          <line x1="30" y1="20" x2="38" y2="20" stroke="#ff3b30" stroke-width="2.5"/>
          <circle cx="20" cy="20" r="3.5" fill="#ff3b30"/>
        </svg>
        <span class="gz-target-label">GROUND ZERO</span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  targetMarker = L.marker(currentTarget, {
    icon: targetIcon,
    draggable: true,
    zIndexOffset: 2000,
  }).addTo(map);

  targetMarker.on("drag", (e) => {
    const pos = e.target.getLatLng();
    currentTarget = [pos.lat, pos.lng];
    updateTargetHUD(pos.lat, pos.lng);
  });

  targetMarker.on("dragend", (e) => {
    const pos = e.target.getLatLng();
    setTargetLocation(pos.lat, pos.lng, false, true);
  });

  // Clicking anywhere on the map sets the target and smoothly centers it under the reticle
  map.on("click", (e) => {
    setTargetLocation(e.latlng.lat, e.latlng.lng, true, true);
  });

  // Moving or dragging the map continuously updates currentTarget to whatever is centered in the crosshair!
  map.on("move", () => {
    if (isProgrammaticMove) return;
    const center = map.getCenter();
    currentTarget = [center.lat, center.lng];
    if (targetMarker) targetMarker.setLatLng(currentTarget);
    updateTargetHUD(center.lat, center.lng);
  });

  map.on("moveend", () => {
    if (isProgrammaticMove) return;
    const center = map.getCenter();
    setTargetLocation(center.lat, center.lng, false, false);
  });

  // Initial HUD update
  updateTargetHUD(currentTarget[0], currentTarget[1]);
}

function clearEffects() {
  // Cancel rings/plume still scheduled from a previous detonation.
  effectTimers.forEach((t) => clearTimeout(t));
  effectTimers = [];
  for (const ring of activeRings) {
    if (map && ring) map.removeLayer(ring);
  }
  activeRings = [];
  if (activeFallout && map) {
    map.removeLayer(activeFallout);
    activeFallout = null;
  }
}

function detonate() {
  if (!map) return;
  sfx.alarm();
  clearEffects();
  // Restart the sweep animation on every detonation.
  radarSweepEl.classList.remove("is-active");
  void radarSweepEl.offsetWidth;
  radarSweepEl.classList.add("is-active");

  const Y = getYield();
  const phys = calcPhysics(Y);

  // Animate map view centered on the chosen target
  isProgrammaticMove = true;
  const targetZoom = Math.max(5, Math.min(13, Math.round(14 - Math.log10(Math.max(0.01, Y)))));
  map.setView(currentTarget, targetZoom);
  setTimeout(() => {
    isProgrammaticMove = false;
  }, 400);

  const ringsConfig = [
    { key: "psi1", r: phys.psi1Km * 1000, color: "#ffcc00", label: "1 psi: Broken Glass", cls: "report-row-light" },
    { key: "burns", r: phys.burns3rdKm * 1000, color: "#ff7700", label: "3rd Degree Burns", cls: "report-row-burns" },
    { key: "psi5", r: phys.psi5Km * 1000, color: "#ff5500", label: "5 psi: Residential Collapse", cls: "report-row-moderate" },
    { key: "rad", r: phys.radiationKm * 1000, color: "#33ff66", label: "500 rem Prompt Rad", cls: "report-row-rad" },
    { key: "psi20", r: phys.psi20Km * 1000, color: "#ff3b30", label: "20 psi: Heavy Concrete Demolition", cls: "report-row-heavy" },
    { key: "fireball", r: phys.fireballKm * 1000, color: "#ff9900", label: "Thermal Fireball", cls: "report-row-fireball" },
  ];

  // Draw concentric rings with slight delay animation
  ringsConfig.forEach((ring, idx) => {
    effectTimers.push(setTimeout(() => {
      const circle = L.circle(currentTarget, {
        radius: ring.r,
        color: ring.color,
        fillColor: ring.color,
        fillOpacity: 0.12,
        weight: 2,
        dashArray: "4 2",
        interactive: false, // Critical: allow clicks through blast rings to map
      }).addTo(map);
      activeRings.push(circle);
    }, idx * 120));
  });

  // Fallout plume if surface burst
  if (currentBurstType === "surface") {
    // Compass bearing the plume drifts TOWARD (0° = north, 90° = east).
    const windDir = Number(windDirSlider.value);
    const windSpeed = Number(windSpdSlider.value); // km/h
    const plumeLengthKm = Math.min(300, (windSpeed * Math.pow(Y, 0.45) * 0.8));
    const bearing = (windDir * Math.PI) / 180;
    const spreadRad = (25 * Math.PI) / 180;
    const kmPerLngDeg = 111 * Math.max(0.05, Math.cos((currentTarget[0] * Math.PI) / 180));
    const offset = (b, len) => [(Math.cos(b) * len) / 111, (Math.sin(b) * len) / kmPerLngDeg];

    const [latOffset, lngOffset] = offset(bearing, plumeLengthKm);
    const [leftLat, leftLng] = offset(bearing - spreadRad, plumeLengthKm * 0.85);
    const [rightLat, rightLng] = offset(bearing + spreadRad, plumeLengthKm * 0.85);

    const conePoints = [
      currentTarget,
      [currentTarget[0] + leftLat, currentTarget[1] + leftLng],
      [currentTarget[0] + latOffset, currentTarget[1] + lngOffset],
      [currentTarget[0] + rightLat, currentTarget[1] + rightLng],
    ];

    effectTimers.push(setTimeout(() => {
      activeFallout = L.polygon(conePoints, {
        color: "#9900ff",
        fillColor: "#9900ff",
        fillOpacity: 0.22,
        weight: 1.5,
        dashArray: "6 3",
        interactive: false, // Critical: allow clicks through fallout plume to map
      }).addTo(map);
    }, 800));
  }

  // Estimated population density (assumed 4,500 people / km2 urban average)
  const density = 4500;
  const area1psi = Math.PI * Math.pow(phys.psi1Km, 2);
  const area5psi = Math.PI * Math.pow(phys.psi5Km, 2);
  const estFatalities = Math.round(area5psi * density * 0.65);
  const estCasualties = Math.round(area1psi * density * 0.85);

  saveScore("ground-zero", Y, `${fmtYield(Y)} (${Math.round(phys.hiroshimaEquiv)}x Little Boy)`);

    const equivStr = phys.hiroshimaEquiv >= 1
      ? `${phys.hiroshimaEquiv >= 100 ? Math.round(phys.hiroshimaEquiv) : phys.hiroshimaEquiv.toFixed(1)}x`
      : `1/${Math.round(1 / phys.hiroshimaEquiv)}th (${phys.hiroshimaEquiv.toFixed(3)}x)`;

    damageReportEl.innerHTML = `
    <div class="report-grid">
      <div class="report-banner">DETONATION CONFIRMED: ${fmtYield(Y)} // ${currentBurstType.toUpperCase()}</div>
      <table class="report-table">
        <thead>
          <tr><th>ZONE</th><th>RADIUS</th><th>EFFECT</th></tr>
        </thead>
        <tbody>
          <tr class="report-row-fireball"><td>FIREBALL</td><td>${fmtDist(phys.fireballKm)}</td><td>Vaporization</td></tr>
          <tr class="report-row-heavy"><td>20 PSI</td><td>${fmtDist(phys.psi20Km)}</td><td>Heavy concrete destruction</td></tr>
          <tr class="report-row-moderate"><td>5 PSI</td><td>${fmtDist(phys.psi5Km)}</td><td>Residential collapse, firestorms</td></tr>
          <tr class="report-row-rad"><td>500 REM RAD</td><td>${fmtDist(phys.radiationKm)}</td><td>Lethal prompt dose without shelter</td></tr>
          <tr class="report-row-burns"><td>3RD DEG BURNS</td><td>${fmtDist(phys.burns3rdKm)}</td><td>Severe thermal radiation</td></tr>
          <tr class="report-row-light"><td>1 PSI</td><td>${fmtDist(phys.psi1Km)}</td><td>Shattered windows, flying glass</td></tr>
        </tbody>
      </table>
      <div class="hiroshima-counter">
        <span>HIROSHIMA EQUIVALENT:</span>
        <span>${equivStr}</span>
      </div>
      <p style="margin-top: 8px; color: var(--dim); font-size: 11px;">
        EST. FATALITIES: ~${estFatalities.toLocaleString()} | EST. CASUALTIES: ~${estCasualties.toLocaleString()} (based on standard urban density 4,500/km²).
        ${currentBurstType === "air" ? "<br><em>AIRBURST PRODUCES MINIMAL LOCAL FALLOUT.</em>" : "<br><em>SURFACE BURST: HIGH LETHAL LOCAL FALLOUT PLUME ACTIVE.</em>"}
      </p>
    </div>
  `;
}

// Event Listeners
citySelect.addEventListener("change", () => {
  if (citySelect.value === "custom") return;
  const [lat, lng] = citySelect.value.split(",").map(Number);
  setTargetLocation(lat, lng, true, true);
});

btnSurprise.addEventListener("click", () => {
  const validOptions = [...citySelect.options].filter((o) => o.value !== "custom");
  const chosen = validOptions[Math.floor(Math.random() * validOptions.length)];
  citySelect.value = chosen.value;
  citySelect.dispatchEvent(new Event("change"));
});

presetSelect.addEventListener("change", () => {
  sfx.click();
  const p = presetSelect.value;
  if (p !== "custom") {
    yieldSlider.value = String(yieldToSlider(Number(p)));
  }
  updateYieldUI();
});

yieldSlider.addEventListener("input", () => {
  presetSelect.value = "custom";
  updateYieldUI();
});

burstAir.addEventListener("click", () => {
  sfx.click();
  currentBurstType = "air";
  burstAir.classList.add("is-active");
  burstSurface.classList.remove("is-active");
  falloutControls.style.display = "none";
});

burstSurface.addEventListener("click", () => {
  sfx.click();
  currentBurstType = "surface";
  burstSurface.classList.add("is-active");
  burstAir.classList.remove("is-active");
  falloutControls.style.display = "block";
});

windDirSlider.addEventListener("input", () => {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const compass = dirs[Math.round(windDirSlider.value / 45) % 8];
  windDirVal.textContent = `${windDirSlider.value}° (${compass})`;
});

windSpdSlider.addEventListener("input", () => {
  windSpdVal.textContent = `${windSpdSlider.value} km/h`;
});

btnDetonate.addEventListener("click", detonate);

// Init
initMap();
if (presetSelect.value !== "custom") {
  yieldSlider.value = String(yieldToSlider(Number(presetSelect.value)));
}
updateYieldUI();
