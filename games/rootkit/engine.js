/**
 * SYS://TIMESINK.NET — Rootkit Engine
 * Modular hacking simulation engine: network models, virtual file systems,
 * cryptographic ciphers, hex dumping, port knocking, and proxy management.
 */

export const MISSIONS = [
  {
    id: "bootstrap",
    title: "1. BOOTSTRAP",
    objective: "Scan subnet 10.0.0.0/24, connect to research node 10.0.0.15, crack SSH port 22, and read flag.txt.",
    subnet: "10.0.0.0/24",
    gatewayIp: "10.0.0.1",
    timed: false,
    nodes: {
      "10.0.0.1": {
        hostname: "gateway.local",
        type: "gateway",
        ports: [53, 80],
        privilege: "user",
        files: {
          "routing.table": "DEFAULT GATEWAY: 10.0.0.1\nSUBNET: 10.0.0.0/24\nACTIVE TARGET HOST: 10.0.0.15 (Research & Archive)",
          "network.map": "HOST 10.0.0.15 [ONLINE] - Open Port: 22 (SSH OpenSSH 8.2p1)",
        },
      },
      "10.0.0.15": {
        hostname: "research-node.local",
        type: "workstation",
        locked: true,
        ports: [22, 80],
        crackedPorts: [],
        privilege: "guest",
        files: {
          "welcome.txt": "RESEARCH DIVISION NODE 15\nClearance: RESTRICTED\nRetrieve authorization flag from flag.txt to verify terminal integrity.",
          "flag.txt": "FLAG{BOOTSTRAP_RECON_COMPLETE}",
          "system.nfo": "OS: ArchLinux 6.1-hardened\nCPU: Quantum RISC-V 32-core\nSecurity Level: Minimal",
        },
      },
    },
  },
  {
    id: "the-ledger",
    title: "2. THE LEDGER",
    objective: "Infiltrate banking database 192.168.4.25 via proxy bounce, avoid honeypot traps, crack HTTPS port 443, decrypt ledger.enc (Caesar shift), and shred audit.log.",
    subnet: "192.168.4.0/24",
    gatewayIp: "192.168.4.1",
    timed: false,
    nodes: {
      "192.168.4.1": {
        hostname: "border-gw.bank",
        type: "gateway",
        ports: [22, 80],
        privilege: "user",
        files: {
          "perimeter.log": "PERIMETER NOTICE: Proxy routing enabled on port 8080.\nTarget node 192.168.4.25 holds transactional ledgers.\nWARNING: 192.168.4.9 is an active IDS honeypot tripwire.",
        },
      },
      "192.168.4.9": {
        hostname: "backup-vault.bank",
        type: "honeypot",
        isHoneypot: true,
        ports: [21, 23],
        privilege: "guest",
        files: {
          "decoy_accounts.csv": "ACCOUNT_ID,BALANCE\nAC-99018,$14,920,000",
        },
      },
      "192.168.4.25": {
        hostname: "db-ledger.bank",
        type: "database",
        locked: true,
        ports: [80, 443],
        crackedPorts: [],
        privilege: "guest",
        files: {
          "hint.txt": "The encryption shift matches the atomic number of Boron (B = 5).\nUse command: decrypt ledger.enc 5",
          "ledger.enc": "HTIJ{HTSKNWR_GFSP_YWFSXKJW_882}", // Shift 5 of: CODE{CONFIRM_BANK_TRANSFER_882}
          "audit.log": "INTRUSION AUDIT LOG:\n[AUTH EVENT] External connection logged from gateway proxy.\nExecute 'shred audit.log' to sanitize forensic traces.",
        },
      },
    },
  },
  {
    id: "blackout",
    title: "3. GRIDLOCK BLACKOUT",
    objective: "Timed breach: Infiltrate SCADA grid 172.16.88.50, inspect router firewall rules, execute port knock sequence, and run override within 90s.",
    subnet: "172.16.88.0/24",
    gatewayIp: "172.16.88.1",
    timed: true,
    timeLimit: 90,
    nodes: {
      "172.16.88.1": {
        hostname: "substation-router",
        type: "router",
        ports: [22, 80],
        privilege: "user",
        files: {
          "firewall.conf": "# INDUSTRIAL FIREWALL CONFIGURATION\n# Port 502 (Modbus SCADA) is protected by port knocking.\n# SEQUENTIAL KNOCK REQUIRED ON 172.16.88.50:\n# knock 7721 8840 9912\n# Once knocked, port 502 unseals for control override.",
        },
      },
      "172.16.88.50": {
        hostname: "scada-plc-core",
        type: "scada",
        ports: [80],
        guardedPort: 502,
        knockSequence: [7721, 8840, 9912],
        knockProgress: [],
        crackedPorts: [],
        privilege: "guest",
        files: {
          "generator.status": "TURBINE STATUS: OVERHEATING (CRITICAL 1420 RPM)\nCOOLING SYSTEM: STALLED\nCommand required: run override",
          "control.sh": "#!/bin/sh\n# SCADA Emergency Control Script\necho 'Cooling pumps engaged. Core stabilized.'",
        },
      },
    },
  },
  {
    id: "the-mole",
    title: "4. THE MOLE",
    objective: "Intercept defense intelligence mail server on 10.10.4.88. Exploit SQL injection on port 3306, analyze mail archives, and accuse the traitor via 'accuse <agent>'.",
    subnet: "10.10.4.0/24",
    gatewayIp: "10.10.4.1",
    timed: false,
    nodes: {
      "10.10.4.1": {
        hostname: "relay-gw.intel",
        type: "gateway",
        ports: [22, 53],
        privilege: "user",
        files: {
          "briefing.doc": "INTERNAL MEMO: A mole in Sector 4 is leaking nuclear propulsion telemetry.\nLocate mail server at 10.10.4.88. SQL interface port 3306 is vulnerable.",
        },
      },
      "10.10.4.88": {
        hostname: "corp-mail.intel",
        type: "mailserver",
        ports: [80, 110, 3306],
        crackedPorts: [],
        privilege: "guest",
        mole: "raven",
        files: {
          "readme.txt": "INTEL MAIL GATEWAY v4.1\nDatabase backend running MySQL on port 3306.\nQuery database using: sqli \"SELECT * FROM mail\"",
        },
        mailDatabase: [
          { id: 1, from: "Director Vance", to: "All Personnel", body: "Severe security breach detected in Sector 4 propulsion research." },
          { id: 2, from: "Agent Fox", to: "Director Vance", body: "I was in the server room when the alarms tripped. Checked physical locks." },
          { id: 3, from: "Agent Stone", to: "Director Vance", body: "Fox is innocent; we were reviewing flight telemetry together in the briefing lounge." },
          { id: 4, from: "Agent Raven", to: "Anonymous Offshore", body: "Propulsion telemetry compressed and staged. Wire transfer confirmed." },
          { id: 5, from: "Anonymous Offshore", to: "Agent Raven", body: "Payment cleared in crypto wallet. Destroy sector hard drives immediately." },
        ],
      },
    },
  },
  {
    id: "orbital-override",
    title: "5. ORBITAL OVERRIDE",
    objective: "Ground station satellite link 198.51.100.44. Inspect memory.dmp with hex dump, extract authentication passkey, exploit auth_daemon to escalate to root, and execute 'override orbit'.",
    subnet: "198.51.100.0/24",
    gatewayIp: "198.51.100.1",
    timed: false,
    nodes: {
      "198.51.100.1": {
        hostname: "space-relay.esa",
        type: "gateway",
        ports: [22, 80],
        privilege: "user",
        files: {
          "uplink.guide": "SATELLITE GROUND STATION 198.51.100.44\nService daemon running on port 8080.\nInspect binary memory dump to recover authentication token.",
        },
      },
      "198.51.100.44": {
        hostname: "orbital-uplink.esa",
        type: "satellite",
        ports: [22, 8080],
        crackedPorts: [],
        privilege: "guest",
        authPasskey: "APOLLO-9921-SYNC",
        files: {
          "telemetry.conf": "SATELLITE: SENTINEL-X ORBITAL TRACKER\nStatus: Off-axis drift (Requires root authorization for alignment)\nInspect memory.dmp with 'dump memory.dmp' to find service authentication token.",
          "memory.dmp": "HEXDUMP_PAYLOAD_APOLLO-9921-SYNC_TOKEN_KERNEL_VALIDATED",
        },
      },
    },
  },
  {
    id: "ring-0-rootkit",
    title: "6. RING-0 ROOTKIT",
    objective: "Final intrusion: Master mainframe 10.99.99.1. Setup multi-hop proxy chain to evade high-speed IDS, crack port 8080, decrypt military cipher security.enc (shift 7), escalate to root, and execute 'plant rootkit'.",
    subnet: "10.99.99.0/24",
    gatewayIp: "10.99.99.1",
    timed: false,
    nodes: {
      "10.99.99.1": {
        hostname: "core-mainframe.mil",
        type: "mainframe",
        locked: true,
        ports: [22, 443, 8080],
        crackedPorts: [],
        privilege: "guest",
        files: {
          "security.nfo": "MILITARY DEFENSE CORE - LEVEL 5\nDecryption shift matches the 7 deadly sins (shift 7).\nDecrypt security.enc with 'decrypt security.enc 7'.\nElevate to root with exploit, then execute 'plant rootkit'.",
          "security.enc": "YVVA{ZHAHU_WYLCPLD_THZALY_RF8}", // shift 7 of: ROOT{SATAN_PREVIEW_MASTER_KY8}
          "audit.log": "IDS LOG: Active threat detection enabled. 4-second poll interval.\nUse 'shred audit.log' to suppress counter-intrusion signals.",
        },
      },
    },
  },
];

