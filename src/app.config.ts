import {
    createEndpoint,
    createRouter,
    defineRoom,
    defineServer,
    matchMaker,
    monitor,
    playground,
} from "colyseus";

import { MyRoom } from "./rooms/MyRoom.js";

/* V1010371_CORS_MATCHMAKING_RECOVERY: Vercel <-> Render CORS/OPTIONS restored for API + Colyseus matchmaking. */
/* V1010435_ROOM_STATUS_CAPACITY: /api/room-status exposes safe capacity for invite/full-room guards. */
const server = defineServer({
    rooms: {
        chameleon_hunt: defineRoom(MyRoom),
    },

    routes: createRouter({
        api_hello: createEndpoint(
            "/api/hello",
            {
                method: "GET",
            },
            async () => {
                return {
                    message:
                        "Chameleon Hunt multiplayer server is running.",
                };
            },
        ),

        api_rooms: createEndpoint(
            "/api/rooms",
            {
                method: "GET",
            },
            async () => {
                const rooms =
                    await matchMaker.query({
                        name: "chameleon_hunt",
                    });

                const publicRooms = rooms
                    .filter((room) => {
                        const metadata =
                            room.metadata as
                                | {
                                      isPrivate?: boolean;
                                      phase?: string;
                                  }
                                | undefined;

                        // Keep every public Color Hunt room visible while a match is active.
                        // Joinability is handled separately by the client.
                        return (
                            room.clients > 0 &&
                            metadata?.isPrivate !== true
                        );
                    })
                    .map((room) => ({
                        roomId: room.roomId,
                        clients: room.clients,
                        maxClients:
                            room.maxClients,
                        locked: room.locked,
                        metadata:
                            room.metadata ?? {},
                    }));

                console.log(
                    "[Chameleon Hunt] /api/rooms",
                    publicRooms,
                );

                return {
                    rooms: publicRooms,
                };
            },
        ),
    }),

    express: (app) => {
        /*
         * V1010371_CORS_MATCHMAKING_RECOVERY
         *
         * Browser client lives on Vercel while Colyseus is self-hosted on
         * Render. CORS must therefore be present BEFORE matchmaking and custom
         * routes. A missing header makes a valid server response look like
         * "Failed to fetch" in the browser.
         */
        app.use(
            (req, res, next) => {
                const origin =
                    String(
                        req.headers.origin ??
                        "",
                    );

                const allowedOrigins =
                    new Set([
                        "https://color-hunt-mu.vercel.app",
                        "http://localhost:5173",
                        "http://127.0.0.1:5173",
                    ]);

                /*
                 * Also permit Vercel preview deployments belonging to this app.
                 */
                const isAllowedVercelPreview =
                    /^https:\/\/color-hunt(?:-[a-z0-9-]+)?\.vercel\.app$/i
                        .test(
                            origin,
                        );

                if (
                    allowedOrigins.has(
                        origin,
                    ) ||
                    isAllowedVercelPreview
                ) {
                    res.setHeader(
                        "Access-Control-Allow-Origin",
                        origin,
                    );
                    res.setHeader(
                        "Vary",
                        "Origin",
                    );
                }

                res.setHeader(
                    "Access-Control-Allow-Methods",
                    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
                );
                res.setHeader(
                    "Access-Control-Allow-Headers",
                    "Content-Type, Authorization",
                );
                res.setHeader(
                    "Access-Control-Max-Age",
                    "86400",
                );

                if (
                    req.method ===
                    "OPTIONS"
                ) {
                    res.sendStatus(
                        204,
                    );
                    return;
                }

                next();
            },
        );

        /*
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
                                  playerCount?: number;
                                  maxClients?: number;
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
                        /*
                         * V1010435_ROOM_STATUS_CAPACITY
                         * Expose joinability-only capacity. No password/private
                         * room secret is returned.
                         */
                        clients:
                            room.clients,
                        playerCount:
                            Number(
                                metadata?.playerCount ??
                                room.clients,
                            ),
                        maxClients:
                            Number(
                                metadata?.maxClients ??
                                room.maxClients ??
                                10,
                            ),
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

        app.get(
            "/hi",
            (_req, res) => {
                res.send(
                    "Chameleon Hunt server is online!",
                );
            },
        );

        app.use(
            "/monitor",
            monitor(),
        );

        if (
            process.env.NODE_ENV !==
            "production"
        ) {
            app.use(
                "/",
                playground(),
            );
        }
    },
});

export default server;
