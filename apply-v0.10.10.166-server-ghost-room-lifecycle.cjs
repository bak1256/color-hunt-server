const fs = require("fs");
const path = require("path");

const target = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

if (!fs.existsSync(target)) {
  throw new Error(
    `MyRoom.ts not found: ${target}\n` +
    "Run this script from the Color Hunt SERVER project root."
  );
}

let src = fs.readFileSync(
  target,
  "utf8",
);

const MARKER =
  "V1010166_GHOST_ROOM_LIFECYCLE";

if (src.includes(MARKER)) {
  console.log(
    "[skip] v0.10.10.166 ghost-room lifecycle patch already applied"
  );
  process.exit(0);
}

function mustInclude(text, label) {
  if (!src.includes(text)) {
    throw new Error(
      `[fail] anchor not found: ${label}`
    );
  }
}

function replaceOnce(
  label,
  from,
  to,
) {
  mustInclude(
    from,
    label,
  );

  src = src.replace(
    from,
    to,
  );

  console.log(
    `[ok] ${label}`,
  );
}

/*
 * IMPORTANT DESIGN:
 *
 * state.players contains reconnectable players during Colyseus' 10-second
 * reconnection grace. It is therefore NOT the same thing as "people who are
 * actually connected right now".
 *
 * The public room list must use liveSessionIds instead. If every real socket
 * drops, temporarily make the room private so it instantly disappears from
 * the browser while reconnect remains possible by room token/id.
 */
replaceOnce(
  "live-session registry",
`  private roomPassword = "";
`,
`  private roomPassword = "";

  /*
   * ${MARKER}
   *
   * Authoritative set of players with a LIVE connection right now.
   * Reconnectable/drop-grace players stay in state.players, but must not make
   * the public room list look occupied.
   */
  private readonly liveSessionIds =
    new Set<string>();

  private syncRoomListingVisibility(): void {
    /*
     * Private rooms always stay private.
     *
     * Public rooms are listed only while at least one real client is live.
     * A room whose sockets all dropped remains alive for reconnection, but is
     * hidden from matchmaking so it can never appear as a "ghost room".
     */
    const hideFromPublicList =
      this.state.isPrivate ||
      this.liveSessionIds.size === 0;

    this.setPrivate(
      hideFromPublicList,
    );
  }
`
);

/*
 * Explicitly keep the framework's normal disposal guarantee enabled.
 * Colyseus defaults autoDispose=true, but writing it here documents and
 * protects the intended lifecycle against future edits.
 */
replaceOnce(
  "explicit autoDispose",
`  onCreate(
    options: JoinOptions,
  ): void {
`,
`  onCreate(
    options: JoinOptions,
  ): void {
    this.autoDispose = true;
`
);

/*
 * Creation happens before the creator is fully joined. Keep a public room
 * hidden during that tiny reservation window; onJoin() will expose it.
 */
replaceOnce(
  "initial listing visibility",
`    this.metadata = {
      roomTitle:
        this.state.roomTitle,
      isPrivate:
        this.state.isPrivate,
      playerCount: 0,
`,
`    this.metadata = {
      roomTitle:
        this.state.roomTitle,
      isPrivate:
        this.state.isPrivate,
      playerCount: 0,
`
);

/*
 * Insert immediately AFTER initial metadata assignment. Support both older
 * and newer metadata shapes by locating the end of onCreate via onAuth.
 */
{
  const onCreateAt =
    src.indexOf(
      "  onCreate("
    );
  const onAuthAt =
    src.indexOf(
      "\n  onAuth(",
      onCreateAt,
    );

  if (
    onCreateAt < 0 ||
    onAuthAt < 0
  ) {
    throw new Error(
      "[fail] could not locate onCreate/onAuth boundary"
    );
  }

  const onCreate =
    src.slice(
      onCreateAt,
      onAuthAt,
    );

  const lastClose =
    onCreate.lastIndexOf(
      "\n  }"
    );

  if (lastClose < 0) {
    throw new Error(
      "[fail] could not locate end of onCreate"
    );
  }

  const insertion =
`
    /*
     * ${MARKER}: do not publish an empty seat-reservation shell.
     */
    this.syncRoomListingVisibility();
`;

  const patched =
    onCreate.slice(
      0,
      lastClose,
    ) +
    insertion +
    onCreate.slice(
      lastClose,
    );

  src =
    src.slice(
      0,
      onCreateAt,
    ) +
    patched +
    src.slice(
      onAuthAt,
    );

  console.log(
    "[ok] initial room hidden until first live join",
  );
}

