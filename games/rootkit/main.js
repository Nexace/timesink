import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { sfx } from "/shared/sound.js";
import { saveScore } from "/shared/scores.js";
import {
  MISSIONS,
  createGameState,
  executeCommand,
  getAutocompleteSuggestions,
} from "./engine.js";

initShell({ crumb: "Rootkit" });

// DOM References
const terminalScreen = document.getElementById("terminal-screen");
const outputBuffer = document.getElementById("output-buffer");
const cmdInput = document.getElementById("cmd-input");
const promptStr = document.getElementById("prompt-str");
const autocompletePreview = document.getElementById("autocomplete-preview");

const missionTitle = document.getElementById("mission-title");
const traceVal = document.getElementById("trace-val");
const traceFill = document.getElementById("trace-fill");
const missionTimer = document.getElementById("mission-timer");
const timerVal = document.getElementById("timer-val");
const hostIp = document.getElementById("host-ip");
const subnetVal = document.getElementById("subnet-val");
const proxyCount = document.getElementById("proxy-count");
const privilegeBadge = document.getElementById("privilege-badge");

// Game Runtime State
let currentMissionIdx = 0;
let gameState = createGameState(0);
let timerInterval = null;
let activeCountdown = 90;

function playSound(name) {
  switch (name) {
    case "click":
      sfx.click?.();
      break;
    case "type":
      sfx.type?.();
      break;
    case "good":
      sfx.good?.();
      break;
    case "deny":
      sfx.deny?.();
      break;
    case "error":
      sfx.error?.();
      break;
    case "alarm":
      sfx.alarm?.();
      break;
    case "win":
      sfx.win?.();
      break;
    default:
      sfx.click?.();
  }
}

function print(text, cls = "") {
  const line = document.createElement("div");
  line.className = `rk-line ${cls}`;
  line.textContent = text;
  outputBuffer.appendChild(line);
  terminalScreen.scrollTop = terminalScreen.scrollHeight;
}

function updateTelemetry() {
  const m = gameState.mission;
  missionTitle.textContent = m.title;
  subnetVal.textContent = m.subnet;
  hostIp.textContent = gameState.connectedIp || m.gatewayIp;
  proxyCount.textContent = `${gameState.proxyChain.length} HOPS`;

  // Privilege calculation
  let priv = "operator";
  let host = "gateway.local";
  if (gameState.connectedIp) {
    const node = gameState.nodes[gameState.connectedIp];
    if (node) {
      priv = node.privilege || "guest";
      host = node.hostname;
    }
  }

  privilegeBadge.textContent = priv.toUpperCase();
  const clearanceWrap = privilegeBadge.closest(".rk-clearance-badge");
  if (clearanceWrap) {
    if (priv === "root") clearanceWrap.classList.add("is-root");
    else clearanceWrap.classList.remove("is-root");
  }

  // Update prompt string
  const promptSymbol = priv === "root" ? "#" : "$";
  promptStr.textContent = `${priv}@${host}:~${promptSymbol}`;

  // Trace Gauge
  traceVal.textContent = `${gameState.traceLevel}%`;
  traceFill.style.width = `${gameState.traceLevel}%`;
  traceFill.className = "trace-fill";
  if (gameState.traceLevel > 75) {
    traceFill.classList.add("trace-crit");
  } else if (gameState.traceLevel > 45) {
    traceFill.classList.add("trace-warn");
  }

  // Check critical trace limit
  if (gameState.traceLevel >= 100 && !gameState.isFailed) {
    gameState.isFailed = true;
    playSound("alarm");
    print("=========================================================", "rk-line--err");
    print("CRITICAL: IDS COUNTER-INTRUSION LOCKDOWN (100% TRACE).", "rk-line--err");
    print("PHYSICAL LOCATION TRIANGULATED. SEVERING CONNECTION...", "rk-line--err");
    print("REINITIALIZING SECURE PROXY GATEWAY...", "rk-line--err");
    print("=========================================================", "rk-line--err");
    setTimeout(() => {
      startMission(currentMissionIdx);
    }, 2800);
  }
}

