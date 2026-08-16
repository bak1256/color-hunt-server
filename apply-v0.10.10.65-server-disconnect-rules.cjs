const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

function methodRange(name) {
  const patterns = [
    `  ${name}(`,
    `  ${name} (`,
    `  async ${name}(`,
    `  async ${name} (`,
  ];

  let start = -1;
  for (const p of patterns) {
    start = s.indexOf(p);
    if (start >= 0) break;
  }

  if (start < 0) {
    throw new Error(`Could not find ${name}() in MyRoom.ts`);
  }

  const braceStart = s.indexOf("{", start);
  let depth = 0;
  let end = -1;

  for (let i = braceStart; i < s.length; i += 1) {
    if (s[i] === "{") depth += 1;
    if (s[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error(`Could not parse ${name}()`);
  }

  return { start, end };
}

// ------------------------------------------------------------------
// 1) Temporary network drops get 10 seconds to recover.
// ------------------------------------------------------------------
if (!s.includes("async onDrop(")) {
  const leave = methodRange("onLeave");
  const block = `  async onDrop(
    client: Client,
    code: number,
  ): Promise<void> {
    console.log("[Color Hunt] temporary drop", {
      sessionId: client.sessionId,
      code,
    });

    try {
      await this.allowReconnection(
        client,
        10,
      );
    } catch {
      // Permanent leave continues through onLeave().
    }
  }

  onReconnect(
    client: Client,
  ): void {
    console.log("[Color Hunt] reconnected", {
      sessionId: client.sessionId,
      phase: this.state.phase,
    });

    this.sendLobbySnapshot(client);

    client.send("phase_changed", {
      phase: this.state.phase,
      phaseEndsAt: this.state.phaseEndsAt,
    });
  }

`;

  s = s.slice(0, leave.start) + block + s.slice(leave.start);
  console.log("[ok] 10s reconnection grace added");
} else {
  console.log("[skip] reconnection grace already exists");
}

// ------------------------------------------------------------------
// 2) Permanent leave notification + phase-safe outcome rules.
// ------------------------------------------------------------------
{
  const range = methodRange("onLeave");
  let method = s.slice(range.start, range.end);

  // Capture the leaving player BEFORE deletion so name/role are not lost.
  if (!method.includes("const leavingPlayer =")) {
    const deleteNeedle = "this.state.players.delete(client.sessionId);";
    const deleteAt = method.indexOf(deleteNeedle);

    if (deleteAt < 0) {
      throw new Error(
        "Could not find this.state.players.delete(client.sessionId) inside onLeave()"
      );
    }

    const capture = `const leavingPlayer =
      this.state.players.get(
        client.sessionId,
      );

    const leavingName =
      leavingPlayer?.name ??
      "Player";

    `;

    method =
      method.slice(0, deleteAt) +
      capture +
      method.slice(deleteAt);
  }

  // Broadcast only after the player is removed; remaining clients receive it.
  if (!method.includes('"player_disconnected"')) {
    const deleteNeedle = "this.state.players.delete(client.sessionId);";
    const deleteAt = method.indexOf(deleteNeedle);
    const afterDelete = deleteAt + deleteNeedle.length;

    const notice = `

    if (leavingPlayer) {
      this.broadcast(
        "player_disconnected",
        {
          sessionId:
            client.sessionId,
          name:
            leavingName,
        },
      );
    }`;

    method =
      method.slice(0, afterDelete) +
      notice +
      method.slice(afterDelete);
  }

  // Replace the whole active-round outcome block. This removes the older
  // "hiderCount === 0 => Hunter win" behavior during Countdown/Paint.
  const roundStart = method.indexOf("    if (roundIsActive) {");

  if (roundStart < 0) {
    throw new Error("Could not find if (roundIsActive) block in onLeave()");
  }

  const braceStart = method.indexOf("{", roundStart);
  let depth = 0;
  let roundEnd = -1;

  for (let i = braceStart; i < method.length; i += 1) {
    if (method[i] === "{") depth += 1;
    if (method[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        roundEnd = i + 1;
        break;
      }
    }
  }

  if (roundEnd < 0) {
    throw new Error("Could not parse active-round onLeave block");
  }

  const newRoundBlock = `    if (roundIsActive) {
      const players =
        [...this.state.players.values()];

      const hunterCount =
        players.filter(
          (player) =>
            player.role === "hunter",
        ).length;

      const hiderCount =
        players.filter(
          (player) =>
            player.role === "hider",
        ).length;

      if (players.length === 0) {
        this.resetToLobby();
        return;
      }

      /*
       * BEFORE HUNT:
       * All Hiders disappearing is NOT a Hunter victory.  It means the
       * round no longer has a valid hide-and-seek setup, so cancel it and
       * return the remaining players to Lobby.
       */
      if (
        this.state.phase === "countdown" ||
        this.state.phase === "paint"
      ) {
        if (
          hiderCount < 1 &&
          hunterCount >= 1
        ) {
          this.broadcast(
            "round_aborted",
            {
              message:
                "All Hiders disconnected. Returning to the lobby.",
            },
          );

          this.resetToLobby();
          return;
        }

        if (
          hunterCount < 1 &&
          hiderCount >= 1
        ) {
          this.finishGame("hiders");
          return;
        }

        return;
      }

      /*
       * HUNT:
       * A disconnected Hider is treated as eliminated. Only after the last
       * Hider is truly gone may Hunters win. If all Hunters leave, Hiders win.
       */
      if (this.state.phase === "hunt") {
        if (
          hunterCount < 1 &&
          hiderCount >= 1
        ) {
          this.finishGame("hiders");
          return;
        }

        if (
          hiderCount < 1 &&
          hunterCount >= 1
        ) {
          this.finishGame("hunters");
          return;
        }
      }
    }`;

  method =
    method.slice(0, roundStart) +
    newRoundBlock +
    method.slice(roundEnd);

  s =
    s.slice(0, range.start) +
    method +
    s.slice(range.end);

  console.log("[ok] permanent disconnect notification broadcast");
  console.log("[ok] pre-Hunt all-Hider leave now aborts to Lobby, not Hunter victory");
  console.log("[ok] Hunt disconnects still resolve by remaining teams");
}

// Sanity
const finalLeave = (() => {
  const r = methodRange("onLeave");
  return s.slice(r.start, r.end);
})();

for (const needle of [
  '"player_disconnected"',
  "const leavingPlayer =",
  'this.state.phase === "paint"',
  'this.state.phase === "hunt"',
  '"round_aborted"',
]) {
  if (!finalLeave.includes(needle)) {
    throw new Error(`Sanity failed: missing ${needle}`);
  }
}

fs.writeFileSync(path, s, "utf8");

console.log("");
console.log("Done. v0.10.10.65 disconnect/rules patch applied.");
console.log("Next: npm run build");