/*
 * A successful join is the exact moment the public room becomes real.
 */
replaceOnce(
  "onJoin live registry",
`    this.weaponHeatStates.set(
      client.sessionId,
`,
`    this.liveSessionIds.add(
      client.sessionId,
    );

    this.syncRoomListingVisibility();

    this.weaponHeatStates.set(
      client.sessionId,
`
);

/*
 * onDrop is temporary. Keep state.players untouched for reconnection, but
 * immediately stop counting this socket as a live occupant.
 */
replaceOnce(
  "onDrop removes live occupant immediately",
`    console.log(
      "[Chameleon Hunt] temporary drop",
      {
        sessionId:
          client.sessionId,
        code,
      },
    );

    try {
`,
`    console.log(
      "[Chameleon Hunt] temporary drop",
      {
        sessionId:
          client.sessionId,
        code,
      },
    );

    this.liveSessionIds.delete(
      client.sessionId,
    );

    /*
     * Hide immediately when the last real socket disappears.
     * The Room itself remains alive during allowReconnection().
     */
    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    try {
`
);

/*
 * A successful reconnect must republish the room and restore its live count.
 */
replaceOnce(
  "onReconnect restores listing",
`    console.log(
      "[Chameleon Hunt] reconnected",
      {
        sessionId:
          client.sessionId,
        phase:
          this.state.phase,
      },
    );

    /*
`,
`    console.log(
      "[Chameleon Hunt] reconnected",
      {
        sessionId:
          client.sessionId,
        phase:
          this.state.phase,
      },
    );

    this.liveSessionIds.add(
      client.sessionId,
    );

    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    /*
`
);

/*
 * Permanent leave is idempotent. Update listing BEFORE any of onLeave's
 * early-return round-result branches.
 */
replaceOnce(
  "onLeave removes live occupant before early returns",
`    const leavingPlayer =
      this.state.players.get(
        client.sessionId,
      );
`,
`    this.liveSessionIds.delete(
      client.sessionId,
    );

    /*
     * Do this before any early return below. Even when the last player leaves
     * during Countdown/Paint/Hunt, the public room list must become empty
     * immediately.
     */
    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    const leavingPlayer =
      this.state.players.get(
        client.sessionId,
      );
`
);

/*
 * Metadata's playerCount must mean LIVE humans, not reconnectable state.
 */
replaceOnce(
  "metadata uses live player count",
`      playerCount:
        this.state.players.size,
`,
`      playerCount:
        this.liveSessionIds.size,
`
);

/*
 * Add a disposal diagnostic. This does not alter gameplay; it gives a clear
 * server log proving that an actually empty room was destroyed.
 */
{
  const updateAt =
    src.indexOf(
      "  private updateRoomMetadata(): void {"
    );

  if (updateAt < 0) {
    throw new Error(
      "[fail] updateRoomMetadata() not found"
    );
  }

  const disposeMethod =
`  onDispose(): void {
    this.liveSessionIds.clear();

    console.log(
      "[Color Hunt] room disposed",
      {
        roomId:
          this.roomId,
      },
    );
  }

`;

  src =
    src.slice(
      0,
      updateAt,
    ) +
    disposeMethod +
    src.slice(
      updateAt,
    );

  console.log(
    "[ok] onDispose diagnostic",
  );
}

fs.writeFileSync(
  target,
  src,
  "utf8",
);

console.log("");
console.log(
  "Done. v0.10.10.166 server ghost-room lifecycle patch applied."
);
console.log(
  "Behavior: live=0 => hidden immediately; reconnect => visible again; final empty room => autoDispose."
);
console.log(
  "Next: npm run build"
);