function startMission(idx) {
  currentMissionIdx = idx;
  gameState = createGameState(idx);

  if (timerInterval) clearInterval(timerInterval);
  if (gameState.mission.timed) {
    activeCountdown = gameState.mission.timeLimit || 90;
    missionTimer.style.display = "inline-flex";
    timerVal.textContent = `${activeCountdown}s`;
    timerInterval = setInterval(() => {
      if (gameState.isFailed || gameState.isCleared) return;
      activeCountdown -= 1;
      timerVal.textContent = `${activeCountdown}s`;
      if (activeCountdown <= 0) {
        clearInterval(timerInterval);
        print("[!] ALERT: TURBINE MELTDOWN DETECTED. GENERATOR OFFLINE.", "rk-line--err");
        gameState.traceLevel = 100;
        updateTelemetry();
      }
    }, 1000);
  } else {
    missionTimer.style.display = "none";
  }

  outputBuffer.innerHTML = "";
  print(`======================================================================`, "rk-line--banner");
  print(`[+] INTRUSION DIRECTIVE // MISSION ${gameState.mission.title}`, "rk-line--banner");
  print(`======================================================================`, "rk-line--banner");
  print(`OBJECTIVE: ${gameState.mission.objective}`);
  print(`SUBNET:    ${gameState.mission.subnet} | LOCAL GATEWAY: ${gameState.mission.gatewayIp}`);
  print(`COMMANDS:  Type 'scan' to locate active hosts, or 'help' for directory.`);
  print(`SHORTCUTS: Press [Tab] to autocomplete, [↑/↓] for command history.\n`);

  updateTelemetry();
  cmdInput.value = "";
  autocompletePreview.textContent = "";
  cmdInput.focus();
}

function completeCurrentMission() {
  if (timerInterval) clearInterval(timerInterval);
  gameState.isCleared = true;
  playSound("win");

  print(`\n======================================================================`, "rk-line--success");
  print(`        [+] MISSION CLEARED // TARGET INFILTRATION COMPLETE [+]        `, "rk-line--success");
  print(`======================================================================\n`, "rk-line--success");

  toast({
    title: `MISSION ${currentMissionIdx + 1} CLEARED`,
    body: "Intrusion verified. Telemetry uploaded to central arcade.",
    icon: "check",
  });

  saveScore("rootkit", currentMissionIdx + 1, `${currentMissionIdx + 1}/6 Missions Cleared`);

  currentMissionIdx += 1;
  if (currentMissionIdx < MISSIONS.length) {
    setTimeout(() => {
      startMission(currentMissionIdx);
    }, 2600);
  } else {
    print(`======================================================================`, "rk-line--banner");
    print(`  [***] GRAND MASTER INTRUSION ACHIEVED // ALL 6 NODES COMPROMISED [***]  `, "rk-line--banner");
    print(`  PERSISTENT RING-0 ROOTKIT ACTIVE ACROSS ALL SUBNETS.                    `, "rk-line--banner");
    print(`======================================================================`, "rk-line--banner");
    print(`Type 'restart' to replay the campaign from Mission 1.`, "rk-line--dim");
    missionTitle.textContent = "ALL CLEARED";
  }
}

function updateAutocompletePreview() {
  const currentVal = cmdInput.value;
  if (!currentVal) {
    autocompletePreview.textContent = "";
    return;
  }
  const suggestions = getAutocompleteSuggestions(currentVal, gameState);
  if (suggestions.length > 0) {
    const top = suggestions[0];
    const tokens = currentVal.trimStart().split(/\s+/);
    const lastToken = currentVal.endsWith(" ") ? "" : tokens[tokens.length - 1];
    if (top.startsWith(lastToken)) {
      const rest = top.slice(lastToken.length);
      autocompletePreview.textContent = currentVal + rest;
    } else {
      autocompletePreview.textContent = "";
    }
  } else {
    autocompletePreview.textContent = "";
  }
}

