const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

let s = fs.readFileSync(
  file,
  "utf8",
);

if (
  s.includes(
    "V101094_RESTORE_LOCAL_PAINT_FINAL",
  )
) {
  console.log(
    "[skip] v0.10.10.94 already applied",
  );
  process.exit(0);
}

const marker =
  "/* V101093_RESTORE_LOCAL_PAINT */";

const at =
  s.indexOf(marker);

if (at < 0) {
  throw new Error(
    "Expected v0.10.10.93 restore_local_paint handler",
  );
}

const windowEnd =
  Math.min(
    s.length,
    at + 12000,
  );

let block =
  s.slice(
    at,
    windowEnd,
  );

/*
 * Hunter alive is not a meaningful gate for restoring cosmetics.
 * Some reconnect paths can transiently carry alive=false/default while role
 * and gameplay are already valid. Only role=hunter is required.
 */
const oldGuard = `      if (
        !player ||
        player.role !== "hunter" ||
        !player.alive
      ) {
        return;
      }`;

const newGuard = `      /* V101094_RESTORE_LOCAL_PAINT_FINAL */
      if (
        !player ||
        player.role !== "hunter"
      ) {
        return;
      }`;

if (block.includes(oldGuard)) {
  block =
    block.replace(
      oldGuard,
      newGuard,
      1,
    );

  console.log(
    "[ok] removed alive gate from Hunter cosmetic restore",
  );
} else if (
  !block.includes(
    "V101094_RESTORE_LOCAL_PAINT_FINAL",
  )
) {
  throw new Error(
    "Could not find .93 restore_local_paint player guard",
  );
}

/*
 * The existing handler already normalizes sender/target to client.sessionId
 * and sends paint_stroke to every other client. Make the first replay later
 * so opponent Schema/render objects are certainly present, and add one small
 * second pass without touching reconnect state.
 */
block =
  block.replace(
    `      this.clock.setTimeout(
        sendBatch,
        350,
      );`,
    `      this.clock.setTimeout(
        sendBatch,
        750,
      );

      /*
       * One bounded second pass for slow opponent actor creation.
       * Only this Hunter's restored paint is replayed.
       */
      this.clock.setTimeout(
        () => {
          if (
            !this.state.players.has(
              client.sessionId,
            )
          ) {
            return;
          }

          normalized.forEach(
            (stroke: any) => {
              this.clients.forEach(
                (otherClient) => {
                  if (
                    otherClient.sessionId ===
                      client.sessionId
                  ) {
                    return;
                  }

                  otherClient.send(
                    "paint_stroke",
                    stroke,
                  );
                },
              );
            },
          );
        },
        2200,
      );`,
    1,
  );

s =
  s.slice(0, at) +
  block +
  s.slice(windowEnd);

if (
  !s.includes(
    "V101094_RESTORE_LOCAL_PAINT_FINAL",
  )
) {
  throw new Error(
    "Verification failed: .94 restore_local_paint final patch",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log(
  "[ok] local Hunter paint restore accepts stable reconnect state",
);
console.log(
  "[ok] normalized current-session paint is replayed to opponents",
);
console.log(
  "[ok] reconnect lifecycle was not modified",
);
console.log(
  "[done] v0.10.10.94 opponent Hunter paint final patch applied",
);
console.log(
  "Next: npm run build",
);
