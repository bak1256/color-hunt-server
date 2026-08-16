const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src', 'rooms', 'MyRoom.ts');
let s = fs.readFileSync(file, 'utf8');

function replaceOnce(before, after, label) {
  if (s.includes(after)) { console.log('[skip]', label); return; }
  if (!s.includes(before)) throw new Error('Could not find ' + label);
  s = s.replace(before, after);
  console.log('[ok]', label);
}

if (!s.includes('private lobbyStartAllowedAt = 0;')) {
  replaceOnce(
    `  private readonly countdownDurationMs =
    3_000;`,
    `  private readonly countdownDurationMs =
    3_000;

  private lobbyStartAllowedAt = 0;`,
    'lobby settle field',
  );
}

replaceOnce(
  `  private readonly resultDurationMs =
    15_000;`,
  `  private readonly resultDurationMs =
    5_000;`,
  'result duration 5s',
);

if (!s.includes('V101071_LOBBY_SETTLE_GUARD')) {
  const marker = `      if (this.state.players.size < 2) {`;
  if (!s.includes(marker)) throw new Error('Could not find start-game settle marker');
  const guard = `      /* V101071_LOBBY_SETTLE_GUARD */
      if (Date.now() < this.lobbyStartAllowedAt) {
        client.send(
          "start_game_error",
          {
            message:
              "대기실 동기화 중입니다. 잠시 후 다시 시작해주세요.",
          },
        );
        return;
      }

`;
  s = s.replace(marker, guard + marker);
  console.log('[ok] lobby settle start guard');
}

replaceOnce(
`      if (
        aliveHidersAfterShot > 0 &&
        this.allHuntersOutOfAmmo()
      ) {
        this.broadcast(
          "hunters_out_of_ammo",
          {
            message:
              "헌터의 탄약이 모두 소진되었습니다!",
          },
        );

        this.finishGame(
          "hiders",
          "ammo_depleted",
        );
        return;
      }`,
`      if (
        aliveHidersAfterShot > 0 &&
        this.allHuntersOutOfAmmo()
      ) {
        /* v0.10.10.71: ammo depletion no longer ends Hunt early. */
        this.broadcast(
          "hunters_out_of_ammo",
          {
            message:
              "헌터의 탄약이 모두 소진되었습니다!",
          },
        );
      }`,
  'remove premature ammo-depleted victory',
);

replaceOnce(
`    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
          "hunt"
        ) {
          this.finishGame(
            "hiders",
          );
        }
      },
      this.huntDurationMs,
    );`,
`    const expectedHuntEndsAt =
      this.state.phaseEndsAt;

    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
            "hunt" &&
          this.state.phaseEndsAt ===
            expectedHuntEndsAt &&
          Date.now() >=
            expectedHuntEndsAt
        ) {
          this.finishGame(
            "hiders",
          );
        }
      },
      this.huntDurationMs,
    );`,
  'stale Hunt timeout guard',
);

replaceOnce(
`    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
          "finished"
        ) {
          this.resetToLobby();
        }
      },
      this.resultDurationMs,
    );`,
`    const expectedFinishedEndsAt =
      this.state.phaseEndsAt;

    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
            "finished" &&
          this.state.phaseEndsAt ===
            expectedFinishedEndsAt &&
          Date.now() >=
            expectedFinishedEndsAt
        ) {
          this.resetToLobby();
        }
      },
      this.resultDurationMs,
    );`,
  'stale result timeout guard',
);

if (!s.includes('return_to_lobby: (')) {
  const marker = `    /* V101069F_READY_HANDLER */`;
  if (!s.includes(marker)) throw new Error('Could not find message insertion marker');
  const add = `    return_to_lobby: (
      _client: Client,
    ): void => {
      if (this.state.phase !== "finished") {
        return;
      }

      this.resetToLobby();
    },

`;
  s = s.replace(marker, add + marker);
  console.log('[ok] immediate return-to-lobby handler');
}

if (!s.includes('V101071_LOBBY_SETTLE_RESET')) {
  const marker = `    this.state.winner = "";`;
  if (!s.includes(marker)) throw new Error('Could not find reset lobby settle marker');
  s = s.replace(
    marker,
    `${marker}
    /* V101071_LOBBY_SETTLE_RESET */
    this.lobbyStartAllowedAt = Date.now() + 1_000;`,
  );
  console.log('[ok] lobby settle reset guard');
}

fs.writeFileSync(file, s, 'utf8');
console.log('[done] v0.10.10.71 server round safety patch applied');
console.log('Next: npm run build');
