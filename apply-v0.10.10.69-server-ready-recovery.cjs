const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

function methodRange(name) {
  const patterns = [
    `private ${name}`,
    `  ${name}(`,
    `  async ${name}(`,
  ];

  let start = -1;

  for (const pattern of patterns) {
    start = s.indexOf(pattern);
    if (start >= 0) break;
  }

  if (start < 0) {
    throw new Error(
      `Could not find ${name}()`
    );
  }

  const brace = s.indexOf("{", start);
  let depth = 0;

  for (
    let i = brace;
    i < s.length;
    i += 1
  ) {
    if (s[i] === "{") depth += 1;

    if (s[i] === "}") {
      depth -= 1;

      if (depth === 0) {
        return {
          start,
          end: i + 1,
        };
      }
    }
  }

  throw new Error(
    `Could not parse ${name}()`
  );
}

/*
 * v0.10.10.69
 * READY state must be recoverable. A client joining/returning from a mobile
 * background state may miss the one initial broadcast, so allow it to ask
 * for the current authoritative READY state at any time during Paint.
 */
if (
  !s.includes(
    "request_paint_ready_state: ("
  )
) {
  const marker =
    "  messages = {\n";

  if (!s.includes(marker)) {
    throw new Error(
      "Could not find messages object."
    );
  }

  const handler = `  messages = {
    request_paint_ready_state: (
      _client: Client,
    ): void => {
      if (
        this.state.phase !==
        "paint"
      ) {
        return;
      }

      this.broadcastPaintReadyState();
    },

`;

  s =
    s.replace(
      marker,
      handler,
    );

  console.log(
    "[ok] recoverable READY-state request"
  );
} else {
  console.log(
    "[skip] READY-state request already exists"
  );
}

/*
 * Re-broadcast READY shortly after Paint starts.
 * The first broadcast can race role/schema delivery on slower mobile clients.
 */
{
  const r =
    methodRange(
      "startPaintPhase"
    );

  let method =
    s.slice(
      r.start,
      r.end,
    );

  const tag =
    "V101069_READY_REBROADCAST";

  if (!method.includes(tag)) {
    const candidates = [
      "    this.broadcastPaintReadyState();",
      "    this.broadcastPhaseChanged();",
      "    this.updateRoomMetadata();",
    ];

    let at = -1;
    let target = "";

    for (
      const candidate of
      candidates
    ) {
      at =
        method.lastIndexOf(
          candidate,
        );

      if (at >= 0) {
        target = candidate;
        break;
      }
    }

    if (at < 0) {
      throw new Error(
        "Could not find Paint broadcast insertion point."
      );
    }

    const end =
      at + target.length;

    const pulse = `
    /* ${tag} */
    [80, 260, 700].forEach(
      (delay) => {
        this.clock.setTimeout(
          () => {
            if (
              this.state.phase ===
              "paint"
            ) {
              this.broadcastPaintReadyState();
            }
          },
          delay,
        );
      },
    );`;

    method =
      method.slice(0, end) +
      pulse +
      method.slice(end);

    s =
      s.slice(0, r.start) +
      method +
      s.slice(r.end);

    console.log(
      "[ok] READY state rebroadcast after Paint start"
    );
  } else {
    console.log(
      "[skip] READY Paint rebroadcast already exists"
    );
  }
}

/*
 * Ensure READY broadcaster cannot preserve stale/disconnected ids and counts
 * only active Hiders from the authoritative players map.
 */
{
  const r =
    methodRange(
      "broadcastPaintReadyState"
    );

  let method =
    s.slice(
      r.start,
      r.end,
    );

  if (
    !method.includes(
      "V101069_READY_AUTHORITATIVE"
    )
  ) {
    const brace =
      method.indexOf("{");

    const guard = `
    /* V101069_READY_AUTHORITATIVE */
    const activePlayerIds =
      new Set(
        [...this.state.players.keys()],
      );

    for (
      const sessionId of
      [...this.paintReadySessionIds]
    ) {
      if (
        !activePlayerIds.has(
          sessionId,
        )
      ) {
        this.paintReadySessionIds
          .delete(
            sessionId,
          );
      }
    }

`;

    method =
      method.slice(
        0,
        brace + 1,
      ) +
      guard +
      method.slice(
        brace + 1,
      );

    s =
      s.slice(0, r.start) +
      method +
      s.slice(r.end);

    console.log(
      "[ok] authoritative READY cleanup"
    );
  } else {
    console.log(
      "[skip] authoritative READY cleanup already exists"
    );
  }
}

fs.writeFileSync(
  path,
  s,
  "utf8",
);

console.log("");
console.log(
  "Done. v0.10.10.69 READY/mobile recovery server patch applied."
);
console.log(
  "Next: npm run build"
);
