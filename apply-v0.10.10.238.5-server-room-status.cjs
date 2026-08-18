const fs = require("fs");

const path = "src/app.config.ts";

if (!fs.existsSync(path)) {
  throw new Error(`Missing ${path}. Run this from the color-hunt-server root.`);
}

let s = fs.readFileSync(path, "utf8");

if (s.includes('"/api/room-status"')) {
  console.log("[info] /api/room-status already exists.");
  process.exit(0);
}

if (!s.includes("matchMaker")) {
  throw new Error(
    "src/app.config.ts does not import matchMaker. Send current file."
  );
}

const marker = `        app.get(
            "/hi",`;

if (!s.includes(marker)) {
  throw new Error(
    'Could not find app.get("/hi") insertion point. Send current src/app.config.ts.'
  );
}

const route = `        /*
         * v0.10.10.238.5 INVITE PREFLIGHT
         *
         * A room may be private/unlisted, so the public room-list endpoint is
         * not enough. This endpoint reveals ONLY joinability-relevant status
         * for one exact roomId; it never exposes passwords or private data.
         */
        app.get(
            "/api/room-status",
            async (req, res) => {
                const roomId =
                    String(
                        req.query.roomId ??
                        "",
                    )
                        .trim()
                        .slice(0, 128);

                if (!roomId) {
                    res.status(400).json({
                        exists: false,
                        phase: "unknown",
                        isPrivate: false,
                    });
                    return;
                }

                try {
                    const rooms =
                        await matchMaker.query({
                            name:
                                "chameleon_hunt",
                        });

                    const room =
                        rooms.find(
                            (candidate) =>
                                candidate.roomId ===
                                roomId,
                        );

                    if (!room) {
                        res.json({
                            exists: false,
                            phase: "unknown",
                            isPrivate: false,
                        });
                        return;
                    }

                    const metadata =
                        room.metadata as
                            | {
                                  phase?: string;
                                  isPrivate?: boolean;
                              }
                            | undefined;

                    res.json({
                        exists: true,
                        phase:
                            String(
                                metadata?.phase ??
                                "lobby",
                            ),
                        isPrivate:
                            metadata?.isPrivate ===
                            true,
                    });
                } catch (error) {
                    console.error(
                        "[Color Hunt] /api/room-status failed",
                        error,
                    );

                    res.status(500).json({
                        exists: false,
                        phase: "unknown",
                        isPrivate: false,
                    });
                }
            },
        );

`;

s = s.replace(
  marker,
  route + marker,
);

fs.writeFileSync(path, s, "utf8");
console.log("[ok] v0.10.10.238.5 server room-status endpoint applied");
