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

                        return (
                            room.clients > 0 &&
                            room.private !== true &&
                            room.unlisted !== true &&
                            metadata?.isPrivate !== true &&
                            (
                                metadata?.phase === undefined ||
                                metadata.phase === "lobby"
                            )
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