/**
 * Caesar cipher decryption
 */
export function caesarDecrypt(ciphertext, shift) {
  return ciphertext.replace(/[A-Za-z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 65 && code <= 90 ? 65 : 97;
    return String.fromCharCode(((code - base - shift + 26) % 26) + base);
  });
}

/**
 * Caesar cipher encryption
 */
export function caesarEncrypt(plaintext, shift) {
  return ciphertext(plaintext, shift);
}

function ciphertext(text, shift) {
  return text.replace(/[A-Za-z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 65 && code <= 90 ? 65 : 97;
    return String.fromCharCode(((code - base + shift) % 26) + base);
  });
}

/**
 * Generate formatted Hex Dump output matching standard xxd / hexdump -C
 */
export function formatHexDump(content) {
  const bytes = [];
  for (let i = 0; i < content.length; i++) {
    bytes.push(content.charCodeAt(i));
  }

  const lines = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.slice(offset, offset + 16);
    const addr = offset.toString(16).padStart(8, "0");

    const hexParts = chunk.map((b) => b.toString(16).padStart(2, "0"));
    while (hexParts.length < 16) {
      hexParts.push("  ");
    }

    const hexFormatted =
      hexParts.slice(0, 8).join(" ") + "  " + hexParts.slice(8, 16).join(" ");

    const asciiFormatted = chunk
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
      .join("");

    lines.push(`${addr}:  ${hexFormatted}  |${asciiFormatted}|`);
  }
  return lines.join("\n");
}

