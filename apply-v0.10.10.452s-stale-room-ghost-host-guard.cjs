const fs = require("fs");

const target = "src/rooms/MyRoom.ts";
if (!fs.existsSync(target)) {
  throw new Error(`452s: ${target} not found. Run this from the server project root.`);
}

let src = fs.readFileSync(target, "utf8");
const original = src;

function once(label, before, after) {
  const count = src.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`452s: ${label} expected 1 match, found ${count}. No file written.`);
  }
  src = src.replace(before, after);
}

/*
 * 1) A Lobby can temporarily contain reconnect-reserved PlayerState entries
 *    even after the last real socket disappeared.
 *
 *    While that zero-live shell exists, it MUST NOT accept a brand-new onJoin.
 *    Same-session Colyseus recovery goes through onReconnect(), not onJoin().
 */
once(
  "closing empty lobby field",
`  private readonly intentionalLeaveSessionIds =
    new Set<string>();

  /*
   * V1010366B_PAINT_HUNT_RECONNECT_BARRIER_EXACT`,
`  private readonly intentionalLeaveSessionIds =
    new Set<string>();

  /*
   * V1010452S_STALE_ROOM_GHOST_HOST_GUARD
   *
   * When the final REAL Lobby transport drops, the room may remain alive
   * briefly for same-session Colyseus reconnection. During that reservation
   * window the matchmaker/API can still be stale for a moment.
   *
   * Never allow a fresh join to revive that zero-live shell or inherit host
   * authority from its reconnect-reserved ghost PlayerState.
   *
   * Same-session recovery uses onReconnect(), so it remains supported.
   */
  private closingEmptyLobby = false;

  /*
   * V1010366B_PAINT_HUNT_RECONNECT_BARRIER_EXACT`
);

/*
 * 2) Reject a stale room click BEFORE it can create a PlayerState or become host.
 *    We add the transport to liveSessionIds first because onJoin already started;
 *    immediately remove it again and keep the room private.
 */
once(
  "onJoin stale shell guard",
`    this.markConnectionTopologyChanged();

    /*
     * V1010387_SERVER_FULL_ROOM_HARD_GUARD`,
`    this.markConnectionTopologyChanged();

    /*
     * V1010452S_STALE_ROOM_GHOST_HOST_GUARD
     *
     * A zero-live Lobby shell is reconnect-only. A room-list cache race must
     * never turn a fresh click into a new occupant / new host.
     */
    if (
      this.state.phase === "lobby" &&
      this.closingEmptyLobby
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
 * 3) The instant the last REAL Lobby socket drops, mark the room as closing.
 *    syncRoomListingVisibility() already hides it immediately.
 *
 *    Important: do NOT disconnect immediately here. Existing 8s same-session
 *    Lobby recovery remains intact.
 */
once(
  "onDrop zero-live lobby closing mark",
`    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    /*
     * Colyseus 0.17 distinguishes a temporary network drop from a real`,
`    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    /*
     * V1010452S_STALE_ROOM_GHOST_HOST_GUARD
     *
     * Last real Lobby socket vanished. Freeze this room against NEW joins
     * while the existing 8s same-session reconnect reservation is pending.
     */
    if (
      this.state.phase === "lobby" &&
      this.liveSessionIds.size === 0
    ) {
      this.closingEmptyLobby = true;
      this.setPrivate(true);
    }

    /*
     * Colyseus 0.17 distinguishes a temporary network drop from a real`
);

/*
 * 4) A legitimate same-session reconnect re-opens the Lobby.
 *    This is deliberately onReconnect only; fresh onJoin cannot clear it.
 */
once(
  "onReconnect reopen",
`  onReconnect(
    client: Client,
  ): void {
    /*
     * A fresh clientKey handoff may have replaced this exact old session`,
`  onReconnect(
    client: Client,
  ): void {
    /*
     * V1010452S_STALE_ROOM_GHOST_HOST_GUARD
     *
     * Only a genuine Colyseus same-session reconnect may revive a Lobby that
     * was frozen after its last live socket disappeared.
     */
    if (
      this.state.phase === "lobby" &&
      this.closingEmptyLobby &&
      this.state.players.has(
        client.sessionId,
      ) &&
      !this.supersededSessionIds.has(
        client.sessionId,
      )
    ) {
      this.closingEmptyLobby = false;
    }

    /*
     * A fresh clientKey handoff may have replaced this exact old session`
);

/*
 * 5) After onReconnect restores the real socket, normal listing visibility
 *    can resume. Anchor immediately before the existing liveSessionIds.add().
 */
once(
  "onReconnect live add reopen safety",
`    this.liveSessionIds.add(
      client.sessionId,
    );

    this.updateRoomMetadata();`,
`    this.closingEmptyLobby = false;

    this.liveSessionIds.add(
      client.sessionId,
    );

    this.updateRoomMetadata();`
);

/*
 * 6) Host authority in Lobby must be based on real transports only.
 *    The current ensureValidHost already does this, but explicitly exclude
 *    a closing zero-live shell so no future call can assign a ghost host.
 */
once(
  "ensureValidHost closing shell guard",
`  private ensureValidHost(): void {
    /*
     * v0.10.10.230 GHOST HOST FIX:`,
`  private ensureValidHost(): void {
    /*
     * V1010452S_STALE_ROOM_GHOST_HOST_GUARD
     *
     * A reconnect-only empty Lobby has no active host. Do not derive host
     * ownership from reconnect-reserved PlayerState entries.
     */
    if (
      this.state.phase === "lobby" &&
      this.closingEmptyLobby &&
      this.liveSessionIds.size === 0
    ) {
      this.state.hostId = "";
      return;
    }

    /*
     * v0.10.10.230 GHOST HOST FIX:`
);

/*
 * 7) Permanent leave/dispose cleanup.
 */
once(
  "onDispose closing flag cleanup",
`  onDispose(): void {
    this.intentionalLeaveSessionIds.clear();

    this.liveSessionIds.clear();`,
`  onDispose(): void {
    this.intentionalLeaveSessionIds.clear();
    this.closingEmptyLobby = false;

    this.liveSessionIds.clear();`
);

if (src === original) {
  throw new Error("452s: no changes produced. No file written.");
}

fs.writeFileSync(target, src, "utf8");

console.log("452s applied successfully.");
console.log("- zero-live Lobby shell is reconnect-only");
console.log("- stale room clicks are rejected before PlayerState/host creation");
console.log("- same-session onReconnect still revives the Lobby");
console.log("- ghost PlayerState can no longer donate host authority");
console.log("");
console.log("Next:");
console.log("  npm run build");
