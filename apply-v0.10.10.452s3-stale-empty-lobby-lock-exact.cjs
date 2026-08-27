const fs = require("fs");

const target = "src/rooms/MyRoom.ts";
if (!fs.existsSync(target)) {
  throw new Error(`452s3: ${target} not found. Run this in color-hunt-server.`);
}

let src = fs.readFileSync(target, "utf8");
const original = src;

if (src.includes("V1010452S3_STALE_EMPTY_LOBBY_LOCK")) {
  console.log("452s3: already applied.");
  process.exit(0);
}

function once(label, before, after) {
  const count = src.split(before).length - 1;
  if (count !== 1) {
    throw new Error(
      `452s3: ${label} expected 1 match, found ${count}. No file written.`
    );
  }
  src = src.replace(before, after);
}

/*
 * When the LAST real Lobby socket drops, state.players intentionally survives
 * for the existing 8-second same-session reconnect window.
 *
 * During those 8 seconds the external room list can still be stale.
 * This flag makes that shell reconnect-only: onReconnect may revive it,
 * but a brand-new onJoin from a stale room card may not.
 */
once(
  "field",
`  private readonly intentionalLeaveSessionIds =
    new Set<string>();

  /*
   * V1010366B_PAINT_HUNT_RECONNECT_BARRIER_EXACT`,
`  private readonly intentionalLeaveSessionIds =
    new Set<string>();

  /*
   * V1010452S3_STALE_EMPTY_LOBBY_LOCK
   *
   * True only while a Lobby has zero REAL transports but is still alive for
   * the proven 8-second same-session reconnect reservation.
   * Fresh onJoin must never revive this stale shell.
   */
  private staleEmptyLobbyLocked = false;

  /*
   * V1010366B_PAINT_HUNT_RECONNECT_BARRIER_EXACT`
);

/*
 * Reject a stale room-list click before PlayerState creation / clientKey
 * handoff / host assignment.
 */
once(
  "onJoin guard",
`    this.markConnectionTopologyChanged();

    /*
     * V1010387_SERVER_FULL_ROOM_HARD_GUARD`,
`    this.markConnectionTopologyChanged();

    /*
     * V1010452S3_STALE_EMPTY_LOBBY_LOCK / FRESH_JOIN_GUARD
     *
     * The room list may lag behind setPrivate(true). If this room lost its
     * final real Lobby socket, only Colyseus onReconnect() for the preserved
     * session may revive it. A normal room-card click is a fresh onJoin and
     * must be rejected before it can create a ghost actor or inherit host.
     */
    if (
      this.state.phase === "lobby" &&
      this.staleEmptyLobbyLocked
    ) {
      this.liveSessionIds.delete(
        client.sessionId,
      );
      this.markConnectionTopologyChanged();

      this.updateRoomMetadata();
      this.syncRoomListingVisibility();
      this.setPrivate(true);

      client.send(
        "join_rejected",
        {
          reason: "room_closed",
          returnToLobby: true,
        },
      );

      this.clock.setTimeout(
        () => {
          try {
            client.leave(
              4004,
              "room_closed",
            );
          } catch {
            // Transport may already be gone.
          }
        },
        0,
      );

      return;
    }

    /*
     * V1010387_SERVER_FULL_ROOM_HARD_GUARD`
);

/*
 * Lock immediately after the final real Lobby transport disappears.
 * Keep the existing 8-second allowReconnection behavior untouched.
 */
once(
  "onDrop lock",
`    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    /*
     * Colyseus 0.17 distinguishes a temporary network drop from a real`,
`    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    /*
     * V1010452S3_STALE_EMPTY_LOBBY_LOCK / DROP
     *
     * Hide already happens above via liveSessionIds.size === 0.
     * Additionally freeze this zero-live Lobby against NEW joins while the
     * existing 8-second same-session reconnect reservation is pending.
     */
    if (
      this.state.phase === "lobby" &&
      this.liveSessionIds.size === 0
    ) {
      this.staleEmptyLobbyLocked = true;
      this.setPrivate(true);
    }

    /*
     * Colyseus 0.17 distinguishes a temporary network drop from a real`
);

/*
 * A genuine same-session reconnect is the ONLY operation allowed to unlock
 * the zero-live shell. Do it after stale/superseded reconnect guards have
 * passed and immediately before restoring live transport authority.
 */
once(
  "onReconnect unlock",
`    this.liveSessionIds.add(
      client.sessionId,
    );
    this.markConnectionTopologyChanged();

    this.markRoleConnectionRestored(`,
`    /*
     * V1010452S3_STALE_EMPTY_LOBBY_LOCK / RECONNECT
     *
     * We reached here only after superseded/stale reconnect rejection above.
     * Therefore this is a legitimate preserved-session recovery.
     */
    if (
      this.state.phase === "lobby"
    ) {
      this.staleEmptyLobbyLocked = false;
    }

    this.liveSessionIds.add(
      client.sessionId,
    );
    this.markConnectionTopologyChanged();

    this.markRoleConnectionRestored(`
);

/*
 * Host validation must never derive authority from reconnect-reserved ghosts
 * while the zero-live Lobby shell is locked.
 */
once(
  "host guard",
`  private ensureValidHost(): void {
    /*
     * v0.10.10.230 GHOST HOST FIX:`,
`  private ensureValidHost(): void {
    /*
     * V1010452S3_STALE_EMPTY_LOBBY_LOCK / HOST
     *
     * A locked zero-live Lobby has no active host. state.players can still
     * contain the reconnect-reserved old actor, but it has no authority until
     * its real transport reconnects.
     */
    if (
      this.state.phase === "lobby" &&
      this.staleEmptyLobbyLocked &&
      this.liveSessionIds.size === 0
    ) {
      this.state.hostId = "";
      return;
    }

    /*
     * v0.10.10.230 GHOST HOST FIX:`
);

/*
 * Normal permanent cleanup resets the transient lock.
 */
once(
  "dispose cleanup",
`  onDispose(): void {
    this.intentionalLeaveSessionIds.clear();

    this.liveSessionIds.clear();`,
`  onDispose(): void {
    this.intentionalLeaveSessionIds.clear();
    this.staleEmptyLobbyLocked = false;

    this.liveSessionIds.clear();`
);

if (src === original) {
  throw new Error("452s3: no changes produced. No file written.");
}

fs.mkdirSync(".patch-backups", { recursive: true });
fs.writeFileSync(
  ".patch-backups/MyRoom-before-v0.10.10.452s3.ts",
  original,
  "utf8",
);
fs.writeFileSync(target, src, "utf8");

console.log("452s3 applied successfully.");
console.log("- last-live Lobby drop becomes reconnect-only");
console.log("- stale room-card fresh onJoin is rejected before PlayerState creation");
console.log("- valid same-session onReconnect unlocks the Lobby");
console.log("- reconnect-reserved ghost cannot donate host authority");
console.log("- existing 8-second Lobby reconnect window is preserved");
console.log("");
console.log("Next: npm run build");
