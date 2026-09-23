import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MISSIONS,
  caesarDecrypt,
  caesarEncrypt,
  formatHexDump,
  createGameState,
  getAutocompleteSuggestions,
  executeCommand,
} from "./engine.js";

describe("Rootkit Mission Matrix & Network Topologies", () => {
  it("contains exactly 6 escalating hacking missions", () => {
    assert.equal(MISSIONS.length, 6, "Must have 6 missions");
    const ids = MISSIONS.map((m) => m.id);
    assert.deepEqual(ids, [
      "bootstrap",
      "the-ledger",
      "blackout",
      "the-mole",
      "orbital-override",
      "ring-0-rootkit",
    ]);
  });

  it("each mission defines a valid subnet, gateway, objective, and node map", () => {
    for (const m of MISSIONS) {
      assert.ok(m.title && m.title.length > 5, `Mission ${m.id} missing title`);
      assert.ok(m.objective && m.objective.length > 15, `Mission ${m.id} missing objective`);
      assert.ok(m.subnet && m.subnet.includes("/"), `Mission ${m.id} missing subnet notation`);
      assert.ok(m.gatewayIp, `Mission ${m.id} missing gateway IP`);
      assert.ok(m.nodes && Object.keys(m.nodes).length >= 1, `Mission ${m.id} must have >= 1 node`);

      for (const [ip, node] of Object.entries(m.nodes)) {
        assert.ok(node.hostname, `Node ${ip} missing hostname`);
        assert.ok(Array.isArray(node.ports), `Node ${ip} missing ports array`);
        assert.ok(node.files && typeof node.files === "object", `Node ${ip} missing files object`);
      }
    }
  });

  it("includes industrial SCADA port knock rules on Mission 3", () => {
    const scada = MISSIONS[2].nodes["172.16.88.50"];
    assert.ok(scada, "SCADA PLC node must exist in Mission 3");
    assert.equal(scada.guardedPort, 502, "SCADA must have guarded port 502");
    assert.deepEqual(scada.knockSequence, [7721, 8840, 9912], "Knock sequence must match");
  });
});

describe("Cryptographic Tools & Formatters", () => {
  it("caesarEncrypt and caesarDecrypt accurately round-trip", () => {
    const original = "FLAG{ROOTKIT_KERNEL_BYPASS_992}";
    const encrypted = caesarEncrypt(original, 5);
    assert.notEqual(encrypted, original, "Encrypted text should differ");
    const decrypted = caesarDecrypt(encrypted, 5);
    assert.equal(decrypted, original, "Decrypted text must match original");
  });

  it("formatHexDump formats address offsets, hex pairs, and ASCII sidebar", () => {
    const sample = "SYS://ROOTKIT";
    const dump = formatHexDump(sample);

    assert.ok(dump.startsWith("00000000:"), "Hex dump must start with 8-digit address offset");
    assert.ok(dump.includes("|SYS://ROOTKIT|"), "Hex dump must contain printable ASCII representation");
    assert.ok(dump.includes("53 59 53 3a"), "Hex dump must contain corresponding hex values");
  });
});

describe("Terminal Tab Autocompletion Engine", () => {
  it("suggests command names when typing command prefixes", () => {
    const state = createGameState(0);

    const scanSuggestions = getAutocompleteSuggestions("sc", state);
    assert.ok(scanSuggestions.includes("scan"), "Typing 'sc' must suggest 'scan'");

    const proxySuggestions = getAutocompleteSuggestions("pr", state);
    assert.ok(proxySuggestions.includes("proxy"), "Typing 'pr' must suggest 'proxy'");

    const shredSuggestions = getAutocompleteSuggestions("sh", state);
    assert.ok(shredSuggestions.includes("shred"), "Typing 'sh' must suggest 'shred'");
  });

  it("suggests available node IPs for connect and scan commands", () => {
    const state = createGameState(0); // Mission 1 has 10.0.0.1 and 10.0.0.15

    const connectSuggestions = getAutocompleteSuggestions("connect 10.", state);
    assert.deepEqual(connectSuggestions, ["10.0.0.1", "10.0.0.15"]);
  });

  it("suggests local filenames on currently connected node", () => {
    const state = createGameState(0);
    state.connectedIp = "10.0.0.15";

    const catSuggestions = getAutocompleteSuggestions("cat fl", state);
    assert.deepEqual(catSuggestions, ["flag.txt"], "Should autocomplete flag.txt");
  });
});

