const fs = require("fs");
const path = require("path");

const target = path.join(process.cwd(), "src", "rooms", "MyRoom.ts");

if (!fs.existsSync(target)) {
  throw new Error(
    `MyRoom.ts not found: ${target}\nRun this from color-hunt-server root.`
  );
}

let src = fs.readFileSync(target, "utf8");

const MARKER = "V1010167_GHOST_ROOM_LIFECYCLE_ROBUST";

if (src.includes(MARKER)) {
  console.log("[skip] v0.10.10.167 already applied");
  process.exit(0);
}

function findMethod(methodName) {
  /*
   * Supports:
   *   onLeave(...)
   *   async onLeave(...)
   *   private updateRoomMetadata(...)
   *   private async foo(...)
   */
  const re = new RegExp(
    `\\n\\s*(?:(?:public|private|protected)\\s+)?(?:async\\s+)?${methodName}\\s*\\([\\s\\S]*?\\)\\s*(?::\\s*[^\\{]+)?\\{`
  );

  const match = re.exec(src);

  if (!match) {
    return null;
  }

  const start = match.index + 1;
  const braceStart = src.indexOf("{", match.index);

  let depth = 0;
  let end = -1;

  for (let i = braceStart; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error(`[fail] could not parse method: ${methodName}`);
  }

  return {
    start,
    end,
    text: src.slice(start, end),
  };
}

function replaceMethod(methodName, transform, required = true) {
  const found = findMethod(methodName);

  if (!found) {
    if (required) {
      throw new Error(`[fail] method not found: ${methodName}`);
    }

    console.log(`[info] optional method absent: ${methodName}`);
    return;
  }

  const next = transform(found.text);

  src =
    src.slice(0, found.start) +
    next +
    src.slice(found.end);

  console.log(`[ok] ${methodName}`);
}

function insertAfterOpeningBrace(methodText, code) {
  const brace = methodText.indexOf("{");

  if (brace < 0) {
    throw new Error("[fail] opening brace not found");
  }

  return (
    methodText.slice(0, brace + 1) +
    code +
    methodText.slice(brace + 1)
  );
}

/* 1) Live socket registry */
{
  const anchor = `  private roomPassword = "";`;

  if (!src.includes(anchor)) {
    throw new Error("[fail] roomPassword anchor not found");
  }

  const insert = `  private roomPassword = "";

  /*
   * ${MARKER}
   * state.players may retain reconnectable users.
   * This set contains only clients connected RIGHT NOW.
   */
  private readonly liveSessionIds =
    new Set<string>();

  private syncRoomListingVisibility(): void {
    const shouldHide =
      this.state.isPrivate ||
      this.liveSessionIds.size === 0;

    this.setPrivate(
      shouldHide,
    );
  }`;

  src = src.replace(anchor, insert);
  console.log("[ok] live session registry");
}

/* 2) onCreate */
replaceMethod("onCreate", (method) => {
  let next = method;

  if (!next.includes("this.autoDispose = true;")) {
    next = insertAfterOpeningBrace(
      next,
      `
    this.autoDispose = true;
`
    );
  }

  const lastBrace = next.lastIndexOf("}");

  next =
    next.slice(0, lastBrace) +
    `
    /*
     * Keep empty reservation shell hidden until creator really joins.
     */
    this.syncRoomListingVisibility();
` +
    next.slice(lastBrace);

  return next;
});

/* 3) onJoin */
replaceMethod("onJoin", (method) =>
  insertAfterOpeningBrace(
    method,
    `
    this.liveSessionIds.add(
      client.sessionId,
    );

    this.syncRoomListingVisibility();
`
  )
);

/* 4) onDrop optional */
replaceMethod(
  "onDrop",
  (method) =>
    insertAfterOpeningBrace(
      method,
      `
    this.liveSessionIds.delete(
      client.sessionId,
    );

    this.updateRoomMetadata();
    this.syncRoomListingVisibility();
`
    ),
  false
);

/* 5) onReconnect optional */
replaceMethod(
  "onReconnect",
  (method) =>
    insertAfterOpeningBrace(
      method,
      `
    this.liveSessionIds.add(
      client.sessionId,
    );

    this.updateRoomMetadata();
    this.syncRoomListingVisibility();
`
    ),
  false
);

/* 6) onLeave */
replaceMethod("onLeave", (method) =>
  insertAfterOpeningBrace(
    method,
    `
    this.liveSessionIds.delete(
      client.sessionId,
    );

    /*
     * Hide/update before any round-specific early return.
     */
    this.updateRoomMetadata();
    this.syncRoomListingVisibility();
`
  )
);

/* 7) updateRoomMetadata playerCount */
{
  const found = findMethod("updateRoomMetadata");

  if (!found) {
    throw new Error("[fail] updateRoomMetadata not found");
  }

  let next = found.text;
  let changed = false;

  const replacements = [
    [
      /playerCount\s*:\s*this\.state\.players\.size/g,
      `playerCount:
        this.liveSessionIds.size`,
    ],
    [
      /playerCount\s*:\s*this\.clients\.length/g,
      `playerCount:
        this.liveSessionIds.size`,
    ],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(next)) {
      pattern.lastIndex = 0;
      next = next.replace(pattern, replacement);
      changed = true;
    }
  }

  if (!changed) {
    console.warn(
      "[warn] playerCount expression was not recognized; listing visibility fix still applies"
    );
  }

  src =
    src.slice(0, found.start) +
    next +
    src.slice(found.end);

  console.log("[ok] updateRoomMetadata");
}

/* 8) onDispose diagnostic */
if (!findMethod("onDispose")) {
  const update = findMethod("updateRoomMetadata");

  if (!update) {
    throw new Error("[fail] cannot place onDispose");
  }

  const dispose = `  onDispose(): void {
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
    src.slice(0, update.start) +
    dispose +
    src.slice(update.start);

  console.log("[ok] onDispose diagnostic");
} else {
  console.log("[info] existing onDispose preserved");
}

fs.writeFileSync(target, src, "utf8");

console.log("");
console.log(
  "Done. v0.10.10.167 robust ghost-room lifecycle patch applied."
);
console.log("Next: npm run build");
