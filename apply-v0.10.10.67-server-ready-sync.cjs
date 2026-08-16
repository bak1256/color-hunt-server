const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

function methodRange(name) {
  const marker = `private ${name}`;
  const start = s.indexOf(marker);
  if (start < 0) throw new Error(`Could not find ${name}()`);
  const brace = s.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < s.length; i += 1) {
    if (s[i] === "{") depth += 1;
    if (s[i] === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  throw new Error(`Could not parse ${name}()`);
}

// READY set + broadcaster
if (!s.includes("private readonly paintReadySessionIds")) {
  const marker = "  messages = {";
  if (!s.includes(marker)) throw new Error("messages object not found");
  const fields = `  private readonly paintReadySessionIds =
    new Set<string>();

  private broadcastPaintReadyState(): void {
    const hiders =
      [...this.state.players.entries()]
        .filter(
          ([, player]) =>
            player.role === "hider",
        );

    const activeHiderIds =
      new Set(
        hiders.map(
          ([sessionId]) =>
            sessionId,
        ),
      );

    for (
      const sessionId of
      [...this.paintReadySessionIds]
    ) {
      if (!activeHiderIds.has(sessionId)) {
        this.paintReadySessionIds.delete(sessionId);
      }
    }

    const readyCount =
      hiders.filter(
        ([sessionId]) =>
          this.paintReadySessionIds
            .has(sessionId),
      ).length;

    const hiderCount =
      hiders.length;

    this.broadcast(
      "paint_ready_state",
      {
        readySessionIds:
          [...this.paintReadySessionIds],
        readyCount,
        hiderCount,
        allHidersReady:
          hiderCount > 0 &&
          readyCount === hiderCount,
      },
    );
  }

`;
  s=s.replace(marker,fields+marker);
  console.log("[ok] Paint READY state/broadcaster");
} else {
  console.log("[skip] Paint READY state already exists");
}

// Message handlers
if (!s.includes("paint_ready: (")) {
  const marker="  messages = {\n";
  if (!s.includes(marker)) throw new Error("messages marker not found");
  const handlers=`  messages = {
    paint_ready: (
      client: Client,
      message: {
        ready?: boolean;
      },
    ): void => {
      if (this.state.phase !== "paint") {
        return;
      }

      const player =
        this.state.players.get(
          client.sessionId,
        );

      if (
        !player ||
        player.role !== "hider"
      ) {
        return;
      }

      if (message?.ready === true) {
        this.paintReadySessionIds.add(
          client.sessionId,
        );
      } else {
        this.paintReadySessionIds.delete(
          client.sessionId,
        );
      }

      this.broadcastPaintReadyState();
    },

    early_start_hunt: (
      client: Client,
    ): void => {
      if (this.state.phase !== "paint") {
        return;
      }

      const requester =
        this.state.players.get(
          client.sessionId,
        );

      if (
        !requester ||
        requester.role !== "hunter"
      ) {
        return;
      }

      const hiders =
        [...this.state.players.entries()]
          .filter(
            ([, player]) =>
              player.role === "hider",
          );

      if (
        hiders.length < 1 ||
        !hiders.every(
          ([sessionId]) =>
            this.paintReadySessionIds
              .has(sessionId),
        )
      ) {
        return;
      }

      /*
       * v0.10.10.66 startHuntPhase deadline guard remains authoritative.
       * Move the deadline to NOW only after every active Hider is ready.
       */
      this.state.phaseEndsAt =
        Date.now();

      this.startHuntPhase();
    },

`;
  s=s.replace(marker,handlers);
  console.log("[ok] Hider READY + Hunter early-start handlers");
} else {
  console.log("[skip] READY handlers already exist");
}

// Clear READY whenever Paint begins
{
  const r=methodRange("startPaintPhase");
  let m=s.slice(r.start,r.end);
  if (!m.includes("this.paintReadySessionIds.clear();")) {
    const brace=m.indexOf("{");
    const add=`
    this.paintReadySessionIds.clear();

`;
    m=m.slice(0,brace+1)+add+m.slice(brace+1);
    s=s.slice(0,r.start)+m+s.slice(r.end);
    console.log("[ok] READY reset on Paint start");
  }
}

// Broadcast initial empty READY state after phase has actually become paint.
// Insert after broadcastPhaseChanged if present, otherwise after metadata update.
{
  const r=methodRange("startPaintPhase");
  let m=s.slice(r.start,r.end);
  if (!m.includes("this.broadcastPaintReadyState();")) {
    const candidates=[
      "    this.broadcastPhaseChanged();",
      "    this.updateRoomMetadata();"
    ];
    let done=false;
    for (const target of candidates) {
      const at=m.lastIndexOf(target);
      if (at>=0) {
        const end=at+target.length;
        m=m.slice(0,end)+"\n    this.broadcastPaintReadyState();"+m.slice(end);
        done=true; break;
      }
    }
    if (!done) throw new Error("Could not insert initial READY broadcast");
    s=s.slice(0,r.start)+m+s.slice(r.end);
    console.log("[ok] initial READY broadcast");
  }
}

// Clear on Hunt and Lobby reset
for (const name of ["startHuntPhase","resetToLobby"]) {
  const r=methodRange(name);
  let m=s.slice(r.start,r.end);
  if (!m.includes("this.paintReadySessionIds.clear();")) {
    const brace=m.indexOf("{");
    m=m.slice(0,brace+1)+"\n    this.paintReadySessionIds.clear();\n"+m.slice(brace+1);
    s=s.slice(0,r.start)+m+s.slice(r.end);
    console.log(`[ok] READY cleanup in ${name}`);
  }
}

// onLeave: remove leaving id + update ready state after player deletion.
{
  const r=methodRange("onLeave");
  let m=s.slice(r.start,r.end);
  if (!m.includes("this.paintReadySessionIds.delete(client.sessionId);")) {
    const del="this.state.players.delete(client.sessionId);";
    const at=m.indexOf(del);
    if (at<0) throw new Error("player delete not found in onLeave");
    const end=at+del.length;
    m=m.slice(0,end)+`
    this.paintReadySessionIds.delete(
      client.sessionId,
    );

    if (this.state.phase === "paint") {
      this.broadcastPaintReadyState();
    }`+m.slice(end);
    s=s.slice(0,r.start)+m+s.slice(r.end);
    console.log("[ok] READY count follows disconnects");
  }
}

// Improve phase payload for diagnostics/sync. Existing clients ignore extra field.
if (s.includes("private broadcastPhaseChanged(): void")) {
  const r=methodRange("broadcastPhaseChanged");
  let m=s.slice(r.start,r.end);
  if (!m.includes("serverNow:")) {
    const needle="phaseEndsAt:\n          this.state.phaseEndsAt,";
    if (m.includes(needle)) {
      m=m.replace(needle,needle+"\n        serverNow: Date.now(),");
      s=s.slice(0,r.start)+m+s.slice(r.end);
      console.log("[ok] phase packets include serverNow");
    }
  }
}

fs.writeFileSync(path,s,"utf8");
console.log("");
console.log("Done. v0.10.10.67 READY/sync server patch applied.");
console.log("Next: npm run build");