/**
 * Create a fresh initial game state for a given mission index
 */
export function createGameState(missionIdx = 0) {
  const missionData = MISSIONS[missionIdx] || MISSIONS[0];
  // Deep clone nodes
  const nodes = JSON.parse(JSON.stringify(missionData.nodes));

  return {
    missionIdx,
    mission: missionData,
    nodes,
    connectedIp: null,
    proxyChain: [],
    traceLevel: 0,
    traceCooldown: 0,
    commandHistory: [],
    historyIndex: -1,
    timeRemaining: missionData.timed ? missionData.timeLimit || 90 : null,
    isCleared: false,
    isFailed: false,
    logsWiped: false,
    ledgerDecrypted: false,
  };
}

/**
 * Compute tab autocompletion candidates given the current input line
 */
export function getAutocompleteSuggestions(inputLine, state) {
  const trimmed = inputLine.trimStart();
  const tokens = trimmed.split(/\s+/);

  const COMMANDS = [
    "scan",
    "connect",
    "crack",
    "ls",
    "cat",
    "dump",
    "decrypt",
    "knock",
    "sqli",
    "exploit",
    "shred",
    "proxy",
    "ping",
    "whoami",
    "netstat",
    "ifconfig",
    "clear",
    "history",
    "help",
    "exit",
    "accuse",
    "plant",
    "run",
    "override",
  ];

  // Case 1: Typing command name
  if (tokens.length <= 1 && !inputLine.endsWith(" ")) {
    const prefix = tokens[0].toLowerCase();
    return COMMANDS.filter((cmd) => cmd.startsWith(prefix));
  }

  const cmd = tokens[0].toLowerCase();
  const currentToken = inputLine.endsWith(" ") ? "" : tokens[tokens.length - 1];

  // Case 2: Commands expecting an IP argument (scan, connect, ping, proxy add)
  if (["connect", "scan", "ping", "route"].includes(cmd) || (cmd === "proxy" && tokens[1] === "add")) {
    const availableIps = Object.keys(state.nodes);
    return availableIps.filter((ip) => ip.startsWith(currentToken));
  }

  // Case 3: Commands expecting a filename on the currently connected node (cat, dump, decrypt, shred)
  if (["cat", "dump", "decrypt", "shred"].includes(cmd)) {
    if (!state.connectedIp) {
      return ["routing.table", "network.map"].filter((f) => f.startsWith(currentToken));
    }
    const node = state.nodes[state.connectedIp];
    if (node && node.files) {
      return Object.keys(node.files).filter((f) => f.startsWith(currentToken));
    }
  }

  // Case 4: Proxy subcommands
  if (cmd === "proxy" && tokens.length === 2 && !inputLine.endsWith(" ")) {
    return ["add", "list", "clear"].filter((sub) => sub.startsWith(currentToken));
  }

  return [];
}

// Nodes flagged `locked` hide their filesystem until a service port has been cracked.
function isLockedOut(node) {
  return Boolean(node && node.locked && !(node.crackedPorts && node.crackedPorts.length) && node.privilege !== "root");
}

function lockedMessage(node) {
  return {
    text: `[-] Permission denied on ${node.hostname}. Authenticate first: 'crack <port>' (open ports: ${node.ports.join(", ")}).`,
    cls: "rk-line--err",
  };
}

/**
 * Core command processor. Returns output lines and updated status.
 */
