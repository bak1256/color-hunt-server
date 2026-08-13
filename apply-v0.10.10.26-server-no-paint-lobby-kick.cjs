const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

const oldBlock = `    if (roundIsActive) {
      const players =
        [...this.state.players.values()];
      const hunterCount =
        players.filter(
          (player) =>
            player.role ===
            "hunter",
        ).length;

      const hiderCount =
        players.filter(
          (player) =>
            player.role ===
            "hider",
        ).length;

      const canContinue =
        players.length >= 2 &&
        hunterCount >= 1 &&
        hiderCount >= 1;
      if (!canContinue) {
        this.broadcast(
          "round_aborted",
          {
            message:
              "플레이어 이탈로 게임을 계속할 수 없어 대기실로 돌아갑니다.",
          },
        );

        this.resetToLobby();
        return;
      }
    }
`;

const newBlock = `    if (roundIsActive) {
      const players =
        [...this.state.players.values()];

      const hunterCount =
        players.filter(
          (player) =>
            player.role ===
            "hunter",
        ).length;

      const hiderCount =
        players.filter(
          (player) =>
            player.role ===
            "hider",
        ).length;

      /*
       * Never throw the remaining player(s) straight back to Lobby during
       * Countdown/Paint/Hunt.  That abrupt reset was especially disruptive
       * when a browser briefly disappeared or a tester refreshed a tab.
       *
       * If one side is truly gone, end the round normally so clients receive
       * a consistent finished phase instead of an unexpected lobby reset.
       */
      if (hunterCount < 1) {
        this.finishGame(
          "hiders",
        );
        return;
      }

      if (hiderCount < 1) {
        this.finishGame(
          "hunters",
        );
        return;
      }
    }
`;

if (s.includes(newBlock)) {
  console.log("[skip] active-round leave handling already patched");
} else if (s.includes(oldBlock)) {
  s=s.replace(oldBlock,newBlock);
  console.log("[ok] removed direct round_aborted -> resetToLobby on active leave");
  console.log("[ok] missing side now ends through normal finished phase");
} else {
  throw new Error("Could not find current active-round onLeave block.");
}

fs.writeFileSync(path,s,"utf8");
console.log("Done. Run npm run build.");