function processTerminalCommand(raw) {
  const cmd = raw.trim();
  if (!cmd) return;

  // Echo user command
  print(`${promptStr.textContent} ${cmd}`, "rk-line--cmd");

  // The session is being severed after a 100% trace — nothing gets through.
  if (gameState.isFailed) {
    print("[!] Connection severed. Rebooting proxy gateway...", "rk-line--err");
    return;
  }

  const lower = cmd.toLowerCase();
  if (lower === "restart" || lower === "reset") {
    startMission(currentMissionIdx >= MISSIONS.length ? 0 : currentMissionIdx);
    return;
  }
  if (currentMissionIdx >= MISSIONS.length) {
    print("All 6 networks are already compromised. Type 'restart' to run the campaign again.", "rk-line--dim");
    return;
  }

  // Execute in engine
  const result = executeCommand(cmd, gameState);

  if (result.clearScreen) {
    outputBuffer.innerHTML = "";
    updateTelemetry();
    return;
  }

  // Play audio reaction
  if (result.sound) playSound(result.sound);

  // Render output lines
  for (const line of result.lines) {
    print(line.text, line.cls || "");
  }

  // Update header telemetry and trace
  updateTelemetry();

  // Check mission completion
  if (result.missionCleared) {
    completeCurrentMission();
  }
}

// Keyboard input listeners
cmdInput.addEventListener("keydown", (e) => {
  // 1. Enter: execute command
  if (e.key === "Enter") {
    const val = cmdInput.value;
    cmdInput.value = "";
    autocompletePreview.textContent = "";
    processTerminalCommand(val);
    return;
  }

  // 2. Tab: autocomplete
  if (e.key === "Tab") {
    e.preventDefault();
    const currentVal = cmdInput.value;
    const suggestions = getAutocompleteSuggestions(currentVal, gameState);
    if (suggestions.length > 0) {
      playSound("click");
      const top = suggestions[0];
      const tokens = currentVal.trimStart().split(/\s+/);
      if (tokens.length <= 1 && !currentVal.endsWith(" ")) {
        cmdInput.value = top + " ";
      } else {
        const lastToken = currentVal.endsWith(" ") ? "" : tokens[tokens.length - 1];
        const base = currentVal.slice(0, currentVal.length - lastToken.length);
        cmdInput.value = base + top + " ";
      }
      updateAutocompletePreview();
    }
    return;
  }

  // 3. ArrowUp / ArrowDown: command history
  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (gameState.commandHistory.length > 0) {
      if (gameState.historyIndex > 0) {
        gameState.historyIndex -= 1;
      }
      cmdInput.value = gameState.commandHistory[gameState.historyIndex] || "";
      updateAutocompletePreview();
    }
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (gameState.commandHistory.length > 0) {
      if (gameState.historyIndex < gameState.commandHistory.length - 1) {
        gameState.historyIndex += 1;
        cmdInput.value = gameState.commandHistory[gameState.historyIndex] || "";
      } else {
        gameState.historyIndex = gameState.commandHistory.length;
        cmdInput.value = "";
      }
      updateAutocompletePreview();
    }
    return;
  }

  // 4. Ctrl+L: Clear screen
  if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
    e.preventDefault();
    outputBuffer.innerHTML = "";
    return;
  }

  // 5. Ctrl+C: Cancel current input
  if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
    e.preventDefault();
    print(`${promptStr.textContent} ${cmdInput.value}^C`, "rk-line--dim");
    cmdInput.value = "";
    autocompletePreview.textContent = "";
    return;
  }

  // Type sound
  if (e.key.length === 1 || e.key === "Backspace") {
    playSound("type");
    setTimeout(updateAutocompletePreview, 10);
  }
});

cmdInput.addEventListener("input", updateAutocompletePreview);

// Click anywhere on terminal to refocus input
terminalScreen.addEventListener("click", () => cmdInput.focus());

// Start Mission 1
startMission(0);
