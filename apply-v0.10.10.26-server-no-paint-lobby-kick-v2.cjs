const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

const oldBlock = `      const canContinue =
        players.length >= 2 &&
        hunterCount >= 1 &&
        hiderCount >= 1;

      if (!canContinue) {
        this.broadcast(
          "round_aborted",
          {
            message:
              "嵓誤溢擽・ｴ ・ｴ夋壱｡・・護桷・・・・・﨑 ・・・・牟 ・・ｰ・､・・・護符・瀧笈・､.",
          },
        );

        this.resetToLobby();
        return;
      }
`;

const newBlock = `      /*
       * Active round에서 플레이어 한 명의 이탈/일시적인 연결 문제 때문에
       * 모든 참가자를 즉시 Lobby로 보내지 않습니다.
       *
       * 한 진영이 실제로 0명이 되면 정상적인 finished phase로 종료합니다.
       * 이렇게 해야 Paint 중 갑자기 대기방으로 튕기는 현상이 발생하지 않고,
       * 모든 클라이언트가 동일한 phase 전환을 받습니다.
       */
      if (
        hunterCount < 1 &&
        hiderCount >= 1
      ) {
        this.finishGame(
          "hiders",
        );
        return;
      }

      if (
        hiderCount < 1 &&
        hunterCount >= 1
      ) {
        this.finishGame(
          "hunters",
        );
        return;
      }

      /*
       * 방이 완전히 비어버린 경우에만 내부 상태를 Lobby로 정리합니다.
       * 이 경우 표시할 클라이언트가 없으므로 게임 UI가 튕기는 문제도 없습니다.
       */
      if (players.length === 0) {
        this.resetToLobby();
        return;
      }
`;

if (s.includes(newBlock)) {
  console.log("[skip] active-round disconnect handling already patched");
} else if (s.includes(oldBlock)) {
  s = s.replace(
    oldBlock,
    newBlock,
  );

  console.log("[ok] removed round_aborted -> immediate lobby reset");
  console.log("[ok] hunter missing -> normal Hider victory");
  console.log("[ok] hider missing -> normal Hunter victory");
  console.log("[ok] empty room only -> internal lobby reset");
} else {
  /*
   * Fallback for encoding-damaged message text:
   * replace structurally from 'const canContinue' through its closing block.
   */
  const startMarker = `      const canContinue =`;
  const endMarker = `    }

    this.updateRoomMetadata();`;

  const start = s.indexOf(startMarker);
  const end = s.indexOf(endMarker, start);

  if (start < 0 || end < 0) {
    throw new Error(
      "Could not find active-round canContinue block in current MyRoom.ts"
    );
  }

  s =
    s.slice(0, start) +
    newBlock +
    s.slice(end);

  console.log("[ok] structurally replaced active-round disconnect block");
  console.log("[ok] removed immediate Lobby kick during active round");
}

fs.writeFileSync(
  path,
  s,
  "utf8",
);

console.log("");
console.log("Done. Run npm run build.");
