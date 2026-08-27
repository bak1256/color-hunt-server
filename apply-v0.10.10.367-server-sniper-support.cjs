const fs = require("fs");
const path = require("path");

const files = {
  server: path.join("server", "src", "rooms", "MyRoom.ts"),
  client: path.join("src", "network", "MultiplayerClient.ts"),
  scene: path.join("src", "game", "GameScene.ts"),
};

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}
function write(file, text) {
  fs.writeFileSync(file, text, "utf8");
}
function once(text, needle, replacement, label) {
  const count = text.split(needle).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 anchor, found ${count}`);
  return text.replace(needle, replacement);
}
function insertBefore(text, needle, addition, label) {
  return once(text, needle, addition + needle, label);
}
function insertAfter(text, needle, addition, label) {
  return once(text, needle, needle + addition, label);
}

/* =========================
 * SERVER ONLY
 * ========================= */

let server = read(files.server);

server = insertBefore(server,
`type FartUseMessage = {`,
`/* V1010453_SNIPER_SUPPORT_MODE */
type SniperToggleMessage = { active?: boolean };
type SniperAimMessage = { x?: number; y?: number };
type SniperFireMessage = { x?: number; y?: number };

`,
"server sniper message types");

server = insertAfter(server,
`  private readonly lastShotAt =
    new Map<string, number>();
`,
`
  /* V1010453_SNIPER_SUPPORT_MODE */
  private readonly sniperActiveHunters = new Set<string>();
  private readonly lastSniperAimAt = new Map<string, number>();
  private readonly lastSniperFireAt = new Map<string, number>();
  private readonly sniperAvailableRemainingMs = 30_000;
  private readonly sniperWarningRemainingMs = 35_000;
  private readonly sniperReloadMs = 3_000;
  private readonly sniperHitRadius = 20;

`,
"server sniper fields");

server = once(server,
`      if (
        !player ||
        !player.alive
      ) {
        return;
      }
`,
`      if (
        !player ||
        !player.alive ||
        (
          player.role === "hunter" &&
          this.sniperActiveHunters.has(client.sessionId)
        )
      ) {
        return;
      }
`,
"server movement lock");

server = insertBefore(server,
`    hunter_aim: (`,
`    /* V1010453_SNIPER_SUPPORT_MODE */
    sniper_toggle: (
      client: Client,
      message: SniperToggleMessage,
    ): void => {
      if (this.state.phase !== "hunt") return;

      const hunter = this.state.players.get(client.sessionId);
      if (!hunter || hunter.role !== "hunter" || !hunter.alive) return;

      const remainingMs = Math.max(0, this.state.phaseEndsAt - Date.now());
      const wantsActive = Boolean(message?.active);

      if (wantsActive && remainingMs > this.sniperAvailableRemainingMs) {
        client.send("sniper_state", {
          sessionId: client.sessionId,
          active: false,
          available: false,
          remainingMs,
          serverNow: Date.now(),
        });
        return;
      }

      if (wantsActive) {
        this.sniperActiveHunters.add(client.sessionId);
      } else {
        this.sniperActiveHunters.delete(client.sessionId);
      }

      this.broadcast("sniper_state", {
        sessionId: client.sessionId,
        active: wantsActive,
        available: remainingMs <= this.sniperAvailableRemainingMs,
        remainingMs,
        serverNow: Date.now(),
      });
    },

    sniper_aim: (
      client: Client,
      message: SniperAimMessage,
    ): void => {
      if (
        this.state.phase !== "hunt" ||
        !this.sniperActiveHunters.has(client.sessionId)
      ) return;

      const hunter = this.state.players.get(client.sessionId);
      if (!hunter || hunter.role !== "hunter" || !hunter.alive) return;

      const x = Number(message?.x);
      const y = Number(message?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const now = Date.now();
      const previous = this.lastSniperAimAt.get(client.sessionId) ?? 0;
      if (now - previous < 66) return;
      this.lastSniperAimAt.set(client.sessionId, now);

      this.broadcast("sniper_aim", {
        sessionId: client.sessionId,
        x: Math.max(0, Math.min(960, x)),
        y: Math.max(0, Math.min(540, y)),
      });
    },

    sniper_fire: (
      client: Client,
      message: SniperFireMessage,
    ): void => {
      if (
        this.state.phase !== "hunt" ||
        !this.sniperActiveHunters.has(client.sessionId)
      ) return;

      const hunter = this.state.players.get(client.sessionId);
      if (!hunter || hunter.role !== "hunter" || !hunter.alive) return;

      const remainingMs = Math.max(0, this.state.phaseEndsAt - Date.now());
      if (remainingMs > this.sniperAvailableRemainingMs) return;

      const x = Math.max(0, Math.min(960, Number(message?.x)));
      const y = Math.max(0, Math.min(540, Number(message?.y)));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const now = Date.now();
      const previous = this.lastSniperFireAt.get(client.sessionId) ?? 0;
      if (now - previous < this.sniperReloadMs) {
        client.send("sniper_reload", {
          readyAt: previous + this.sniperReloadMs,
          serverNow: now,
        });
        return;
      }
      this.lastSniperFireAt.set(client.sessionId, now);

      let hitId = "";
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const [sessionId, target] of this.state.players) {
        if (target.role !== "hider" || !target.alive) continue;
        const distance = Math.hypot(target.x - x, target.y - y);
        if (distance <= this.sniperHitRadius && distance < bestDistance) {
          bestDistance = distance;
          hitId = sessionId;
        }
      }

      if (hitId) {
        const target = this.state.players.get(hitId);
        if (target && target.role === "hider" && target.alive) {
          if (!this.victoryFoundHiders.some((entry) => entry.sessionId === hitId)) {
            this.victoryFoundHiders.push({
              sessionId: hitId,
              name: String(target.name ?? "Hider").slice(0, 32),
              x: target.x,
              y: target.y,
              foundOrder: this.victoryFoundHiders.length + 1,
              foundAt: now,
            });
          }
          target.alive = false;
        }
      }

      this.broadcast("sniper_fired", {
        shooterId: client.sessionId,
        x,
        y,
        hitId,
        readyAt: now + this.sniperReloadMs,
        serverNow: now,
      });

      if (hitId && this.getAliveHiderCount() === 0) {
        this.finishGame("hunters");
      }
    },

`,
"server sniper handlers");

server = insertAfter(server,
`    this.state.phase = "hunt";
`,
`
    /* V1010453_SNIPER_SUPPORT_MODE: each Hunt starts clean. */
    this.sniperActiveHunters.clear();
    this.lastSniperAimAt.clear();
    this.lastSniperFireAt.clear();

`,
"server hunt reset");

server = insertAfter(server,
`    this.state.phase = "finished";
`,
`
    this.sniperActiveHunters.clear();

`,
"server finish clear");

server = insertAfter(server,
`    this.poopLaughTriggeredHunters.clear();
    this.state.phase = "lobby";
`,
`
    this.sniperActiveHunters.clear();
    this.lastSniperAimAt.clear();
    this.lastSniperFireAt.clear();
`,
"server lobby clear");

write(files.server, server);


console.log("Applied SERVER v0.10.10.367 sniper support mode.");
console.log("Changed:");
console.log(" - server/src/rooms/MyRoom.ts");
console.log("");
console.log("Next: npm --prefix server run build");