describe("Interactive Command Execution & Mechanics", () => {
  it("scan sweeps subnet and reveals active nodes", () => {
    const state = createGameState(0);
    const result = executeCommand("scan", state);

    assert.equal(result.sound, "good");
    assert.ok(
      result.lines.some((l) => l.text.includes("10.0.0.15")),
      "Scan output must contain research node IP 10.0.0.15",
    );
  });

  it("connecting to honeypot in Mission 2 trips alarm and spikes trace", () => {
    const state = createGameState(1);
    const initialTrace = state.traceLevel;

    const result = executeCommand("connect 192.168.4.9", state);
    assert.equal(result.sound, "alarm", "Connecting to honeypot must play alarm sound");
    assert.ok(state.traceLevel >= initialTrace + 35, "Trace must spike by >= 35%");
    assert.ok(
      result.lines.some((l) => l.text.includes("HONEYPOT")),
      "Must alert player that host is an active honeypot",
    );
  });

  it("proxy add reduces offensive trace penalty via damping", () => {
    const state1 = createGameState(0);
    executeCommand("scan 10.0.0.15", state1);
    const traceWithoutProxy = state1.traceLevel;

    const state2 = createGameState(0);
    executeCommand("proxy add 10.0.0.1", state2);
    executeCommand("scan 10.0.0.15", state2);
    const traceWithProxy = state2.traceLevel;

    assert.ok(
      traceWithProxy <= traceWithoutProxy,
      `Proxy damping should keep trace lower or equal (with: ${traceWithProxy}, without: ${traceWithoutProxy})`,
    );
  });

  it("port knock sequence unseals guarded port on SCADA node", () => {
    const state = createGameState(2); // Mission 3
    state.connectedIp = "172.168.88.50"; // Connect to SCADA node

    // Invalid knock sequence
    const badKnock = executeCommand("knock 1111 2222 3333", state);
    assert.equal(badKnock.sound, "deny", "Invalid knock sequence must fail");

    // Valid knock sequence
    const goodKnock = executeCommand("knock 7721 8840 9912", state);
    assert.equal(goodKnock.sound, "good", "Valid knock sequence must succeed");
    assert.ok(
      state.nodes["172.16.88.50"].ports.includes(502),
      "Guarded Port 502 must be added to open ports",
    );
  });

  it("sqli dumps database rows on SQL service", () => {
    const state = createGameState(3); // Mission 4
    state.connectedIp = "10.10.4.88";

    const result = executeCommand("sqli SELECT * FROM mail", state);
    assert.equal(result.sound, "good");
    assert.ok(
      result.lines.some((l) => l.text.includes("Agent Raven")),
      "SQL dump must reveal Agent Raven's wire transfer",
    );
  });

  it("accuse validates traitor identity", () => {
    const state = createGameState(3);

    const badAccuse = executeCommand("accuse fox", state);
    assert.equal(badAccuse.sound, "deny");
    assert.equal(badAccuse.missionCleared, false);

    const goodAccuse = executeCommand("accuse raven", state);
    assert.equal(goodAccuse.sound, "win");
    assert.equal(goodAccuse.missionCleared, true, "Accusing Raven should clear Mission 4");
  });

  it("shred removes target file and sanitizes trace", () => {
    const state = createGameState(1);
    state.connectedIp = "192.168.4.25";

    // Locked until a port is cracked, and the ledger must be extracted before wiping the audit trail.
    assert.equal(executeCommand("shred audit.log", state).missionCleared, false);
    executeCommand("crack 443", state);
    assert.equal(executeCommand("shred audit.log", state).missionCleared, false);
    const dec = executeCommand("decrypt ledger.enc 5", state);
    assert.ok(dec.lines.some((l) => l.text === "CODE{CONFIRM_BANK_TRANSFER_882}"), "ledger decrypts to readable text");
    state.traceLevel = 50;

    const shredResult = executeCommand("shred audit.log", state);
    assert.equal(shredResult.sound, "win");
    assert.equal(shredResult.missionCleared, true, "Shredding audit.log in Mission 2 must clear mission");
    assert.equal(state.traceLevel, 25, "Shredding audit.log must reduce trace by 25%");
    assert.equal(state.nodes["192.168.4.25"].files["audit.log"], undefined, "File must be deleted");
  });

  it("mission 1 completes when reading flag.txt on cracked host", () => {
    const state = createGameState(0);
    executeCommand("connect 10.0.0.15", state);
    executeCommand("crack 22", state);
    const catFlag = executeCommand("cat flag.txt", state);

    assert.equal(catFlag.sound, "win");
    assert.equal(catFlag.missionCleared, true, "Reading flag.txt must complete Mission 1");
  });
});
