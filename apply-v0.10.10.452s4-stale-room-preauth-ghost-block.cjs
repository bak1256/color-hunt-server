const fs = require("fs");
const path = require("path");

const target = path.join(process.cwd(), "src", "rooms", "MyRoom.ts");

if (!fs.existsSync(target)) {
  throw new Error(`452s4: ${target} not found. Run this from the server project root.`);
}

let src = fs.readFileSync(target, "utf8");
const original = src;

function once(label, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`452s4: ${label} expected 1 match, found ${count}. No file written.`);
  }
  src = src.replace(from, to);
}

/*
 * Root cause:
 * - 452s3 rejects stale room-card clicks in onJoin().
 * - But Colyseus can synchronize the room state before/around onJoin(), so the
 *   reconnect-reserved ghost actor can flash briefly in the newly clicked client.
 * - Reject the fresh join one stage earlier in onAuth().
 *
 * A true allowReconnection() recovery goes through onReconnect(), not this
 * fresh-join auth path, so the proven 8s same-session reconnect remains intact.
 */
once(
  "pre-auth stale empty lobby guard",
`  onAuth(
    _client: Client,
    options: JoinOptions,
  ): boolean {
    if (!this.state.isPrivate) {
      return true;
    }

    return (
      String(options.password ?? "") ===
      this.roomPassword
    );
  }`,
`  onAuth(
    _client: Client,
    options: JoinOptions,
  ): boolean {
    /*
     * V1010452S4_STALE_ROOM_PREAUTH_GHOST_BLOCK
     *
     * When the last REAL Lobby transport drops, 452s3 keeps the old PlayerState
     * for the proven 8-second same-session reconnect window. A stale room-list
     * card can still be clicked during listing-cache convergence.
     *
     * Reject that NEW join before onJoin/state synchronization. This prevents:
     * - the old ghost actor flashing for a moment
     * - a fresh session inheriting host after clicking the stale room card
     *
     * Legitimate same-session recovery is handled by allowReconnection() ->
     * onReconnect(), so it does not need to pass this fresh-join auth gate.
     */
    if (
      this.state.phase === "lobby" &&
      this.staleEmptyLobbyLocked &&
      this.liveSessionIds.size === 0
    ) {
      return false;
    }

    if (!this.state.isPrivate) {
      return true;
    }

    return (
      String(options.password ?? "") ===
      this.roomPassword
    );
  }`
);

/*
 * The moment the final real Lobby socket disappears, remove host authority too.
 * state.players is intentionally preserved only as reconnect data.
 */
once(
  "zero-live lobby host authority clear",
`    if (
      this.state.phase === "lobby" &&
      this.liveSessionIds.size === 0
    ) {
      this.staleEmptyLobbyLocked = true;
      this.setPrivate(true);
    }`,
`    if (
      this.state.phase === "lobby" &&
      this.liveSessionIds.size === 0
    ) {
      this.staleEmptyLobbyLocked = true;
      this.state.hostId = "";
      this.setPrivate(true);

      /*
       * Publish the zero-live/no-host state immediately. The room-list service
       * may still show a cached card briefly, but that card can no longer enter
       * the room and no disconnected actor owns host authority.
       */
      this.updateRoomMetadata();
      this.syncRoomListingVisibility();
    }`
);

/*
 * Make the existing onJoin fallback guard equally strict. Normally s4 blocks
 * the request in onAuth(), but this remains a defensive second boundary.
 */
once(
  "onJoin stale guard host clear",
`    if (
      this.state.phase === "lobby" &&
      this.staleEmptyLobbyLocked
    ) {
      this.liveSessionIds.delete(
        client.sessionId,
      );`,
`    if (
      this.state.phase === "lobby" &&
      this.staleEmptyLobbyLocked
    ) {
      this.state.hostId = "";

      this.liveSessionIds.delete(
        client.sessionId,
      );`
);

if (src === original) {
  throw new Error("452s4: no changes produced. No file written.");
}

const backup = `${target}.bak-v0.10.10.452s4`;
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, original, "utf8");
}

fs.writeFileSync(target, src, "utf8");

console.log("452s4 applied successfully:");
console.log(`  target : ${target}`);
console.log(`  backup : ${backup}`);
console.log("");
console.log("Behavior:");
console.log("  - last real Lobby socket drop => room locked + hostId cleared immediately");
console.log("  - stale room-card fresh join => rejected in onAuth before ghost state sync");
console.log("  - same-session allowReconnection recovery => still allowed for 8 seconds");
console.log("  - failed reconnect => existing onLeave/dispose path removes the room");
