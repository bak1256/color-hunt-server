const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
if (!fs.existsSync(path)) {
  throw new Error(`Missing ${path}`);
}

let s = fs.readFileSync(path, "utf8");

if (s.includes("v0.10.10.238.5 EMPTY LOBBY DISPOSE")) {
  console.log("[skip] v0.10.10.238.5 already applied");
  process.exit(0);
}

const assignMarker = "  private assignRoles(): void {";
if (!s.includes(assignMarker)) {
  throw new Error("Could not find assignRoles marker");
}

const helper = `  /*
   * v0.10.10.238.5 EMPTY LOBBY DISPOSE
   *
   * Active-round reconnect reservations must survive temporary browser/mobile
   * suspension. Once the room is a lobby with no REAL connected transports,
   * however, there is nobody to preserve and the room must be disposed.
   *
   * A short delay lets Colyseus settle its client collection and avoids
   * fighting an immediate join/leave handoff.
   */
  private disposeEmptyLobbySoon(): void {
    if (
      this.state.phase !== "lobby" ||
      this.liveSessionIds.size > 0
    ) {
      return;
    }

    this.syncRoomListingVisibility();

    this.clock.setTimeout(
      () => {
        if (
          this.state.phase !== "lobby" ||
          this.liveSessionIds.size > 0
        ) {
          return;
        }

        console.log(
          "[Color Hunt] disposing empty lobby",
          {
            roomId: this.roomId,
          },
        );

        void this.disconnect();
      },
      300,
    );
  }

`;

s = s.replace(assignMarker, helper + assignMarker);

const onLeaveTail = `    this.updateRoomMetadata();
  }

${helper}  private assignRoles(): void {`;

const onLeaveReplacement = `    this.updateRoomMetadata();

    /*
     * v0.10.10.238.5:
     * A real lobby leave has no reconnect reservation. If that was the last
     * connected transport, destroy the room instead of leaving a joinable
     * 0 / 10 shell behind.
     */
    this.disposeEmptyLobbySoon();
  }

${helper}  private assignRoles(): void {`;

if (!s.includes(onLeaveTail)) {
  throw new Error("Could not find onLeave tail");
}
s = s.replace(onLeaveTail, onLeaveReplacement);

const resetTail = `    this.updateRoomMetadata();
    this.broadcastPhaseChanged();
  }

  private getPaintReadyState(): {`;

const resetReplacement = `    this.updateRoomMetadata();
    this.broadcastPhaseChanged();

    /*
     * v0.10.10.238.5:
     * A round can finish while every transport is still inside an active-round
     * reconnect reservation. resetToLobby() removes those offline players;
     * now dispose the resulting empty lobby as well.
     */
    this.disposeEmptyLobbySoon();
  }

  private getPaintReadyState(): {`;

if (!s.includes(resetTail)) {
  throw new Error("Could not find resetToLobby tail");
}
s = s.replace(resetTail, resetReplacement);

fs.writeFileSync(path, s, "utf8");
console.log("[ok] v0.10.10.238.5 empty-lobby ghost-room lifecycle fix applied");
