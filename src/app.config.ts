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