export function executeCommand(rawCmd, state) {
  const cmd = rawCmd.trim();
  if (!cmd) return { lines: [], sound: null };

  state.commandHistory.push(cmd);
  state.historyIndex = state.commandHistory.length;

  const [action, ...args] = cmd.split(" ");
  const actionLower = action.toLowerCase();
  const lines = [];
  let sound = "click";
  let missionCleared = false;

  // Active node reference
  const activeNode = state.connectedIp ? state.nodes[state.connectedIp] : null;

  // Calculate trace penalty (mitigated by proxy chain)
  const proxyDamping = Math.max(0.4, 1 - state.proxyChain.length * 0.2);
  if (!["help", "clear", "cls", "history", "whoami", "ifconfig", "netstat", "proxy", "shred"].includes(actionLower)) {
    const baseTrace = 6;
    const finalTrace = Math.max(1, Math.round(baseTrace * proxyDamping));
    state.traceLevel = Math.min(100, state.traceLevel + finalTrace);
  }

  switch (actionLower) {
    case "help": {
      lines.push({ text: "=========================================================", cls: "rk-line--dim" });
      lines.push({ text: "ROOTKIT INTRUSION SYSTEM // COMMAND REFERENCE DIRECTORY", cls: "rk-line--cmd" });
      lines.push({ text: "=========================================================", cls: "rk-line--dim" });
      lines.push({ text: "RECON & NETWORK:" });
      lines.push({ text: "  scan [subnet|ip]        - Probe subnet or host for active ports" });
      lines.push({ text: "  ping <ip>               - Transmit ICMP echo telemetry packets" });
      lines.push({ text: "  connect <ip>            - Establish interactive terminal session" });
      lines.push({ text: "  proxy [add|list|clear]  - Route through bounce nodes to dampen trace" });
      lines.push({ text: "EXPLOITATION & ELEVATION:" });
      lines.push({ text: "  crack <port>            - Launch credential brute force attack" });
      lines.push({ text: "  knock <p1> <p2> <p3>    - Execute sequential firewall port knock" });
      lines.push({ text: "  sqli <query>            - Exploit SQL injection on database service" });
      lines.push({ text: "  exploit <svc> <token>   - Buffer overflow exploit for root elevation" });
      lines.push({ text: "FORENSICS & CIPHERS:" });
      lines.push({ text: "  ls [-l]                 - List files on current host node" });
      lines.push({ text: "  cat <file>              - Inspect text document contents" });
      lines.push({ text: "  dump <file|memory>      - Generate address hex dump and ASCII matrix" });
      lines.push({ text: "  decrypt <file> <shift>  - Decrypt Caesar ciphered archives (1-25)" });
      lines.push({ text: "  shred <file>            - Wipe files or /var/log audit traces" });
      lines.push({ text: "  plant rootkit           - Inject Ring-0 kernel stealth payload" });
      lines.push({ text: "SHELL CONTROLS:" });
      lines.push({ text: "  whoami | ifconfig       - Identity, IP addresses, and privileges" });
      lines.push({ text: "  clear | exit            - Clear console screen / disconnect host" });
      lines.push({ text: "  [Tab] Autocomplete      - [↑/↓] Navigate Command History" });
      break;
    }

    case "clear":
    case "cls": {
      return { lines: [], sound: "click", clearScreen: true };
    }

    case "whoami": {
      if (!state.connectedIp) {
        lines.push({ text: "USER: agent-0 // HOST: gateway.local // PRIVILEGE: operator" });
      } else {
        const priv = activeNode.privilege || "guest";
        lines.push({ text: `USER: ${priv} // HOST: ${activeNode.hostname} (${state.connectedIp}) // CLEARANCE: ${priv === "root" ? "RING-0 ROOT" : "RESTRICTED"}` });
      }
      break;
    }

    case "ifconfig":
    case "netstat": {
      const currentIp = state.connectedIp || state.mission.gatewayIp;
      lines.push({ text: `eth0: inet ${currentIp}  netmask 255.255.255.0  broadcast ${state.mission.subnet}` });
      lines.push({ text: `ACTIVE PROXY HOPS: [${state.proxyChain.join(" -> ") || "DIRECT (NO BOUNCE)"}]` });
      lines.push({ text: `STATUS: ONLINE  MTU: 1500  RX packets: 4892  TX packets: 4210` });
      break;
    }

    case "ping": {
      const ip = args[0];
      if (!ip) {
        lines.push({ text: "Usage: ping <ip_address>", cls: "rk-line--err" });
        sound = "error";
        break;
      }
      if (state.nodes[ip]) {
        sound = "good";
        lines.push({ text: `PING ${ip} 56(84) bytes of data.` });
        lines.push({ text: `64 bytes from ${ip}: icmp_seq=1 ttl=64 time=1.42 ms` });
        lines.push({ text: `64 bytes from ${ip}: icmp_seq=2 ttl=64 time=0.98 ms` });
        lines.push({ text: `--- ${ip} ping statistics: 2 packets transmitted, 2 received, 0% packet loss ---` });
      } else {
        sound = "deny";
        lines.push({ text: `PING ${ip} (unknown host): Destination Host Unreachable.`, cls: "rk-line--err" });
      }
      break;
    }

    case "scan": {
      const target = args[0] || state.mission.subnet;
      sound = "good";

      // Subnet probe
      if (target.includes("/") || target === state.mission.subnet) {
        lines.push({ text: `[*] Initiating ARP/SYN sweep across ${target}...`, cls: "rk-line--dim" });
        const discovered = Object.entries(state.nodes);
        for (const [ip, data] of discovered) {
          lines.push({
            text: `[+] Host ${ip.padEnd(15)} [ONLINE] - Hostname: ${data.hostname.padEnd(18)} Ports: [${data.ports.join(", ")}]`,
          });
        }
        lines.push({ text: `[+] Sweep complete: ${discovered.length} active nodes discovered on subnet.` });
      } else {
        // Individual host probe
        const node = state.nodes[target];
        if (node) {
          lines.push({ text: `[*] Port scan report for ${target} (${node.hostname}):`, cls: "rk-line--dim" });
          for (const port of node.ports) {
            const isCracked = node.crackedPorts?.includes(port);
            const status = isCracked ? "OPEN (AUTHENTICATED)" : "OPEN (PROTECTED)";
            lines.push({ text: `  PORT ${String(port).padEnd(6)}/tcp  ${status}` });
          }
          if (node.guardedPort) {
            const isUnsealed = node.ports.includes(node.guardedPort);
            lines.push({
              text: `  PORT ${String(node.guardedPort).padEnd(6)}/tcp  ${isUnsealed ? "OPEN (KNOCKED)" : "FILTERED (FIREWALL GUARD)"}`,
              cls: isUnsealed ? "" : "rk-line--warn",
            });
          }
          if (node.isHoneypot) {
            lines.push({ text: `  [!] WARNING: Unusually low latency detected. Anomaly flags active.`, cls: "rk-line--warn" });
          }
        } else {
          lines.push({ text: `[-] Host ${target} unreachable or unresponsive.`, cls: "rk-line--err" });
          sound = "deny";
        }
      }
      break;
    }

    case "proxy": {
      const sub = (args[0] || "list").toLowerCase();
      if (sub === "list") {
        if (state.proxyChain.length === 0) {
          lines.push({ text: "PROXY STATUS: Direct connection. Trace damping: 0%." });
          lines.push({ text: "Tip: Use 'proxy add <ip>' with compromised nodes to dampen trace buildup." });
        } else {
          lines.push({ text: `ACTIVE PROXY CHAIN (${state.proxyChain.length} hops):` });
          state.proxyChain.forEach((ip, idx) => {
            lines.push({ text: `  Hop [${idx + 1}]: ${ip} (${state.nodes[ip]?.hostname || "relay"})` });
          });
          const dampPct = Math.round((1 - proxyDamping) * 100);
          lines.push({ text: `TRACE DAMPING EFFECTIVENESS: -${dampPct}% per offensive command.` });
        }
      } else if (sub === "add") {
        const ip = args[1];
        if (!ip) {
          lines.push({ text: "Usage: proxy add <ip>", cls: "rk-line--err" });
          sound = "error";
        } else if (!state.nodes[ip]) {
          lines.push({ text: `[-] Cannot add proxy ${ip}: host unreachable.`, cls: "rk-line--err" });
          sound = "deny";
        } else if (state.proxyChain.includes(ip)) {
          lines.push({ text: `[-] Host ${ip} is already in the proxy chain.` });
        } else {
          state.proxyChain.push(ip);
          sound = "good";
          lines.push({ text: `[+] Proxy hop added: ${ip}. Trace damping increased!` });
        }
      } else if (sub === "clear") {
        state.proxyChain = [];
        lines.push({ text: "[+] Proxy chain flushed. Connections reset to direct." });
      } else {
        lines.push({ text: "Usage: proxy [add <ip> | list | clear]", cls: "rk-line--err" });
      }
      break;
    }

    case "connect": {
      const ip = args[0];
      if (!ip) {
        lines.push({ text: "Usage: connect <ip>", cls: "rk-line--err" });
        sound = "error";
        break;
      }
      const targetNode = state.nodes[ip];
      if (targetNode) {
        if (targetNode.isHoneypot) {
          sound = "alarm";
          state.traceLevel = Math.min(100, state.traceLevel + 35);
          lines.push({ text: `========================================================`, cls: "rk-line--err" });
          lines.push({ text: `[!] ALARM TRIPWIRE: ${ip} IS AN ACTIVE COUNTER-INTEL HONEYPOT!`, cls: "rk-line--err" });
          lines.push({ text: `[!] TRACE ACCELERATED BY +35%. DISCONNECT IMMEDIATELY.`, cls: "rk-line--err" });
          lines.push({ text: `========================================================`, cls: "rk-line--err" });
        } else {
          sound = "good";
          lines.push({ text: `[+] Connected to remote node ${ip} (${targetNode.hostname}).` });
          lines.push({ text: `[+] Terminal session established. User privileges: ${targetNode.privilege || "guest"}.` });
        }
        state.connectedIp = ip;
      } else {
        sound = "deny";
        lines.push({ text: `[-] Connection timed out: ${ip} not responding.`, cls: "rk-line--err" });
      }
      break;
    }

    case "crack":
    case "brute": {
      const port = Number(args[0]);
      if (!state.connectedIp) {
        lines.push({ text: "[-] Must 'connect <ip>' to a host before running credential cracking.", cls: "rk-line--err" });
        sound = "error";
        break;
      }
      if (isNaN(port)) {
        lines.push({ text: "Usage: crack <port_number> (e.g. crack 22)", cls: "rk-line--err" });
        sound = "error";
        break;
      }
      if (!activeNode.ports.includes(port)) {
        sound = "deny";
        lines.push({ text: `[-] Port ${port} is closed, filtered, or unmounted. Access Denied.`, cls: "rk-line--err" });
        state.traceLevel = Math.min(100, state.traceLevel + 12);
        break;
      }
      sound = "good";
      if (!activeNode.crackedPorts) activeNode.crackedPorts = [];
      if (!activeNode.crackedPorts.includes(port)) activeNode.crackedPorts.push(port);
      activeNode.privilege = "user";
      lines.push({ text: `[*] Running dictionary attack against port ${port}...`, cls: "rk-line--dim" });
      lines.push({ text: `[+] Service authentication bypass successful! Credentials cached.` });
      lines.push({ text: `[+] Access level upgraded to 'user'. Type 'ls' to inspect directories.` });
      break;
    }

    case "knock": {
      const knockPorts = args.map(Number).filter((n) => !isNaN(n));
      if (knockPorts.length < 2) {
        lines.push({ text: "Usage: knock <port1> <port2> <port3> (e.g. knock 7721 8840 9912)", cls: "rk-line--err" });
        sound = "error";
        break;
      }
      const targetHost = activeNode || state.nodes["172.16.88.50"];
      if (targetHost && targetHost.knockSequence) {
        const expected = targetHost.knockSequence.join(" ");
        const actual = knockPorts.join(" ");
        if (expected === actual) {
          sound = "good";
          if (!targetHost.ports.includes(targetHost.guardedPort)) targetHost.ports.push(targetHost.guardedPort);
          lines.push({ text: `[*] Transmitting SYN packet sequence: [${knockPorts.join(", ")}]...`, cls: "rk-line--dim" });
          lines.push({ text: `[+] FIREWALL KNOCK VERIFIED! Guarded Port ${targetHost.guardedPort} UNLOCKED!` });
        } else {
          sound = "deny";
          lines.push({ text: `[-] Knock sequence [${knockPorts.join(", ")}] failed to trigger firewall rule.`, cls: "rk-line--err" });
          state.traceLevel = Math.min(100, state.traceLevel + 10);
        }
      } else {
        lines.push({ text: "[-] Target node has no port-knock firewall configured.", cls: "rk-line--err" });
        sound = "deny";
      }
      break;
    }

    case "sqli": {
      const query = args.join(" ");
      if (!state.connectedIp) {
        lines.push({ text: "[-] Must 'connect <ip>' before executing database injections.", cls: "rk-line--err" });
        sound = "error";
        break;
      }
      if (!activeNode.ports.includes(3306)) {
        lines.push({ text: "[-] Port 3306 (MySQL) not active on this host.", cls: "rk-line--err" });
        sound = "deny";
        break;
      }
      sound = "good";
      lines.push({ text: `[*] Injecting payload into MySQL daemon: ${query}`, cls: "rk-line--dim" });
      lines.push({ text: `+----+-----------------+-----------------------+--------------------------------------------------------+` });
      lines.push({ text: `| ID | FROM            | TO                    | MESSAGE BODY                                           |` });
      lines.push({ text: `+----+-----------------+-----------------------+--------------------------------------------------------+` });
      if (activeNode.mailDatabase) {
        for (const m of activeNode.mailDatabase) {
          const fromStr = m.from.padEnd(15);
          const toStr = m.to.padEnd(21);
          lines.push({ text: `| ${m.id}  | ${fromStr} | ${toStr} | ${m.body.padEnd(54)} |` });
        }
      }
      lines.push({ text: `+----+-----------------+-----------------------+--------------------------------------------------------+` });
      lines.push({ text: `[+] 5 rows dumped from table 'mail_intercepts'. Analyze sender alibis and traitor wire transfers.` });
      break;
    }

    case "dump": {
      const target = args[0];
      if (!target) {
        lines.push({ text: "Usage: dump <filename>", cls: "rk-line--err" });
        sound = "error";
        break;
      }
      if (isLockedOut(activeNode)) {
        lines.push(lockedMessage(activeNode));
        sound = "deny";
        break;
      }
      const files = activeNode ? activeNode.files : state.nodes[state.mission.gatewayIp]?.files;
      if (files && files[target]) {
        sound = "good";
        lines.push({ text: `[*] Generating Hex/ASCII memory dump of '${target}':`, cls: "rk-line--dim" });
        lines.push({ text: formatHexDump(files[target]), cls: "rk-line--dump" });
      } else {
        sound = "error";
        lines.push({ text: `[-] Cannot dump '${target}': file not found in directory.`, cls: "rk-line--err" });
      }
      break;
    }

    case "decrypt": {
      const file = args[0];
      const shift = Number(args[1]);
      if (!file || isNaN(shift)) {
        lines.push({ text: "Usage: decrypt <filename> <shift_key> (e.g. decrypt ledger.enc 5)", cls: "rk-line--err" });
        sound = "error";
        break;
      }
      if (isLockedOut(activeNode)) {
        lines.push(lockedMessage(activeNode));
        sound = "deny";
        break;
      }
      const files = activeNode ? activeNode.files : {};
      if (files && files[file]) {
        const plain = caesarDecrypt(files[file], shift);
        sound = "good";
        lines.push({ text: `[+] Caesar shift ${shift} applied to '${file}':` });
        lines.push({ text: plain, cls: "rk-line--success" });

        // Mission 2 check
        if (state.missionIdx === 1 && shift === 5 && file === "ledger.enc") {
          state.ledgerDecrypted = true;
          lines.push({ text: "[+] Financial transaction ledger extracted! Shred audit.log to finalize mission." });
        }
        // Mission 6 check
        if (state.missionIdx === 5 && shift === 7 && file === "security.enc") {
          lines.push({ text: "[+] Military bypass vector recovered: 'ROOT{SATAN_PREVIEW_MASTER_KY8}'. Exploit kernel to achieve root." });
        }
      } else {
        sound = "error";
        lines.push({ text: `[-] Cannot decrypt '${file}': file not found.`, cls: "rk-line--err" });
      }
      break;
    }

    case "exploit": {
      const targetSvc = (args[0] || "").toLowerCase();
      const token = args[1] || "";
      if (!activeNode) {
        lines.push({ text: "[-] Must 'connect <ip>' before triggering exploits.", cls: "rk-line--err" });
        sound = "error";
        break;
      }
      // Mission 5: Orbital override auth_daemon
      if (state.missionIdx === 4 && (targetSvc === "auth_daemon" || targetSvc === "8080")) {
        if (token === activeNode.authPasskey) {
          sound = "good";
          activeNode.privilege = "root";
          lines.push({ text: `[*] Overflowing buffer on auth_daemon with token '${token}'...`, cls: "rk-line--dim" });
          lines.push({ text: `[+] EIP pointer hijacked. Privilege escalated to ROOT!` });
          lines.push({ text: `[+] Satellite alignment unlocked. Execute 'override orbit' to synchronize.` });
        } else {
          sound = "deny";
          lines.push({ text: `[-] Authentication token invalid or rejected by daemon.`, cls: "rk-line--err" });
          state.traceLevel = Math.min(100, state.traceLevel + 15);
        }
        break;
      }
      // Mission 6: Kernel exploit
      if (state.missionIdx === 5 && (targetSvc === "kernel" || targetSvc === "ring0")) {
        if (token.includes("ROOT{SATAN") || token.includes("SATAN_PREVIEW")) {
          sound = "good";
          activeNode.privilege = "root";
          lines.push({ text: `[*] Injecting bypass vector into Kernel Ring 0 memory...`, cls: "rk-line--dim" });
          lines.push({ text: `[+] ROOT PRIVILEGES CONFIRMED. Kernel security disabled.` });
          lines.push({ text: `[+] Execute 'plant rootkit' to complete master infiltration.` });
        } else {
          sound = "deny";
          lines.push({ text: `[-] Kernel exploit rejected vector. Access denied.`, cls: "rk-line--err" });
        }
        break;
      }

      lines.push({ text: `[-] Exploit target '${targetSvc}' not vulnerable or missing token.`, cls: "rk-line--err" });
      sound = "deny";
      break;
    }

    case "override":
    case "run": {
      const target = (args[0] || "").toLowerCase();
      // Mission 3: SCADA override (only once the knock has unsealed Modbus port 502)
      if (state.missionIdx === 2 && state.connectedIp === "172.16.88.50" && !activeNode.ports.includes(activeNode.guardedPort)) {
        sound = "deny";
        lines.push({ text: `[-] Modbus port ${activeNode.guardedPort} is firewalled. Read the router's firewall.conf and execute the knock sequence first.`, cls: "rk-line--err" });
        break;
      }
      if (state.missionIdx === 2 && state.connectedIp === "172.16.88.50") {
        sound = "win";
        missionCleared = true;
        lines.push({ text: `[+] EMERGENCY OVERRIDE ENGAGED! Modbus registers patched.`, cls: "rk-line--success" });
        lines.push({ text: `[+] Cooling pumps restarted. Turbine temperature stabilized.` });
        break;
      }
      // Mission 5: Orbital override
      if (state.missionIdx === 4 && state.connectedIp === "198.51.100.44") {
        if (activeNode.privilege === "root") {
          sound = "win";
          missionCleared = true;
          lines.push({ text: `[+] ORBITAL ANTENNA ALIGNED! Telemetry synchronized with ESA ground control.`, cls: "rk-line--success" });
        } else {
          sound = "deny";
          lines.push({ text: `[-] Root privileges required to execute satellite orbital override.`, cls: "rk-line--err" });
        }
        break;
      }
      lines.push({ text: `Command '${action}' '${target}' not executable on this host.`, cls: "rk-line--err" });
      sound = "error";
      break;
    }

    case "accuse": {
      const name = (args[0] || "").toLowerCase();
      if (state.missionIdx === 3) {
        if (name === "raven") {
          sound = "win";
          missionCleared = true;
          lines.push({ text: `========================================================`, cls: "rk-line--success" });
          lines.push({ text: `[+] ACCUSATION VERIFIED! Agent Raven's crypto wire transfer confirmed.`, cls: "rk-line--success" });
          lines.push({ text: `[+] Defense contractor security dispatched to Sector 4.`, cls: "rk-line--success" });
          lines.push({ text: `========================================================`, cls: "rk-line--success" });
        } else {
          sound = "deny";
          lines.push({ text: `[-] INCORRECT! Agent ${name.toUpperCase()} has a verified alibi. Alarm raised!`, cls: "rk-line--err" });
          state.traceLevel = Math.min(100, state.traceLevel + 30);
        }
      } else {
        lines.push({ text: "accuse command only valid during active mole investigations.", cls: "rk-line--err" });
        sound = "error";
      }
      break;
    }

    case "plant": {
      if (cmd.toLowerCase() === "plant rootkit" && state.missionIdx === 5 && state.connectedIp === "10.99.99.1") {
        if (activeNode.privilege === "root") {
          sound = "win";
          missionCleared = true;
          lines.push({ text: `========================================================`, cls: "rk-line--success" });
          lines.push({ text: `[+] ROOTKIT INJECTED INTO KERNEL RING 0 MEMORY SPACE.`, cls: "rk-line--success" });
          lines.push({ text: `[+] PERSISTENCE MODULE INSTALLED. LOGGING DAEMON HOOKED.`, cls: "rk-line--success" });
          lines.push({ text: `[+] DATACENTER MASTER OVERLORD STATUS ACHIEVED!`, cls: "rk-line--success" });
          lines.push({ text: `========================================================`, cls: "rk-line--success" });
        } else {
          sound = "deny";
          lines.push({ text: `[-] Must elevate to root privilege before installing Ring-0 payload.`, cls: "rk-line--err" });
        }
      } else {
        lines.push({ text: "Usage: plant rootkit", cls: "rk-line--err" });
        sound = "error";
      }
      break;
    }

    case "shred": {
      const file = args[0];
      if (!file) {
        lines.push({ text: "Usage: shred <filename> (e.g. shred audit.log)", cls: "rk-line--err" });
        sound = "error";
        break;
      }
      if (isLockedOut(activeNode)) {
        lines.push(lockedMessage(activeNode));
        sound = "deny";
        break;
      }
      if (state.missionIdx === 1 && state.connectedIp === "192.168.4.25" && file === "audit.log" && !state.ledgerDecrypted && activeNode.files[file]) {
        lines.push({ text: "[-] Hold on: extract the ledger (decrypt ledger.enc <shift>) before wiping the audit trail.", cls: "rk-line--warn" });
        sound = "deny";
        break;
      }
      if (activeNode && activeNode.files && activeNode.files[file]) {
        delete activeNode.files[file];
        sound = "good";
        state.traceLevel = Math.max(0, state.traceLevel - 25);
        state.logsWiped = true;
        lines.push({ text: `[+] Overwriting '${file}' with cryptographic noise (35 passes)...` });
        lines.push({ text: `[+] File securely shredded. Forensic trail sanitized! Trace reduced by 25%.` });

        // Mission 2 condition: ledger decrypted and audit shredded
        if (state.missionIdx === 1 && state.connectedIp === "192.168.4.25" && file === "audit.log" && state.ledgerDecrypted) {
          sound = "win";
          missionCleared = true;
          lines.push({ text: `[+] MISSION COMPLETE: Ledger extracted and audit trails erased with zero forensic trace!`, cls: "rk-line--success" });
        }
      } else {
        sound = "error";
        lines.push({ text: `[-] Cannot shred '${file}': file does not exist.`, cls: "rk-line--err" });
      }
      break;
    }

    case "ls": {
      if (isLockedOut(activeNode)) {
        lines.push(lockedMessage(activeNode));
        sound = "deny";
        break;
      }
      const files = activeNode ? activeNode.files : state.nodes[state.mission.gatewayIp]?.files;
      if (files && Object.keys(files).length > 0) {
        const entries = Object.keys(files).map((f) => {
          const isEnc = f.endsWith(".enc");
          const isLog = f.endsWith(".log") || f.endsWith(".conf");
          const isFlag = f.startsWith("flag");
          return `${f}${isEnc ? " [ENCRYPTED]" : isLog ? " [CONF]" : isFlag ? " [SECRET]" : ""}`;
        });
        lines.push({ text: entries.join("    ") });
      } else {
        lines.push({ text: "Directory is empty." });
      }
      break;
    }

    case "cat": {
      const file = args[0];
      if (!file) {
        lines.push({ text: "Usage: cat <filename>", cls: "rk-line--err" });
        sound = "error";
        break;
      }
      if (isLockedOut(activeNode)) {
        lines.push(lockedMessage(activeNode));
        sound = "deny";
        break;
      }
      const files = activeNode ? activeNode.files : state.nodes[state.mission.gatewayIp]?.files;
      if (files && files[file]) {
        sound = "click";
        lines.push({ text: files[file] });

        // Mission 1 completion trigger
        if (state.missionIdx === 0 && file === "flag.txt" && state.connectedIp === "10.0.0.15") {
          sound = "win";
          missionCleared = true;
          lines.push({ text: `[+] FLAG VERIFIED: Subnet recon and authentication test passed!`, cls: "rk-line--success" });
        }
      } else {
        sound = "error";
        lines.push({ text: `cat: ${file}: No such file or directory`, cls: "rk-line--err" });
      }
      break;
    }

    case "exit":
    case "disconnect": {
      if (state.connectedIp) {
        sound = "good";
        lines.push({ text: `[-] Disconnected from host ${state.connectedIp}. Returned to gateway.` });
        state.connectedIp = null;
      } else {
        lines.push({ text: "Already at local root gateway terminal." });
      }
      break;
    }

    case "history": {
      if (state.commandHistory.length === 0) {
        lines.push({ text: "Command history is empty." });
      } else {
        state.commandHistory.forEach((c, i) => {
          lines.push({ text: `  ${String(i + 1).padStart(3)}  ${c}` });
        });
      }
      break;
    }

    default:
      sound = "error";
      lines.push({ text: `command not found: '${action}'. Type 'help' for available command directory.`, cls: "rk-line--err" });
      break;
  }

  return { lines, sound, missionCleared };
}
