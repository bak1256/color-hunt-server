import {
  Client,
  CloseCode,
  Room,
} from "colyseus";

import {
  MyRoomState,
  PlayerState,
} from "./schema/MyRoomState.js";

type JoinOptions = {
  name?: string;
  clientKey?: string;
  reconnectFallback?: boolean;
  roomTitle?: string;
  isPrivate?: boolean;
  password?: string;
};

type MoveMessage = {
  x?: number;
  y?: number;
};

type HunterVolunteerMessage = {
  volunteer?: boolean;
};

type SelectMapMessage = {
  map?: string;
};

type SelectPaintDurationMessage = {
  durationMs?: number;
};

type FireShotMessage = {
  angle?: number;
};

type HunterAimMessage = {
  angle?: number;
};

type BrushShape =
  | "dotCircle"
  | "circle"
  | "square";

type PaintPoint = {
  x: number;
  y: number;
};

type PaintStrokeMessage = {
  targetSessionId?: string;
  color?: number;
  size?: number;
  shape?: BrushShape;
  points?: PaintPoint[];
};

type Point = {
  x: number;
  y: number;
};

type WeaponHeatState = {
  heat: number;
  updatedAt: number;
  overheatedUntil: number;
};

type HunterRoundStats = {
  reserve: number;
  precisionPoints: number;
  shotsFired: number;
};

type RoundEndReason =
  | "all_hiders_found"
  | "timeout"
  | "ammo_depleted";

export class MyRoom extends Room {
  maxClients = 10;
  state = new MyRoomState();

  private roomPassword = "";

  /*
   * V1010167_GHOST_ROOM_LIFECYCLE_ROBUST
   * state.players may retain reconnectable users.
   * This set contains only clients connected RIGHT NOW.
   */
  private readonly liveSessionIds =
    new Set<string>();

  /*
   * v0.10.10.230 CONNECTION OWNERSHIP:
   * A fresh clientKey handoff permanently supersedes the old transport
   * session. If that old browser socket wakes later, it must never become
   * authoritative again.
   */
  private readonly supersededSessionIds =
    new Set<string>();

  private syncRoomListingVisibility(): void {
    /*
     * v0.10.10.238.4:
     * Room-list authority is based on REAL connected transports, never on
     * reconnect-preserved state.players. A room with 0 live clients must
     * always disappear from the public lobby immediately.
     */
    const liveCount =
      this.liveSessionIds.size;

    const shouldHide =
      this.state.isPrivate ||
      liveCount === 0;

    this.setPrivate(
      shouldHide,
    );

    /*
     * Keep metadata in agreement with listing visibility so the HTTP room
     * list can never advertise stale "0 / 10" public entries.
     */
    if (
      liveCount === 0
    ) {
      this.setMetadata({
        ...(this.metadata ?? {}),
        playerCount: 0,
        clients: 0,
      });
    }
  }

  private readonly clientKeyBySessionId =
    new Map<string, string>();

  private readonly rejoinStateByClientKey =
    new Map<
      string,
      {
        role: "hunter" | "hider";
        alive: boolean;
        hunterVolunteer: boolean;
        x: number;
        y: number;
        expiresAt: number;
      }
    >();

  private noHunterGraceGeneration = 0;

  /*
   * v0.10.10.238 DISCONNECT OUTCOME GRACE
   *
   * Session preservation (5 min) and round outcome are separate concerns.
   * A browser may return much later and still recover identity, but a live
   * round must not wait forever when an entire role is gone.
   */
  private hunterDisconnectOutcomeGeneration = 0;
  private allHiderDisconnectOutcomeGeneration = 0;
  private readonly hiderDisconnectGenerationBySessionId =
    new Map<string, number>();

  private readonly disconnectSilentGraceMs =
    10_000;
  private readonly disconnectVisibleCountdownSeconds =
    5;

  private readonly countdownDurationMs =
    3_000;

  private lobbyStartAllowedAt = 0;

  private paintDurationMs =
    120_000;

  private huntDurationMs = 80_000;

  /*
   * v0.10.10.236 RANDOM MAP ANTI-REPEAT:
   * activeMap returns to "forest" in the lobby while RANDOM is selected, so
   * remember the previous actual random round separately.
   */
  private lastRandomActiveMap = "";

  private readonly resultDurationMs =
    5_000;

  private readonly shotCooldownMs =
    450;

  private readonly pelletCount = 7;
  private readonly pelletRange = 122;
  private readonly pelletSpread =
    18 * Math.PI / 180;

  private readonly lastShotAt =
    new Map<string, number>();

  private readonly weaponHeatStates =
    new Map<string, WeaponHeatState>();

  private readonly hunterRoundStats =
    new Map<string, HunterRoundStats>();

  private readonly paintReadySessionIds =
    new Set<string>();

  private lastPaintReadyPulseAt = 0;

  private readonly maxHunterReserve = 12;


  private readonly heatPerShot = 34;
  private readonly heatCooldownPerMs = 0.025;
  private readonly overheatDurationMs = 2_500;

  private broadcastPhaseChanged(): void {
    this.broadcast(
      "phase_changed",
      {
        phase: this.state.phase,
        phaseEndsAt:
          this.state.phaseEndsAt,
        serverNow: Date.now(),
      },
    );
  }

  private sendLobbySnapshot(
    client: Client,
  ): void {
    this.ensureValidHost();

    client.send(
      "lobby_snapshot",
      {
        hostId:
          this.state.hostId,
        selectedMap:
          this.state.selectedMap,
        activeMap:
          this.state.activeMap,
        paintDurationMs:
          this.paintDurationMs,
        huntDurationMs: this.huntDurationMs,
        /* V101072_PHASE_RECOVERY_SNAPSHOT */
        phase:
          this.state.phase,
        phaseEndsAt:
          this.state.phaseEndsAt,
        serverNow:
          Date.now(),
        paintReadyState:
          this.getPaintReadyState(),
        players:
          [
            ...this.state.players
              .entries(),
          ].map(
            (
              [
                sessionId,
                player,
              ],
            ) => ({
              sessionId,
              name:
                player.name,
              role:
                player.role,
              hunterVolunteer:
                player.hunterVolunteer,
              x:
                player.x,
              y:
                player.y,
              alive:
                player.alive,
            }),
          ),
      },
    );
  }

  private readonly lobbyAvatarPresets =
    new Map<string, any[]>();

  private readonly roundPaintStrokes =
    new Map<string, any[]>();

  messages = {
    select_hunt_duration: (
      client: Client,
      message: {
        durationMs?: number;
      },
    ): void => {
      if (
        this.state.phase !== "lobby" ||
        client.sessionId !== this.state.hostId
      ) {
        return;
      }

      const durationMs =
        Number(
          message?.durationMs,
        );

      if (
        ![
          80_000,
          100_000,
          120_000,
        ].includes(durationMs)
      ) {
        return;
      }

      this.huntDurationMs =
        durationMs;

      this.clients.forEach(
        (remainingClient) => {
          this.sendLobbySnapshot(
            remainingClient,
          );
        },
      );
    },

    avatar_preset: (
      client: Client,
      message: any,
    ): void => {
      if (
        this.state.phase !==
        "lobby"
      ) {
        return;
      }

      const rawStrokes =
        Array.isArray(
          message?.strokes,
        )
          ? message.strokes
          : [];

      const strokes =
        rawStrokes
          .slice(0, 80)
          .map((stroke: any) => {
            const color =
              Math.max(
                0,
                Math.min(
                  0xffffff,
                  Math.round(
                    Number(
                      stroke?.color ??
                      0,
                    ),
                  ),
                ),
              );

            const size =
              Math.max(
                1,
                Math.min(
                  12,
                  Math.round(
                    Number(
                      stroke?.size ??
                      1,
                    ),
                  ),
                ),
              );

            const shape =
              stroke?.shape ===
                "square"
                ? "square"
                : "circle";

            const points =
              (
                Array.isArray(
                  stroke?.points,
                )
                  ? stroke.points
                  : []
              )
                .slice(0, 240)
                .map(
                  (point: any) => ({
                    x:
                      Math.max(
                        0,
                        Math.min(
                          80,
                          Math.round(
                            Number(
                              point?.x ??
                              40,
                            ),
                          ),
                        ),
                      ),
                    y:
                      Math.max(
                        0,
                        Math.min(
                          120,
                          Math.round(
                            Number(
                              point?.y ??
                              60,
                            ),
                          ),
                        ),
                      ),
                  }),
                );

            return {
              targetSessionId:
                client.sessionId,
              color,
              size,
              shape,
              points,
            };
          })
          .filter(
            (stroke: any) =>
              stroke.points.length >
              0,
          );

      this.lobbyAvatarPresets
        .set(
          client.sessionId,
          strokes,
        );

      this.broadcast(
        "avatar_preset",
        {
          sessionId:
            client.sessionId,
          strokes,
        },
      );
    },

    request_avatar_presets: (
      client: Client,
    ): void => {
      client.send(
        "avatar_presets",
        {
          presets:
            [
              ...this
                .lobbyAvatarPresets
                .entries(),
            ].map(
              (
                [
                  sessionId,
                  strokes,
                ],
              ) => ({
                sessionId,
                strokes,
              }),
            ),
        },
      );
    },

    /* V101093_RESTORE_LOCAL_PAINT */
    restore_local_paint: (
      client: Client,
      payload: {
        strokes?: any[];
      },
    ): void => {
      if (
        this.state.phase !== "paint" &&
        this.state.phase !== "hunt" &&
        this.state.phase !== "countdown"
      ) {
        return;
      }

      const player =
        this.state.players.get(
          client.sessionId,
        );

      /* V101094_RESTORE_LOCAL_PAINT_FINAL */
      if (
        !player ||
        player.role !== "hunter"
      ) {
        return;
      }

      const raw =
        Array.isArray(
          payload?.strokes,
        )
          ? payload.strokes
              .slice(0, 240)
          : [];

      if (raw.length < 1) {
        return;
      }

      const normalized =
        raw
          .map(
            (stroke: any) => {
              const color =
                Number(
                  stroke?.color,
                );

              const size =
                Math.max(
                  1,
                  Math.min(
                    20,
                    Number(
                      stroke?.size,
                    ) || 1,
                  ),
                );

              const shape =
                stroke?.shape ===
                  "square" ||
                stroke?.shape ===
                  "dotCircle"
                  ? stroke.shape
                  : "circle";

              const points =
                Array.isArray(
                  stroke?.points,
                )
                  ? stroke.points
                      .slice(
                        0,
                        1000,
                      )
                      .map(
                        (point: any) => ({
                          x:
                            Number(
                              point?.x,
                            ),
                          y:
                            Number(
                              point?.y,
                            ),
                        }),
                      )
                      .filter(
                        (point: any) =>
                          Number.isFinite(
                            point.x,
                          ) &&
                          Number.isFinite(
                            point.y,
                          ),
                      )
                  : [];

              if (
                !Number.isFinite(
                  color,
                ) ||
                points.length < 1
              ) {
                return null;
              }

              return {
                senderId:
                  client.sessionId,
                targetSessionId:
                  client.sessionId,
                color,
                size,
                shape,
                points,
              };
            },
          )
          .filter(
            Boolean,
          ) as any[];

      if (
        normalized.length <
        1
      ) {
        return;
      }

      /*
       * Replace this Hunter's authoritative round history with the exact
       * post-reconnect source supplied by the same living Hunter.
       */
      this.roundPaintStrokes.set(
        client.sessionId,
        normalized,
      );

      /*
       * Opponents already understand paint_stroke perfectly.
       * Send only this Hunter's paint, in small batches.
       * Do NOT send it back to the reconnecting client: that screen is
       * already correct and doesn't need duplicate drawing work.
       */
      let cursor = 0;

      const sendBatch =
        (): void => {
          if (
            !this.state.players.has(
              client.sessionId,
            )
          ) {
            return;
          }

          const end =
            Math.min(
              normalized.length,
              cursor + 5,
            );

          for (
            ;
            cursor < end;
            cursor += 1
          ) {
            const stroke =
              normalized[cursor];

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
          }

          if (
            cursor <
            normalized.length
          ) {
            this.clock.setTimeout(
              sendBatch,
              70,
            );
          }
        };

      /*
       * Give opponent Schema/render objects a brief moment to settle.
       */
      this.clock.setTimeout(
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
      );
    },

    request_round_paint_state: (
      client: Client,
    ): void => {
      const active =
        this.state.phase === "paint" ||
        this.state.phase === "hunt" ||
        this.state.phase === "countdown";

      client.send(
        "round_paint_state",
        {
          strokes:
            active
              ? [...this.roundPaintStrokes.values()]
                  .flat()
              : [],
        },
      );
    },

    chat_send: (
      client: Client,
      payload: {
        text?: unknown;
      },
    ): void => {
      const player =
        this.state.players.get(
          client.sessionId,
        );

      if (!player) {
        return;
      }

      const now =
        Date.now();

      const text =
        this.normalizeChatText(
          payload?.text,
        );

      if (!text) {
        return;
      }

      const timestamps =
        (
          this.chatRateHistory.get(
            client.sessionId,
          ) ?? []
        )
          .filter(
            (value) =>
              now - value <
              10_000,
          );

      /*
       * Spam protection:
       * - no faster than ~0.8 seconds
       * - max 6 messages / 10 seconds
       * - exact same normalized message cannot repeat within 8 seconds
       */
      const latest =
        timestamps[
          timestamps.length - 1
        ] ?? 0;

      const comparable =
        text
          .toLowerCase()
          .replace(
            /\s+/g,
            "",
          );

      const previous =
        this.chatLastNormalized.get(
          client.sessionId,
        );

      if (
        now - latest <
          800 ||
        timestamps.length >=
          6 ||
        (
          previous &&
          previous.text ===
            comparable &&
          now -
            previous.sentAt <
            8_000
        )
      ) {
        client.send(
          "chat_error",
          {
            message:
              "spam",
          },
        );
        return;
      }

      timestamps.push(
        now,
      );

      this.chatRateHistory.set(
        client.sessionId,
        timestamps,
      );

      this.chatLastNormalized.set(
        client.sessionId,
        {
          text:
            comparable,
          sentAt:
            now,
        },
      );

      const censored =
        this.censorChatText(
          text,
        );

      const message = {
        id:
          `${now}-${++this.chatSequence}`,
        sessionId:
          client.sessionId,
        name:
          String(
            player.name ??
            "Player",
          ).slice(
            0,
            32,
          ),
        text:
          censored,
        sentAt:
          now,
      };

      this.chatHistory.push(
        message,
      );

      if (
        this.chatHistory.length >
        40
      ) {
        this.chatHistory.splice(
          0,
          this.chatHistory.length -
            40,
        );
      }

      this.broadcast(
        "chat_message",
        message,
      );
    },

    request_chat_history: (
      client: Client,
    ): void => {
      this.sendChatHistory(
        client,
      );
    },

    request_lobby_snapshot: (
      client: Client,
    ): void => {
      this.sendLobbySnapshot(
        client,
      );
    },

    move: (
      client: Client,
      message: MoveMessage,
    ): void => {
      const player =
        this.state.players.get(
          client.sessionId,
        );

      if (
        !player ||
        !player.alive
      ) {
        return;
      }

      const x = Number(message.x);
      const y = Number(message.y);

      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        return;
      }

      player.x = Math.max(
        0,
        Math.min(960, x),
      );

      player.y = Math.max(
        0,
        Math.min(540, y),
      );
    },

    hunter_volunteer: (
      client: Client,
      message: HunterVolunteerMessage,
    ): void => {
      if (
        this.state.phase !== "lobby"
      ) {
        return;
      }

      const player =
        this.state.players.get(
          client.sessionId,
        );

      if (!player) {
        return;
      }

      player.hunterVolunteer =
        Boolean(message.volunteer);
    },

    select_map: (
      client: Client,
      message: SelectMapMessage,
    ): void => {
      this.ensureValidHost();

      if (
        client.sessionId !==
          this.state.hostId ||
        this.state.phase !== "lobby"
      ) {
        return;
      }

      const requested =
        String(
          message.map ?? "",
        );

      const valid =
        requested === "random" ||
        /^map(?:[1-9]|1[01])$/.test(
          requested,
        );

      if (!valid) {
        return;
      }

      this.state.selectedMap =
        requested;

      /*
       * RANDOM 선택 중에는 대기방을 기본 forest 배경으로 유지합니다.
       * 실제 랜덤 맵은 START GAME을 누르는 순간 확정합니다.
       */
      this.state.activeMap =
        requested === "random"
          ? "forest"
          : requested;

      this.updateRoomMetadata();

      this.clients.forEach(
        (connectedClient) => {
          this.sendLobbySnapshot(
            connectedClient,
          );
        },
      );
    },

    select_paint_duration: (
      client: Client,
      message:
        SelectPaintDurationMessage,
    ): void => {
      this.ensureValidHost();

      if (
        client.sessionId !==
          this.state.hostId ||
        this.state.phase !== "lobby"
      ) {
        return;
      }

      const durationMs =
        Number(
          message.durationMs,
        );

      if (
        ![
          90_000,
          120_000,
          150_000,
        ].includes(durationMs)
      ) {
        return;
      }

      this.paintDurationMs =
        durationMs;

      this.clients.forEach(
        (connectedClient) => {
          this.sendLobbySnapshot(
            connectedClient,
          );
        },
      );
    },

    start_game: (
      client: Client,
    ): void => {
      /*
       * START GAME 판정 직전에도 hostId를 self-heal합니다.
       * hostId가 순간적으로 비어 있는 유령방 상태 때문에
       * 영원히 게임을 시작하지 못하는 상황을 방지합니다.
       */
      this.ensureValidHost();

      if (
        client.sessionId !==
          this.state.hostId ||
        this.state.phase !== "lobby"
      ) {
        return;
      }

      /* V101071_LOBBY_SETTLE_GUARD */
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

      if (this.state.players.size < 2) {
        client.send(
          "start_game_error",
          {
            message:
              "게임 시작에는 최소 2명이 필요합니다.",
          },
        );

        return;
      }

      /*
       * 모든 클라이언트가 반드시 동일한 맵을 사용하도록
       * RANDOM 판정은 서버에서 딱 한 번 수행합니다.
       */
      if (
        this.state.selectedMap ===
          "random"
      ) {
        /*
         * Pick from all 11 maps except the map used by the immediately
         * previous RANDOM round. This guarantees RANDOM never gives the same
         * map twice in a row while keeping every other map equally likely.
         */
        const randomCandidates =
          Array.from(
            {
              length: 11,
            },
            (
              _,
              index,
            ) => `map${index + 1}`,
          ).filter(
            (mapName) =>
              mapName !==
              this.lastRandomActiveMap,
          );

        const selectedRandomMap =
          randomCandidates[
            Math.floor(
              Math.random() *
                randomCandidates.length,
            )
          ] ?? "map1";

        this.state.activeMap =
          selectedRandomMap;

        this.lastRandomActiveMap =
          selectedRandomMap;
      } else {
        this.state.activeMap =
          this.state.selectedMap;
      }

      this.assignRoles();

      if (
        this.getAliveHiderCount() < 1
      ) {
        client.send(
          "start_game_error",
          {
            message:
              "Hider가 최소 1명 필요합니다.",
          },
        );
        return;
      }

      this.startCountdownPhase();
    },

    hunter_aim: (
      client: Client,
      message: HunterAimMessage,
    ): void => {
      if (
        this.state.phase !== "hunt"
      ) {
        return;
      }

      const hunter =
        this.state.players.get(
          client.sessionId,
        );

      const angle =
        Number(message.angle);

      if (
        !hunter ||
        hunter.role !== "hunter" ||
        !hunter.alive ||
        !Number.isFinite(angle)
      ) {
        return;
      }

      this.broadcast(
        "hunter_aim",
        {
          sessionId:
            client.sessionId,
          angle,
          range:
            this.pelletRange,
        },
      );
    },

    fire_shot: (
      client: Client,
      message: FireShotMessage,
    ): void => {
      /*
       * Hunt 종료시각이 지난 뒤 도착한 총알은 절대 판정하지 않습니다.
       * phase 전환 timer가 event-loop 지연으로 아직 실행되지 않았더라도
       * phaseEndsAt이 authoritative deadline입니다.
       */
      if (
        this.state.phase === "hunt" &&
        this.state.phaseEndsAt > 0 &&
        Date.now() >=
          this.state.phaseEndsAt
      ) {
        this.finishGame(
          "hiders",
        );
        return;
      }

      if (
        this.state.phase !== "hunt"
      ) {
        return;
      }

      const hunter =
        this.state.players.get(
          client.sessionId,
        );

      if (
        !hunter ||
        hunter.role !== "hunter" ||
        !hunter.alive
      ) {
        return;
      }

      const angle = Number(
        message.angle,
      );

      if (!Number.isFinite(angle)) {
        return;
      }

      const now = Date.now();
      const previousShot =
        this.lastShotAt.get(
          client.sessionId,
        ) ?? 0;

      if (
        now - previousShot <
        this.shotCooldownMs
      ) {
        return;
      }

      const heatState =
        this.getUpdatedWeaponHeatState(
          client.sessionId,
          now,
        );

      const hunterStats =
        this.getHunterRoundStats(
          client.sessionId,
        );

      if (
        hunterStats.reserve <= 0
      ) {
        this.sendWeaponState(
          client,
          heatState,
          hunterStats,
        );
        return;
      }

      if (
        now <
        heatState.overheatedUntil
      ) {
        this.sendWeaponState(
          client,
          heatState,
          hunterStats,
        );
        return;
      }

      hunterStats.reserve -= 1;
      hunterStats.shotsFired += 1;

      heatState.heat = Math.min(
        100,
        heatState.heat +
          this.heatPerShot,
      );

      if (heatState.heat >= 100) {
        heatState.overheatedUntil =
          now +
          this.overheatDurationMs;
      }

      heatState.updatedAt = now;

      this.weaponHeatStates.set(
        client.sessionId,
        heatState,
      );

      this.sendWeaponState(
        client,
        heatState,
        hunterStats,
      );

      this.lastShotAt.set(
        client.sessionId,
        now,
      );

      const startX =
        hunter.x +
        Math.cos(angle) * 28;

      const startY =
        hunter.y +
        Math.sin(angle) * 28;

      const pellets: Array<{
        endX: number;
        endY: number;
      }> = [];

      const hitIds =
        new Set<string>();

      for (
        let index = 0;
        index < this.pelletCount;
        index += 1
      ) {
        const ratio =
          this.pelletCount <= 1
            ? 0.5
            : index /
              (this.pelletCount - 1);

        const spreadOffset =
          -this.pelletSpread / 2 +
          this.pelletSpread * ratio;

        const pelletAngle =
          angle + spreadOffset;

        const endX =
          startX +
          Math.cos(pelletAngle) *
            this.pelletRange;

        const endY =
          startY +
          Math.sin(pelletAngle) *
            this.pelletRange;

        pellets.push({
          endX,
          endY,
        });

        for (
          const [
            sessionId,
            target,
          ] of this.state.players
        ) {
          if (
            target.role !== "hider" ||
            !target.alive ||
            hitIds.has(sessionId)
          ) {
            continue;
          }

          const hit =
            this.distancePointToSegment(
              target.x,
              target.y,
              startX,
              startY,
              endX,
              endY,
            ) <= 18;

          if (hit) {
            hitIds.add(sessionId);
          }
        }
      }

      /*
       * shot 계산 중에 deadline을 넘어간 경우에도 Hider 승리가 우선입니다.
       */
      if (
        this.state.phaseEndsAt > 0 &&
        Date.now() >=
          this.state.phaseEndsAt
      ) {
        this.finishGame(
          "hiders",
        );
        return;
      }

      const aliveHidersBeforeShot =
        this.getAliveHiderCount();

      for (const hitId of hitIds) {
        const target =
          this.state.players.get(
            hitId,
          );

        if (
          target &&
          target.role === "hider" &&
          target.alive
        ) {
          target.alive = false;
        }
      }

      const aliveHidersAfterShot =
        this.getAliveHiderCount();

      /*
       * 적은 탄약으로 찾을수록 보너스가 큽니다.
       * 한 발로 여러 Hider를 맞히면 각각 보너스를 받습니다.
       */
      const precisionReward =
        hitIds.size > 0
          ? hitIds.size *
            (
              100 +
              hunterStats.reserve *
                25
            )
          : 0;

      hunterStats.precisionPoints +=
        precisionReward;

      this.sendWeaponState(
        client,
        heatState,
        hunterStats,
      );

      this.broadcast(
        "shot_fired",
        {
          shooterId:
            client.sessionId,
          startX,
          startY,
          pellets,
          hitIds:
            [...hitIds],
          precisionReward,
          reserve:
            hunterStats.reserve,
          precisionPoints:
            hunterStats.precisionPoints,
        },
      );

      if (
        hitIds.size > 0 &&
        aliveHidersBeforeShot > 0 &&
        aliveHidersAfterShot === 0
      ) {
        /*
         * 마지막 총알로 마지막 Hider를 잡았다면 Hunter 승리가 우선입니다.
         */
        this.finishGame(
          "hunters",
        );
        return;
      }

      /*
       * 살아 있는 Hider가 남아 있고,
       * 모든 살아 있는 Hunter의 reserve 합계가 0이면 즉시 Hunter 패배.
       * 마지막 발의 pellet 판정을 모두 끝낸 뒤 실행하므로
       * 마지막 탄 역전승도 정상 처리됩니다.
       */
      if (
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
      
        /*
         * V1010182_MULTIPLAYER_AMMO_DEPLETION_FINISH
         *
         * Multiplayer rule: if at least one Hider survives after the shot and
         * every living Hunter has 0 reserve, the round is over immediately.
         * finishGame() owns phase=finished, round_result, phase_changed and
         * the normal timed resetToLobby() path.
         */
        this.finishGame(
          "hiders",
          "ammo_depleted",
        );
        return;
}
    },

    return_to_lobby: (
      _client: Client,
    ): void => {
      if (this.state.phase !== "finished") {
        return;
      }

      this.resetToLobby();
    },

    /* V101069F_READY_HANDLER */
    paint_ready: (
      client: Client,
      message: {
        ready?: boolean;
      },
    ): void => {
      if (this.state.phase !== "paint") {
        return;
      }

      const player =
        this.state.players.get(
          client.sessionId,
        );

      if (
        !player ||
        player.role !== "hider" ||
        !player.alive
      ) {
        return;
      }

      if (message?.ready === false) {
        this.paintReadySessionIds.delete(
          client.sessionId,
        );
      } else {
        this.paintReadySessionIds.add(
          client.sessionId,
        );
      }

      this.broadcastPaintReadyState();
    },

    /* V101069F_EARLY_START */
    early_start_hunt: (
      client: Client,
    ): void => {
      if (this.state.phase !== "paint") {
        return;
      }

      const requester =
        this.state.players.get(
          client.sessionId,
        );

      if (
        !requester ||
        requester.role !== "hunter" ||
        !requester.alive
      ) {
        return;
      }

      const readyState =
        this.getPaintReadyState();

      if (
        readyState.total < 1 ||
        readyState.ready !==
          readyState.total
      ) {
        return;
      }

      this.state.phaseEndsAt =
        Date.now();

      this.startHuntPhase();
    },

    request_paint_ready_state: (
      client: Client,
    ): void => {
      /* V101072_READY_REQUEST_PHASE_RECOVERY */
      this.sendLobbySnapshot(client);
      this.sendPaintReadyState(client);
    },

    paint_stroke: (
      client: Client,
      message: PaintStrokeMessage,
    ): void => {
      const sender =
        this.state.players.get(
          client.sessionId,
        );

      const targetSessionId =
        String(
          message.targetSessionId ??
            "",
        );

      const target =
        this.state.players.get(
          targetSessionId,
        );

      if (
        this.state.phase !== "paint" ||
        !sender ||
        targetSessionId !==
          client.sessionId ||
        !target
      ) {
        return;
      }

      const color = Number(
        message.color,
      );

      const size = Number(
        message.size,
      );

      const shape = message.shape;

      if (
        !Number.isInteger(color) ||
        color < 0 ||
        color > 0xffffff ||
        !Number.isFinite(size) ||
        size < 1 ||
        size > 32 ||
        (
          shape !== "dotCircle" &&
          shape !== "circle" &&
          shape !== "square"
        ) ||
        !Array.isArray(message.points)
      ) {
        return;
      }

      const points = message.points
        .slice(0, 300)
        .map((point) => ({
          x: Number(point.x),
          y: Number(point.y),
        }))
        .filter(
          (point) =>
            Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            point.x >= 0 &&
            point.x <= 80 &&
            point.y >= 0 &&
            point.y <= 120,
        );

      if (points.length === 0) {
        return;
      }

      /* V101082B_STORE_ROUND_PAINT */
      const storedStroke = {
        senderId:
          client.sessionId,
        targetSessionId,
        color,
        size,
        shape,
        points,
      };

      const targetHistory =
        this.roundPaintStrokes.get(
          targetSessionId,
        ) ?? [];

      targetHistory.push(
        storedStroke,
      );

      if (
        targetHistory.length >
        500
      ) {
        targetHistory.splice(
          0,
          targetHistory.length -
            500,
        );
      }

      this.roundPaintStrokes.set(
        targetSessionId,
        targetHistory,
      );

      this.broadcast(
        "paint_stroke",
        {
          senderId:
            client.sessionId,
          targetSessionId,
          color,
          size,
          shape,
          points,
        },
        {
          except: client,
        },
      );
    },
  };

  /* V101099_MULTIPLAYER_CHAT */
  private readonly chatHistory: Array<{
    id: string;
    sessionId: string;
    name: string;
    text: string;
    sentAt: number;
  }> = [];

  private readonly chatRateHistory =
    new Map<string, number[]>();

  private readonly chatLastNormalized =
    new Map<
      string,
      {
        text: string;
        sentAt: number;
      }
    >();

  private chatSequence = 0;

  private normalizeChatText(
    value: unknown,
  ): string {
    return String(
      value ?? "",
    )
      .replace(
        /[\u0000-\u001f\u007f]/g,
        "",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim()
      .slice(
        0,
        140,
      );
  }

  private censorChatText(
    input: string,
  ): string {
    /*
     * Basic server-side profanity filtering.
     * Keep the list intentionally conservative to reduce false positives.
     * Variants separated by punctuation/spaces are caught by the compact
     * secondary check below.
     */
    const patterns = [
      /시발|씨발|ㅅㅂ|병신|ㅂㅅ|개새끼|새끼야|좆|존나|지랄/gi,
      /fuck|fucking|motherfucker|shit|bitch|asshole|dickhead/gi,
      /くそ|クソ|死ね|しね|シネ|ばかやろう|バカヤロー/gi,
    ];

    let output =
      input;

    for (
      const pattern of
      patterns
    ) {
      output =
        output.replace(
          pattern,
          "***",
        );
    }

    const compact =
      input
        .toLowerCase()
        .replace(
          /[\s._\-~!@#$%^&*()+=[\]{}|\\/:;"'?,<>]+/g,
          "",
        );

    const compactBlocked = [
      "씨발",
      "시발",
      "개새끼",
      "병신",
      "fuckyou",
      "motherfucker",
    ];

    if (
      compactBlocked.some(
        (word) =>
          compact.includes(
            word,
          ),
      )
    ) {
      return "***";
    }

    return output;
  }

  private sendChatHistory(
    client: Client,
  ): void {
    client.send(
      "chat_history",
      {
        messages:
          this.chatHistory,
      },
    );
  }


  onCreate(
    options: JoinOptions,
  ): void {
    this.autoDispose = true;

    /*
     * clock timeout이 어떤 이유로 지연되더라도 phaseEndsAt을 기준으로
     * 250ms마다 서버가 라운드 진행 상태를 보정합니다.
     */
    this.setSimulationInterval(
      () => {
        this.checkPhaseDeadline();

        /* V101072_READY_PERIODIC_PULSE */
        if (
          this.state.phase === "paint" &&
          Date.now() -
            this.lastPaintReadyPulseAt >=
            500
        ) {
          this.lastPaintReadyPulseAt =
            Date.now();
          this.broadcastPaintReadyState();
        }
      },
      50,
    );

    this.state.phase = "lobby";
    this.state.phaseEndsAt = 0;
    this.state.selectedMap = "random";
    this.state.activeMap = "forest";

    this.state.roomTitle =
      options.roomTitle
        ?.trim()
        .slice(0, 24) ||
      "Chameleon Room";

    this.state.isPrivate =
      Boolean(options.isPrivate);

    this.roomPassword =
      String(options.password ?? "")
        .slice(0, 32);

    if (this.state.isPrivate) {
      this.setPrivate(true);
    }

    this.metadata = {
      roomTitle:
        this.state.roomTitle,
      isPrivate:
        this.state.isPrivate,
      playerCount: 0,
      maxClients:
        this.maxClients,
      phase:
        this.state.phase,
      selectedMap:
        this.state.selectedMap,
      activeMap:
        this.state.activeMap,
    };
  
    /*
     * Keep empty reservation shell hidden until creator really joins.
     */
    this.syncRoomListingVisibility();
}

  onAuth(
    _client: Client,
    options: JoinOptions,
  ): boolean {
    if (!this.state.isPrivate) {
      return true;
    }

    return (
      String(options.password ?? "") ===
      this.roomPassword
    );
  }

  onJoin(
    client: Client,
    options: JoinOptions,
  ): void {
    this.liveSessionIds.add(
      client.sessionId,
    );

    this.syncRoomListingVisibility();

    console.log(
      "[Chameleon Hunt] onJoin begin",
      {
        roomId: this.roomId,
        sessionId:
          client.sessionId,
        existingPlayers:
          this.state.players.size,
      },
    );

    /* V101074_RECONNECT_IDENTITY */
    const clientKey =
      String(options.clientKey ?? "")
        .trim()
        .slice(0, 128);

    /*
     * v0.10.10.238.1 MID-GAME JOIN GUARD
     *
     * Active rounds accept ONLY an identity that already belongs to this
     * round: either an existing session with the same stable clientKey, or a
     * still-valid reconnect snapshot for that clientKey.
     *
     * A completely new invite-code user must never be created as a Hider in
     * paint/countdown/hunt. That used to corrupt role counts and round state.
     */
    if (this.state.phase !== "lobby") {
      const ownsExistingRoundPlayer =
        clientKey.length > 0 &&
        [...this.clientKeyBySessionId.entries()]
          .some(
            ([
              existingSessionId,
              existingClientKey,
            ]) =>
              existingClientKey === clientKey &&
              this.state.players.has(
                existingSessionId,
              ),
          );

      const reconnectSnapshot =
        clientKey.length > 0
          ? this.rejoinStateByClientKey.get(
              clientKey,
            )
          : undefined;

      const ownsReconnectSnapshot =
        Boolean(
          reconnectSnapshot &&
          reconnectSnapshot.expiresAt >
            Date.now(),
        );

      if (
        !ownsExistingRoundPlayer &&
        !ownsReconnectSnapshot
      ) {
        /*
         * onJoin already happened at Colyseus transport level, so reject this
         * client before PlayerState creation. Client receives a dedicated
         * machine-readable error and remains outside the active round.
         */
        client.send(
          "join_rejected",
          {
            reason:
              "game_in_progress",
            phase:
              this.state.phase,
            returnToLobby:
              true,
          },
        );

        this.liveSessionIds.delete(
          client.sessionId,
        );

        /*
         * v0.10.10.238.4 ZERO-PLAYER GHOST ROOM FIX
         *
         * The rejected mid-game invite was removed from liveSessionIds, but
         * room-list metadata/private visibility was not refreshed afterwards.
         * That left a public room listing alive with 0 connected players.
         */
        this.updateRoomMetadata();
        this.syncRoomListingVisibility();

        this.clock.setTimeout(
          () => {
            try {
              client.leave(
                4001,
                "game_in_progress",
              );
            } catch {
              // Transport may already be gone.
            }

            /*
             * Re-check once after the transport actually closes. This covers
             * the race where Colyseus' client collection settles after the
             * first metadata refresh.
             */
            this.updateRoomMetadata();
            this.syncRoomListingVisibility();
          },
          250,
        );

        return;
      }
    }

    if (clientKey) {
      for (
        const [
          existingSessionId,
          existingClientKey,
        ] of this.clientKeyBySessionId
      ) {
        if (
          existingSessionId !==
            client.sessionId &&
          existingClientKey ===
            clientKey &&
          this.state.players.has(
            existingSessionId,
          )
        ) {
          const replacedPlayer =
            this.state.players.get(
              existingSessionId,
            );

          /* V101091_CAPTURE_RECONNECT_SELF_PAINT */
          const reconnectSelfPaint =
            [...this.roundPaintStrokes.values()]
              .flat()
              .filter(
                (stroke: any) =>
                  stroke.targetSessionId ===
                    existingSessionId,
              )
              .map(
                (stroke: any) => ({
                  ...stroke,
                  senderId:
                    stroke.senderId ===
                      existingSessionId
                      ? client.sessionId
                      : stroke.senderId,
                  targetSessionId:
                    client.sessionId,
                }),
              );

          const replacedName =
            replacedPlayer?.name ??
            options.name ??
            "Player";

          /* V101078_CAPTURE_REPLACED_STATE */
          if (
            replacedPlayer &&
            this.state.phase !==
              "lobby"
          ) {
            this.rejoinStateByClientKey.set(
              clientKey,
              {
                role:
                  replacedPlayer.role,
                alive:
                  replacedPlayer.alive,
                hunterVolunteer:
                  replacedPlayer
                    .hunterVolunteer,
                x:
                  replacedPlayer.x,
                y:
                  replacedPlayer.y,
                /*
                 * v0.10.10.237:
                 * Fresh-transport fallback may happen after a browser/OS
                 * suspended the original socket for several minutes.
                 */
                expiresAt:
                  Date.now() +
                  5 * 60_000,
              },
            );
          }

          /*
           * The new stable-clientKey session is now the only owner of this
           * player identity. A late onReconnect from the old socket is stale.
           */
          this.supersededSessionIds.add(
            existingSessionId,
          );
          this.liveSessionIds.delete(
            existingSessionId,
          );

          this.state.players.delete(
            existingSessionId,
          );
          this.lastShotAt.delete(
            existingSessionId,
          );
          this.weaponHeatStates.delete(
            existingSessionId,
          );
          this.hunterRoundStats.delete(
            existingSessionId,
          );
          this.paintReadySessionIds.delete(
            existingSessionId,
          );

          /* V101087_RECONNECT_PAINT_THROTTLED */
          /* V101086_GLOBAL_PAINT_SESSION_REMAP */
          const remappedRoundPaint =
            new Map<string, any[]>();

          for (
            const [
              paintTargetId,
              paintStrokes,
            ] of this.roundPaintStrokes
          ) {
            const remappedTargetId =
              paintTargetId ===
                existingSessionId
                ? client.sessionId
                : paintTargetId;

            const remappedStrokes =
              paintStrokes.map(
                (stroke: any) => ({
                  ...stroke,
                  senderId:
                    stroke.senderId ===
                      existingSessionId
                      ? client.sessionId
                      : stroke.senderId,
                  targetSessionId:
                    stroke.targetSessionId ===
                      existingSessionId
                      ? client.sessionId
                      : stroke.targetSessionId,
                }),
              );

            const previous =
              remappedRoundPaint.get(
                remappedTargetId,
              ) ?? [];

            previous.push(
              ...remappedStrokes,
            );

            remappedRoundPaint.set(
              remappedTargetId,
              previous,
            );
          }

          this.roundPaintStrokes.clear();

          for (
            const [
              paintTargetId,
              paintStrokes,
            ] of remappedRoundPaint
          ) {
            this.roundPaintStrokes.set(
              paintTargetId,
              paintStrokes,
            );
          }

          [650].forEach(
            (delay) => {
              this.clock.setTimeout(
                () => {
                  if (
                    !this.state.players.has(
                      client.sessionId,
                    )
                  ) {
                    return;
                  }

                  this.clients.forEach(
                    (connectedClient) => {
                      this.sendLobbySnapshot(
                        connectedClient,
                      );

                      connectedClient.send(
                        "round_paint_state",
                        {
                          strokes:
                            [...this.roundPaintStrokes.values()]
                              .flat(),
                        },
                      );
                    },
                  );
                },
                delay,
              );
            },
          );

          /* V101082B_TRANSFER_PAINT_STATE */
          const oldAvatar =
            this.lobbyAvatarPresets.get(
              existingSessionId,
            );

          if (oldAvatar) {
            this.lobbyAvatarPresets.set(
              client.sessionId,
              oldAvatar,
            );

            this.lobbyAvatarPresets.delete(
              existingSessionId,
            );
          }

          const oldRoundPaint =
            this.roundPaintStrokes.get(
              existingSessionId,
            );

          if (oldRoundPaint) {
            const transferred =
              oldRoundPaint.map(
                (stroke: any) => ({
                  ...stroke,
                  senderId:
                    stroke.senderId ===
                      existingSessionId
                      ? client.sessionId
                      : stroke.senderId,
                  targetSessionId:
                    client.sessionId,
                }),
              );

            this.roundPaintStrokes.set(
              client.sessionId,
              transferred,
            );

            this.roundPaintStrokes.delete(
              existingSessionId,
            );

            /* V101084_REJOIN_PAINT_BROADCAST */
            this.clock.setTimeout(
              () => {
                const active =
                  this.state.phase === "paint" ||
                  this.state.phase === "hunt" ||
                  this.state.phase === "countdown";

                if (!active) {
                  return;
                }

                this.broadcast(
                  "round_paint_state",
                  {
                    strokes:
                      [...this.roundPaintStrokes.values()]
                        .flat(),
                  },
                );
              },
              80,
            );
          }
          this.clientKeyBySessionId.delete(
            existingSessionId,
          );

          /* V101079_REPLACEMENT_CANCELS_DISCONNECT_OUTCOME */
          this.noHunterGraceGeneration += 1;

          if (
            this.state.hostId ===
              existingSessionId
          ) {
            this.state.hostId =
              client.sessionId;
          }

          this.broadcast(
            "player_reconnected",
            {
              name: replacedName,
            },
          );

          if (
            reconnectSelfPaint.length >
            0
          ) {
            this.clock.setTimeout(
              () => {
                if (
                  !this.state.players.has(
                    client.sessionId,
                  )
                ) {
                  return;
                }

                let cursor = 0;

                const replayBatch =
                  (): void => {
                    if (
                      !this.state.players.has(
                        client.sessionId,
                      )
                    ) {
                      return;
                    }

                    const end =
                      Math.min(
                        reconnectSelfPaint.length,
                        cursor + 6,
                      );

                    for (
                      ;
                      cursor < end;
                      cursor += 1
                    ) {
                      const stroke =
                        reconnectSelfPaint[cursor];

                      this.broadcast(
                        "paint_stroke",
                        {
                          senderId:
                            stroke.senderId,
                          targetSessionId:
                            client.sessionId,
                          color:
                            stroke.color,
                          size:
                            stroke.size,
                          shape:
                            stroke.shape,
                          points:
                            stroke.points,
                        },
                      );
                    }

                    if (
                      cursor <
                      reconnectSelfPaint.length
                    ) {
                      this.clock.setTimeout(
                        replayBatch,
                        90,
                      );
                    }
                  };

                replayBatch();
              },
              1400,
            );

            /*
             * One delayed second pass only for this player's paint.
             * This covers slower opponent Schema creation without replaying
             * the whole round or touching reconnect state.
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

                reconnectSelfPaint.forEach(
                  (stroke: any) => {
                    this.broadcast(
                      "paint_stroke",
                      {
                        senderId:
                          stroke.senderId,
                        targetSessionId:
                          client.sessionId,
                        color:
                          stroke.color,
                        size:
                          stroke.size,
                        shape:
                          stroke.shape,
                        points:
                          stroke.points,
                      },
                    );
                  },
                );
              },
              3200,
            );
          }

          break;
        }
      }
    }

    const player =
      new PlayerState();

    player.name =
      options.name
        ?.trim()
        .slice(0, 16) ||
      `Player-${
        client.sessionId.slice(0, 4)
      }`;

    if (
      this.state.players.size === 0
    ) {
      this.state.hostId =
        client.sessionId;
    }

    player.role = "hider";
    player.hunterVolunteer = false;
    player.alive = true;

    const lobbyPosition =
      this.getRandomLobbyPosition();

    player.x = lobbyPosition.x;
    player.y = lobbyPosition.y;

    /* V101078_RESTORE_REJOIN_STATE */
    if (clientKey) {
      const saved =
        this.rejoinStateByClientKey.get(
          clientKey,
        );

      if (
        saved &&
        saved.expiresAt >
          Date.now() &&
        this.state.phase !==
          "lobby"
      ) {
        player.role =
          saved.role;
        player.alive =
          saved.alive;
        player.hunterVolunteer =
          saved.hunterVolunteer;
        player.x =
          saved.x;
        player.y =
          saved.y;

        this.rejoinStateByClientKey.delete(
          clientKey,
        );
      }
    }

    this.noHunterGraceGeneration += 1;

    this.state.players.set(
      client.sessionId,
      player,
    );

    this.markRoleConnectionRestored(
      client.sessionId,
    );

    /* V101090_SAFE_EXISTING_PAINT_STROKE_REPLAY */
    if (
      options.reconnectFallback === true &&
      this.state.phase !== "lobby"
    ) {
      this.clock.setTimeout(
        () => {
          if (
            !this.state.players.has(
              client.sessionId,
            )
          ) {
            return;
          }

          const reconnectPaint =
            (
              this.roundPaintStrokes.get(
                client.sessionId,
              ) ?? []
            ).map(
              (stroke: any) => ({
                ...stroke,
                senderId:
                  stroke.senderId ===
                    stroke.targetSessionId
                    ? client.sessionId
                    : stroke.senderId,
                targetSessionId:
                  client.sessionId,
              }),
            );

          if (
            reconnectPaint.length <
            1
          ) {
            return;
          }

          let cursor = 0;

          const sendBatch =
            (): void => {
              if (
                !this.state.players.has(
                  client.sessionId,
                )
              ) {
                return;
              }

              const end =
                Math.min(
                  reconnectPaint.length,
                  cursor + 12,
                );

              for (
                ;
                cursor < end;
                cursor += 1
              ) {
                const stroke =
                  reconnectPaint[cursor];

                this.broadcast(
                  "paint_stroke",
                  {
                    senderId:
                      stroke.senderId,
                    targetSessionId:
                      client.sessionId,
                    color:
                      stroke.color,
                    size:
                      stroke.size,
                    shape:
                      stroke.shape,
                    points:
                      stroke.points,
                  },
                );
              }

              if (
                cursor <
                reconnectPaint.length
              ) {
                this.clock.setTimeout(
                  sendBatch,
                  70,
                );
              }
            };

          sendBatch();
        },
        1200,
      );
    }

    /* V101088_TARGETED_RECONNECT_PAINT */
    if (
      false &&
      this.state.phase !== "lobby"
    ) {
      [700, 1600, 3200].forEach(
        (delay) => {
          this.clock.setTimeout(
            () => {
              if (
                !this.state.players.has(
                  client.sessionId,
                )
              ) {
                return;
              }
},
            delay,
          );
        },
      );
    }

    /* V101085_REJOIN_FULL_STATE_PULSE */
    if (
      this.state.phase !== "lobby" &&
      String(options.clientKey ?? "")
        .trim()
    ) {
      [650].forEach(
        (delay) => {
          this.clock.setTimeout(
            () => {
              if (
                !this.state.players.has(
                  client.sessionId,
                )
              ) {
                return;
              }

              this.clients.forEach(
                (connectedClient) => {
                  this.sendLobbySnapshot(
                    connectedClient,
                  );

                  connectedClient.send(
                    "round_paint_state",
                    {
                      strokes:
                        [...this.roundPaintStrokes.values()]
                          .flat(),
                    },
                  );
                },
              );
            },
            delay,
          );
        },
      );
    }

    /* V101074_STORE_CLIENT_KEY */
    const stableClientKey =
      String(options.clientKey ?? "")
        .trim()
        .slice(0, 128);

    if (stableClientKey) {
      this.clientKeyBySessionId.set(
        client.sessionId,
        stableClientKey,
      );
    }

    /*
     * 최초 생성자뿐 아니라 어떤 이유로 hostId가 비어 있는 경우에도
     * 현재 서버 state에서 즉시 복구합니다.
     */
    this.ensureValidHost();

    this.weaponHeatStates.set(
      client.sessionId,
      {
        heat: 0,
        updatedAt: Date.now(),
        overheatedUntil: 0,
      },
    );

    this.updateRoomMetadata();

    /* V101079_REJOIN_SNAPSHOT_PULSE */
    if (
      this.state.phase !== "lobby"
    ) {
      this.sendLobbySnapshot(
        client,
      );

      client.send(
        "phase_changed",
        {
          phase:
            this.state.phase,
          phaseEndsAt:
            this.state.phaseEndsAt,
          serverNow:
            Date.now(),
        },
      );

      this.clock.setTimeout(
        () => {
          if (
            this.clients.includes(
              client,
            )
          ) {
            this.sendLobbySnapshot(
              client,
            );
          }
        },
        120,
      );
    }

    console.log(
      "[Chameleon Hunt] onJoin complete",
      {
        roomId: this.roomId,
        sessionId:
          client.sessionId,
        hostId:
          this.state.hostId,
        players:
          this.state.players.size,
      },
    );
  }

  private isDisconnectOutcomePhase(): boolean {
    return (
      this.state.phase === "countdown" ||
      this.state.phase === "paint" ||
      this.state.phase === "hunt"
    );
  }

  private countLiveRole(
    role: "hunter" | "hider",
  ): number {
    let count = 0;

    for (
      const sessionId of
      this.liveSessionIds
    ) {
      const player =
        this.state.players.get(
          sessionId,
        );

      if (
        player &&
        player.role === role &&
        (
          role === "hunter" ||
          player.alive
        )
      ) {
        count += 1;
      }
    }

    return count;
  }

  private broadcastRoleDisconnectCountdown(
    role: "hunter" | "hider",
    remaining: number,
    cancelled = false,
  ): void {
    this.broadcast(
      "role_disconnect_countdown",
      {
        role,
        remaining,
        cancelled,
      },
    );
  }

  private cancelDisconnectOutcomeForRole(
    role: "hunter" | "hider",
  ): void {
    if (role === "hunter") {
      this.hunterDisconnectOutcomeGeneration += 1;
    } else {
      this.allHiderDisconnectOutcomeGeneration += 1;
    }

    if (
      this.isDisconnectOutcomePhase()
    ) {
      this.broadcastRoleDisconnectCountdown(
        role,
        0,
        true,
      );
    }
  }

  private scheduleAllHuntersDisconnectedOutcome(): void {
    if (
      !this.isDisconnectOutcomePhase() ||
      this.countLiveRole("hunter") > 0
    ) {
      return;
    }

    const generation =
      ++this.hunterDisconnectOutcomeGeneration;

    this.clock.setTimeout(
      () => {
        if (
          generation !==
            this.hunterDisconnectOutcomeGeneration ||
          !this.isDisconnectOutcomePhase() ||
          this.countLiveRole("hunter") > 0
        ) {
          return;
        }

        const tick =
          (
            remaining: number,
          ): void => {
            if (
              generation !==
                this.hunterDisconnectOutcomeGeneration ||
              !this.isDisconnectOutcomePhase()
            ) {
              return;
            }

            if (
              this.countLiveRole("hunter") >
              0
            ) {
              this.cancelDisconnectOutcomeForRole(
                "hunter",
              );
              return;
            }

            if (remaining <= 0) {
              /*
               * No live Hunter returned within 10 sec silent grace + 5 sec
               * visible countdown. Preserve session identity separately, but
               * end this round cleanly so everybody else is never trapped.
               */
              this.finishGame(
                "hiders",
                "timeout",
              );
              return;
            }

            this.broadcastRoleDisconnectCountdown(
              "hunter",
              remaining,
            );

            this.clock.setTimeout(
              () => {
                tick(
                  remaining - 1,
                );
              },
              1_000,
            );
          };

        tick(
          this.disconnectVisibleCountdownSeconds,
        );
      },
      this.disconnectSilentGraceMs,
    );
  }

  private scheduleAllHidersDisconnectedOutcome(): void {
    if (
      !this.isDisconnectOutcomePhase() ||
      this.countLiveRole("hider") > 0
    ) {
      return;
    }

    const hasAliveHider =
      [...this.state.players.values()]
        .some(
          (player) =>
            player.role === "hider" &&
            player.alive,
        );

    if (!hasAliveHider) {
      return;
    }

    const generation =
      ++this.allHiderDisconnectOutcomeGeneration;

    this.clock.setTimeout(
      () => {
        if (
          generation !==
            this.allHiderDisconnectOutcomeGeneration ||
          !this.isDisconnectOutcomePhase() ||
          this.countLiveRole("hider") > 0
        ) {
          return;
        }

        const tick =
          (
            remaining: number,
          ): void => {
            if (
              generation !==
                this.allHiderDisconnectOutcomeGeneration ||
              !this.isDisconnectOutcomePhase()
            ) {
              return;
            }

            if (
              this.countLiveRole("hider") >
              0
            ) {
              this.cancelDisconnectOutcomeForRole(
                "hider",
              );
              return;
            }

            if (remaining <= 0) {
              /*
               * Every still-alive Hider is offline after the full grace.
               * Mark those offline Hiders eliminated before finishGame so its
               * finalAliveHiderCount authority resolves to Hunters.
               */
              for (
                const [
                  sessionId,
                  player,
                ] of this.state.players
              ) {
                if (
                  player.role !== "hider" ||
                  !player.alive ||
                  this.liveSessionIds.has(
                    sessionId,
                  )
                ) {
                  continue;
                }

                player.alive = false;
                this.paintReadySessionIds.delete(
                  sessionId,
                );
              }

              this.finishGame(
                "hunters",
                "all_hiders_found",
              );
              return;
            }

            this.broadcastRoleDisconnectCountdown(
              "hider",
              remaining,
            );

            this.clock.setTimeout(
              () => {
                tick(
                  remaining - 1,
                );
              },
              1_000,
            );
          };

        tick(
          this.disconnectVisibleCountdownSeconds,
        );
      },
      this.disconnectSilentGraceMs,
    );
  }

  private scheduleDisconnectedHiderElimination(
    sessionId: string,
  ): void {
    const player =
      this.state.players.get(
        sessionId,
      );

    if (
      !player ||
      player.role !== "hider" ||
      !player.alive
    ) {
      return;
    }

    const generation =
      (
        this.hiderDisconnectGenerationBySessionId.get(
          sessionId,
        ) ?? 0
      ) + 1;

    this.hiderDisconnectGenerationBySessionId.set(
      sessionId,
      generation,
    );

    const totalGraceMs =
      this.disconnectSilentGraceMs +
      this.disconnectVisibleCountdownSeconds *
        1_000;

    this.clock.setTimeout(
      () => {
        if (
          !this.isDisconnectOutcomePhase() ||
          this.liveSessionIds.has(
            sessionId,
          ) ||
          this.hiderDisconnectGenerationBySessionId.get(
            sessionId,
          ) !== generation
        ) {
          return;
        }

        const current =
          this.state.players.get(
            sessionId,
          );

        if (
          !current ||
          current.role !== "hider" ||
          !current.alive
        ) {
          return;
        }

        current.alive = false;

        this.paintReadySessionIds.delete(
          sessionId,
        );

        this.broadcast(
          "player_disconnect_eliminated",
          {
            sessionId,
            name:
              current.name ??
              "Player",
          },
        );

        this.broadcastPaintReadyState();

        const anyAliveHider =
          [...this.state.players.values()]
            .some(
              (candidate) =>
                candidate.role === "hider" &&
                candidate.alive,
            );

        if (!anyAliveHider) {
          this.finishGame(
            "hunters",
            "all_hiders_found",
          );
        }
      },
      totalGraceMs,
    );
  }

  private markRoleConnectionRestored(
    sessionId: string,
  ): void {
    const player =
      this.state.players.get(
        sessionId,
      );

    if (!player) {
      return;
    }

    if (player.role === "hunter") {
      if (
        this.countLiveRole("hunter") > 0
      ) {
        this.cancelDisconnectOutcomeForRole(
          "hunter",
        );
      }
      return;
    }

    const generation =
      (
        this.hiderDisconnectGenerationBySessionId.get(
          sessionId,
        ) ?? 0
      ) + 1;

    this.hiderDisconnectGenerationBySessionId.set(
      sessionId,
      generation,
    );

    if (
      this.countLiveRole("hider") > 0
    ) {
      this.cancelDisconnectOutcomeForRole(
        "hider",
      );
    }
  }

  async onDrop(
    client: Client,
    code: number,
  ): Promise<void> {
    this.liveSessionIds.delete(
      client.sessionId,
    );

    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    /*
     * Colyseus 0.17 distinguishes a temporary network drop from a real
     * leave when onDrop() is implemented.
     *
     * Previously every brief WebSocket interruption went straight through
     * onLeave(), which removed the player. During an active Paint round,
     * that made canContinue=false and immediately reset everybody to Lobby.
     *
     * Give the same session 10 seconds to reconnect. While this is pending,
     * DO NOT delete the player and DO NOT abort the round.
     */
    console.log(
      "[Chameleon Hunt] temporary drop",
      {
        sessionId:
          client.sessionId,
        code,
      },
    );

    /* V101073_LOBBY_DROP_CLEANUP */
    if (this.state.phase === "lobby") {
      this.onLeave(
        client,
        code as CloseCode,
      );
      return;
    }

    /*
     * v0.10.10.238:
     * onDrop is the authoritative start signal. Browser blur/hidden alone is
     * never enough. Role outcome grace runs independently of the 5-minute
     * allowReconnection reservation below.
     */
    const droppedPlayer =
      this.state.players.get(
        client.sessionId,
      );

    if (
      droppedPlayer &&
      this.isDisconnectOutcomePhase()
    ) {
      if (
        droppedPlayer.role === "hunter" &&
        this.countLiveRole("hunter") === 0
      ) {
        this.scheduleAllHuntersDisconnectedOutcome();
      } else if (
        droppedPlayer.role === "hider"
      ) {
        this.scheduleDisconnectedHiderElimination(
          client.sessionId,
        );

        if (
          this.countLiveRole("hider") === 0
        ) {
          this.scheduleAllHidersDisconnectedOutcome();
        }
      }
    }

    try {
      /*
       * v0.10.10.237 BACKGROUND / TAB-SWITCH STABILITY
       *
       * Hider paint time is intentionally a "wait and do something else"
       * period for Hunters. Mobile OSes and browsers may suspend a hidden tab
       * long enough to miss WebSocket heartbeats even though the player is
       * coming straight back.
       *
       * Keep the SAME Colyseus session reconnectable for five minutes instead
       * of forcing a fresh clientKey handoff after only 30 seconds.
       * While this promise is pending the player remains in state.players, so:
       * - role/host ownership is preserved
       * - the round is not aborted
       * - paint identity is not remapped
       * - other players are not churned by this temporary absence
       */
      await this.allowReconnection(
        client,
        300,
      );
    } catch {
      /*
       * When reconnection finally fails, Colyseus will treat the client as
       * permanently gone and onLeave() performs the existing cleanup.
       */
    }
  }

  onReconnect(
    client: Client,
  ): void {
    /*
     * A fresh clientKey handoff may have replaced this exact old session
     * while the browser was asleep. Ignore a late transport resurrection;
     * otherwise the ghost socket can interfere with host/player ownership.
     */
    if (
      this.supersededSessionIds.has(
        client.sessionId,
      ) ||
      !this.state.players.has(
        client.sessionId,
      )
    ) {
      this.liveSessionIds.delete(
        client.sessionId,
      );
      this.updateRoomMetadata();
      this.syncRoomListingVisibility();

      console.warn(
        "[Chameleon Hunt] ignored stale reconnect",
        {
          sessionId:
            client.sessionId,
        },
      );
      return;
    }

    this.liveSessionIds.add(
      client.sessionId,
    );

    this.markRoleConnectionRestored(
      client.sessionId,
    );

    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    /* V101078_CANCEL_NO_HUNTER_ON_RECONNECT */
    this.noHunterGraceGeneration += 1;

    console.log(
      "[Chameleon Hunt] reconnected",
      {
        sessionId:
          client.sessionId,
        phase:
          this.state.phase,
      },
    );

    /* V101075_REAL_RECONNECT_NOTICE */
    const reconnectedPlayer =
      this.state.players.get(
        client.sessionId,
      );

    this.broadcast(
      "player_reconnected",
      {
        name:
          reconnectedPlayer?.name ??
          "Player",
      },
    );

    /*
     * Immediately resynchronize the recovered client instead of waiting
     * for another Schema patch.
     */
    this.sendLobbySnapshot(
      client,
    );

    client.send(
      "phase_changed",
      {
        phase:
          this.state.phase,
        phaseEndsAt:
          this.state.phaseEndsAt,
        serverNow: Date.now(),
      },
    );

    /* V101082B_RECONNECT_PAINT_REPLAY */
    client.send(
      "round_paint_state",
      {
        strokes:
          this.state.phase === "paint" ||
          this.state.phase === "hunt" ||
          this.state.phase === "countdown"
            ? [...this.roundPaintStrokes.values()]
                .flat()
            : [],
      },
    );

    client.send(
      "avatar_presets",
      {
        presets:
          [...this.lobbyAvatarPresets.entries()]
            .map(
              ([sessionId, strokes]) => ({
                sessionId,
                strokes,
              }),
            ),
      },
    );

    if (this.state.phase === "paint") {
      this.sendPaintReadyState(client);
    }

    /* V101077_RECONNECT_MULTI_PULSE */
    [80, 220, 650].forEach(
      (delay) => {
        this.clock.setTimeout(
          () => {
            if (
              this.clients.includes(
                client,
              )
            ) {
              this.sendLobbySnapshot(
                client,
              );

              if (
                this.state.phase ===
                  "paint"
              ) {
                this.sendPaintReadyState(
                  client,
                );
              }
            }
          },
          delay,
        );
      },
    );
  }

  onLeave(
    client: Client,
    _code: CloseCode,
  ): void {
    this.liveSessionIds.delete(
      client.sessionId,
    );

    /*
     * Hide/update before any round-specific early return.
     */
    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    /* V101073_DUPLICATE_LEAVE_GUARD */
    if (
      !this.state.players.has(
        client.sessionId,
      )
    ) {
      return;
    }

    const leavingPlayer =
      this.state.players.get(
        client.sessionId,
      );

    const leavingName =
      leavingPlayer?.name ??
      "Player";

    /* V101078_CAPTURE_LEAVE_STATE */
    const leavingClientKey =
      this.clientKeyBySessionId.get(
        client.sessionId,
      ) ?? "";

    if (
      leavingClientKey &&
      leavingPlayer &&
      this.state.phase !== "lobby"
    ) {
      this.rejoinStateByClientKey.set(
        leavingClientKey,
        {
          role:
            leavingPlayer.role,
          alive:
            leavingPlayer.alive,
          hunterVolunteer:
            leavingPlayer
              .hunterVolunteer,
          x:
            leavingPlayer.x,
          y:
            leavingPlayer.y,
          expiresAt:
            Date.now() +
            5 * 60_000,
        },
      );
    }

    this.state.players.delete(
      client.sessionId,
    );

    this.lastShotAt.delete(
      client.sessionId,
    );

    this.weaponHeatStates.delete(
      client.sessionId,
    );

    this.hunterRoundStats.delete(
      client.sessionId,
    );

    /* V101074_DELETE_CLIENT_KEY */
    this.clientKeyBySessionId.delete(
      client.sessionId,
    );

    /* V101069_READY_LEAVE_CLEANUP */
    this.paintReadySessionIds.delete(client.sessionId);
    if (this.state.phase === "paint") {
      this.broadcastPaintReadyState();
    }

    const previousHostId =
      this.state.hostId;

    if (
      this.state.hostId ===
        client.sessionId ||
      !this.state.players.has(
        this.state.hostId,
      )
    ) {
      this.ensureValidHost();
    }

    if (
      previousHostId !==
        this.state.hostId &&
      this.state.hostId
    ) {
      /*
       * Schema patch를 기다리지 않아도 모든 남은 클라이언트가
       * 새 hostId를 즉시 알 수 있도록 snapshot도 다시 보냅니다.
       */
      this.clients.forEach(
        (remainingClient) => {
          this.sendLobbySnapshot(
            remainingClient,
          );
        },
      );
    }

    this.broadcast(
      "player_disconnected",
      {
        sessionId:
          client.sessionId,
        name:
          leavingName,
      },
    );

    const roundIsActive =
      this.state.phase ===
        "countdown" ||
      this.state.phase ===
        "paint" ||
      this.state.phase ===
        "hunt";

    if (roundIsActive) {
      const players =
        [...this.state.players.values()];

      const hunterCount =
        players.filter(
          (player) =>
            player.role === "hunter",
        ).length;

      const hiderCount =
        players.filter(
          (player) =>
            player.role === "hider",
        ).length;

      if (players.length === 0) {
        this.resetToLobby();
        return;
      }

      /*
       * BEFORE HUNT:
       * All Hiders disappearing is NOT a Hunter victory.  It means the
       * round no longer has a valid hide-and-seek setup, so cancel it and
       * return the remaining players to Lobby.
       */
      if (
        this.state.phase === "countdown" ||
        this.state.phase === "paint"
      ) {
        if (
          hiderCount < 1 &&
          hunterCount >= 1
        ) {
          this.broadcast(
            "round_aborted",
            {
              message:
                "All Hiders disconnected. Returning to the lobby.",
            },
          );

          this.resetToLobby();
          return;
        }

        if (
          hunterCount < 1 &&
          hiderCount >= 1
        ) {
          /*
           * v0.10.10.78:
           * Network handoff is not a victory condition.
           */
          /*
           * v0.10.10.79:
           * Temporary loss of all Hunters does not end the match.
           * Hunt's authoritative deadline remains the victory condition.
           */
          return;
        }

        return;
      }

      /*
       * HUNT:
       * A disconnected Hider is treated as eliminated. Only after the last
       * Hider is truly gone may Hunters win. If all Hunters leave, Hiders win.
       */
      if (this.state.phase === "hunt") {
        if (
          hunterCount < 1 &&
          hiderCount >= 1
        ) {
          /*
           * v0.10.10.78:
           * Network handoff is not a victory condition.
           */
          /*
           * v0.10.10.79:
           * Temporary loss of all Hunters does not end the match.
           * Hunt's authoritative deadline remains the victory condition.
           */
          return;
        }

        if (
          hiderCount < 1 &&
          hunterCount >= 1
        ) {
          this.finishGame("hunters");
          return;
        }
      }
    }

    this.updateRoomMetadata();

    /*
     * v0.10.10.238.5:
     * A real lobby leave has no reconnect reservation. If that was the last
     * connected transport, destroy the room instead of leaving a joinable
     * 0 / 10 shell behind.
     */
    this.disposeEmptyLobbySoon();
  }

  /*
   * v0.10.10.238.5 EMPTY LOBBY DISPOSE
   *
   * Active-round reconnect reservations must survive temporary browser/mobile
   * suspension. Once the room is a lobby with no REAL connected transports,
   * however, there is nobody to preserve and the room must be disposed.
   *
   * A short delay lets Colyseus settle its client collection and avoids
   * fighting an immediate join/leave handoff.
   */
  private disposeEmptyLobbySoon(): void {
    if (
      this.state.phase !== "lobby" ||
      this.liveSessionIds.size > 0
    ) {
      return;
    }

    this.syncRoomListingVisibility();

    this.clock.setTimeout(
      () => {
        if (
          this.state.phase !== "lobby" ||
          this.liveSessionIds.size > 0
        ) {
          return;
        }

        console.log(
          "[Color Hunt] disposing empty lobby",
          {
            roomId: this.roomId,
          },
        );

        void this.disconnect();
      },
      300,
    );
  }

  private assignRoles(): void {
    const entries =
      [...this.state.players.entries()];

    const hunterCount =
      this.getRecommendedHunterCount(
        entries.length,
      );

    this.state.hunterCount =
      hunterCount;

    this.hunterRoundStats.clear();

    for (
      const [, player] of entries
    ) {
      /*
       * Hider는 대기실에서 보이던 위치를 그대로 게임 시작 위치로 사용합니다.
       * role 배정 순간 480,270으로 강제 이동시키던 테스트 spawn을 제거합니다.
       */
      player.role = "hider";
      player.alive = true;
    }

    const volunteers =
      this.shuffle(
        entries.filter(
          ([, player]) =>
            player.hunterVolunteer,
        ),
      );

    const nonVolunteers =
      this.shuffle(
        entries.filter(
          ([, player]) =>
            !player.hunterVolunteer,
        ),
      );

    const selected =
      volunteers.slice(
        0,
        hunterCount,
      );

    if (
      selected.length <
      hunterCount
    ) {
      selected.push(
        ...nonVolunteers.slice(
          0,
          hunterCount -
            selected.length,
        ),
      );
    }

    selected.forEach(
      ([sessionId, player], index) => {
        player.role = "hunter";
        player.alive = true;
        player.x =
          80 + index * 55;
        player.y = 270;

        this.hunterRoundStats.set(
          sessionId,
          {
            reserve:
              this.maxHunterReserve,
            precisionPoints: 0,
            shotsFired: 0,
          },
        );
      },
    );
  }

  private getRecommendedHunterCount(
    playerCount: number,
  ): number {
    if (playerCount >= 9) {
      return 3;
    }

    if (playerCount >= 5) {
      return 2;
    }

    return 1;
  }

  private checkPhaseDeadline(): void {
    const phaseEndsAt =
      this.state.phaseEndsAt;

    if (
      !phaseEndsAt ||
      phaseEndsAt <= 0 ||
      Date.now() < phaseEndsAt
    ) {
      return;
    }

    if (
      this.state.phase ===
      "countdown"
    ) {
      this.startPaintPhase();
      return;
    }

    if (
      this.state.phase ===
      "paint"
    ) {
      this.startHuntPhase();
      return;
    }

    if (
      this.state.phase ===
      "hunt"
    ) {
      this.finishGame(
        "hiders",
      );
      return;
    }

    if (
      this.state.phase ===
      "finished"
    ) {
      this.resetToLobby();
    }
  }

  private startCountdownPhase(): void {
    this.state.phase = "countdown";


    this.state.phaseEndsAt =
      Date.now() +
      this.countdownDurationMs;

    this.updateRoomMetadata();
    this.broadcastPhaseChanged();

    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
          "countdown"
        ) {
          this.startPaintPhase();
        }
      },
      this.countdownDurationMs,
    );
  }

  private startPaintPhase(): void {
    /*
     * PHASE_DEADLINE_GUARD_COUNTDOWN
     *
     * Never enter Paint unless the authoritative Countdown really ended.
     * Stale callbacks from a previous round are ignored.
     */
    if (
      this.state.phase !==
      "countdown"
    ) {
      return;
    }

    const countdownRemainingMs =
      this.state.phaseEndsAt -
      Date.now();

    if (
      Number.isFinite(
        countdownRemainingMs,
      ) &&
      countdownRemainingMs > 25
    ) {
      this.clock.setTimeout(
        () => {
          this.startPaintPhase();
        },
        countdownRemainingMs,
      );

      return;
    }

    this.state.phase = "paint";


    this.state.phaseEndsAt =
      Date.now() +
      this.paintDurationMs;

    /* V101069_READY_PAINT_START */
    /* V101082B_CLEAR_ROUND_PAINT */
    this.roundPaintStrokes.clear();

    this.paintReadySessionIds.clear();

    this.updateRoomMetadata();
    this.broadcastPhaseChanged();
    this.broadcastPaintReadyState();
    /* V101068_REDUNDANT_startPaintPhase */
    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
          "paint"
        ) {
          this.broadcastPhaseChanged();
        }
      },
      180,
    );

    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
          "paint"
        ) {
          this.startHuntPhase();
        }
      },
      this.paintDurationMs,
    );
  }

  private startHuntPhase(): void {
    /*
     * PHASE_DEADLINE_GUARD_PAINT
     *
     * This is the final authority for Paint -> Hunt.
     *
     * Even if an old/duplicate Colyseus timer fires early, Hunt can NEVER
     * begin while the server's authoritative Paint deadline is still in
     * the future.
     */
    if (
      this.state.phase !==
      "paint"
    ) {
      return;
    }

    const paintRemainingMs =
      this.state.phaseEndsAt -
      Date.now();

    if (
      Number.isFinite(
        paintRemainingMs,
      ) &&
      paintRemainingMs > 25
    ) {
      /*
       * Do not trust the early callback. Re-arm exactly for the remaining
       * authoritative duration. If several stale callbacks arrive, every
       * one of them hits this same guard; once the first valid transition
       * changes phase to Hunt, all later callbacks return above.
       */
      this.clock.setTimeout(
        () => {
          this.startHuntPhase();
        },
        paintRemainingMs,
      );

      return;
    }

    /*
     * Corrupted/empty deadlines are also unsafe. Paint may only finish from
     * a real deadline set by the current Paint phase.
     */
    if (
      !Number.isFinite(
        this.state.phaseEndsAt,
      ) ||
      this.state.phaseEndsAt <= 0
    ) {
      console.warn(
        "[Color Hunt] blocked Hunt transition: invalid Paint deadline",
        {
          phase:
            this.state.phase,
          phaseEndsAt:
            this.state.phaseEndsAt,
        },
      );

      return;
    }

    console.log(
      "[Color Hunt] Paint deadline reached -> Hunt",
      {
        now: Date.now(),
        phaseEndsAt:
          this.state.phaseEndsAt,
        lateByMs:
          Date.now() -
          this.state.phaseEndsAt,
      },
    );

    this.state.phase = "hunt";


    this.state.phaseEndsAt =
      Date.now() +
      this.huntDurationMs;

    this.updateRoomMetadata();
    this.broadcastPhaseChanged();

    /* V101072_HUNT_RECOVERY_PULSE */
    [120, 450].forEach(
      (delay) => {
        this.clock.setTimeout(
          () => {
            if (
              this.state.phase === "hunt"
            ) {
              this.clients.forEach(
                (connectedClient) => {
                  this.sendLobbySnapshot(
                    connectedClient,
                  );
                },
              );
            }
          },
          delay,
        );
      },
    );

    /* V101068_REDUNDANT_startHuntPhase */
    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
          "hunt"
        ) {
          this.broadcastPhaseChanged();
        }
      },
      180,
    );

    const expectedHuntEndsAt =
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
    );
  }



  private finishGame(
    winner: "hunters" | "hiders",
    reason: RoundEndReason =
      winner === "hunters"
        ? "all_hiders_found"
        : "timeout",
  ): void {
    /* V101092_FINAL_WINNER_RESOLUTION */
    const finalAliveHiderCount =
      [...this.state.players.values()]
        .filter(
          (player) =>
            player.role === "hider" &&
            player.alive,
        )
        .length;

    if (
      finalAliveHiderCount === 0
    ) {
      winner = "hunters";
    }

    /*
     * If a stale callback tentatively finished as Hiders while the last
     * Hider was eliminated in the same race, correct the stored result.
     */
    if (
      this.state.phase === "finished" &&
      this.state.winner === "hiders" &&
      finalAliveHiderCount === 0
    ) {
      this.state.winner =
        "hunters";

      this.broadcast(
        "round_result",
        {
          winner:
            "hunters",
        },
      );

      return;
    }

    /* V101091_FINISH_GAME_IDEMPOTENT */
    if (
      this.state.phase ===
        "finished" &&
      (
        this.state.winner ===
          "hunters" ||
        this.state.winner ===
          "hiders"
      )
    ) {
      return;
    }

    if (
      this.state.phase ===
      "finished"
    ) {
      return;
    }

    this.state.winner = winner;
    this.state.phase = "finished";

    this.state.phaseEndsAt =
      Date.now() +
      this.resultDurationMs;

    const revealedHiders =
      [...this.state.players.entries()]
        .filter(
          ([, player]) =>
            player.role === "hider",
        )
        .map(
          ([sessionId, player]) => ({
            sessionId,
            x: player.x,
            y: player.y,
          }),
        );

    this.broadcast(
      "round_result",
      {
        winner,
        reason,
        revealedHiders,
        durationMs:
          this.resultDurationMs,
      },
    );

    this.updateRoomMetadata();
    this.broadcastPhaseChanged();

    const expectedFinishedEndsAt =
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
    );
  }

  private resetToLobby(): void {
    this.state.phase = "lobby";
    this.state.phaseEndsAt = 0;

    this.hunterDisconnectOutcomeGeneration += 1;
    this.allHiderDisconnectOutcomeGeneration += 1;
    this.hiderDisconnectGenerationBySessionId.clear();

    this.broadcastRoleDisconnectCountdown(
      "hunter",
      0,
      true,
    );
    this.broadcastRoleDisconnectCountdown(
      "hider",
      0,
      true,
    );

    /*
     * v0.10.10.230 GHOST PLAYER/HOST CLEANUP:
     * Reconnect reservations are useful during a round, but after a round
     * ends they must not become permanent lobby occupants. Remove every
     * state player whose transport is no longer live, then re-elect a live
     * host before the next game can start.
     */
    for (
      const sessionId of
      [...this.state.players.keys()]
    ) {
      if (
        this.liveSessionIds.has(
          sessionId,
        )
      ) {
        continue;
      }

      this.state.players.delete(
        sessionId,
      );
      this.clientKeyBySessionId.delete(
        sessionId,
      );
      this.paintReadySessionIds.delete(
        sessionId,
      );
      this.lastShotAt.delete(
        sessionId,
      );
      this.weaponHeatStates.delete(
        sessionId,
      );
      this.hunterRoundStats.delete(
        sessionId,
      );
      this.lobbyAvatarPresets.delete(
        sessionId,
      );
      this.roundPaintStrokes.delete(
        sessionId,
      );
    }

    this.ensureValidHost();
    this.state.hunterCount = 0;
    this.state.winner = "";
    /* V101071_LOBBY_SETTLE_RESET */
    this.lobbyStartAllowedAt = Date.now() + 1_000;
    /* V101069_READY_RESET */
    this.paintReadySessionIds.clear();

    /*
     * 선택값은 다음 라운드에도 유지하되,
     * RANDOM이면 다시 forest 미리보기로 돌아갑니다.
     */
    this.state.activeMap =
      this.state.selectedMap ===
        "random"
        ? "forest"
        : this.state.selectedMap;

    this.hunterRoundStats.clear();

    for (
      const [
        sessionId,
        player,
      ] of this.state.players
    ) {
      player.role = "hider";
      player.hunterVolunteer = false;
      player.alive = true;

      const lobbyPosition =
        this.getRandomLobbyPosition();

      player.x = lobbyPosition.x;
      player.y = lobbyPosition.y;

      this.weaponHeatStates.set(
        sessionId,
        {
          heat: 0,
          updatedAt: Date.now(),
          overheatedUntil: 0,
        },
      );
    }

    this.broadcast(
      "reset_round",
      {},
    );

    this.updateRoomMetadata();
    this.broadcastPhaseChanged();

    /*
     * v0.10.10.238.5:
     * A round can finish while every transport is still inside an active-round
     * reconnect reservation. resetToLobby() removes those offline players;
     * now dispose the resulting empty lobby as well.
     */
    this.disposeEmptyLobbySoon();
  }

  private getPaintReadyState(): {
    ready: number;
    total: number;
    readyCount: number;
    hiderCount: number;
    allHidersReady: boolean;
    readySessionIds: string[];
  } {
    const activeHiderIds =
      [...this.state.players.entries()]
        .filter(
          ([, player]) =>
            player.role === "hider" &&
            player.alive,
        )
        .map(
          ([sessionId]) =>
            sessionId,
        );

    const activeHiderSet =
      new Set(activeHiderIds);

    for (
      const sessionId of
      [...this.paintReadySessionIds]
    ) {
      if (!activeHiderSet.has(sessionId)) {
        this.paintReadySessionIds.delete(
          sessionId,
        );
      }
    }

    const readySessionIds =
      activeHiderIds.filter(
        (sessionId) =>
          this.paintReadySessionIds.has(
            sessionId,
          ),
      );

    const ready =
      readySessionIds.length;

    const total =
      activeHiderIds.length;

    return {
      ready,
      total,
      readyCount: ready,
      hiderCount: total,
      allHidersReady:
        total > 0 &&
        ready === total,
      readySessionIds,
    };
  }

  private sendPaintReadyState(client: Client): void {
    client.send("paint_ready_state", this.getPaintReadyState());
  }

  private broadcastPaintReadyState(): void {
    this.broadcast("paint_ready_state", this.getPaintReadyState());
  }

  private getHunterRoundStats(
    sessionId: string,
  ): HunterRoundStats {
    const existing =
      this.hunterRoundStats.get(
        sessionId,
      );

    if (existing) {
      return existing;
    }

    const created: HunterRoundStats = {
      reserve:
        this.maxHunterReserve,
      precisionPoints: 0,
      shotsFired: 0,
    };

    this.hunterRoundStats.set(
      sessionId,
      created,
    );

    return created;
  }

  private sendWeaponState(
    client: Client,
    heatState:
      WeaponHeatState,
    stats:
      HunterRoundStats,
  ): void {
    client.send(
      "weapon_state",
      {
        ...heatState,
        reserve:
          stats.reserve,
        maxReserve:
          this.maxHunterReserve,
        precisionPoints:
          stats.precisionPoints,
        shotsFired:
          stats.shotsFired,
      },
    );
  }

  private getUpdatedWeaponHeatState(
    sessionId: string,
    now: number,
  ): WeaponHeatState {
    const current =
      this.weaponHeatStates.get(
        sessionId,
      ) ?? {
        heat: 0,
        updatedAt: now,
        overheatedUntil: 0,
      };

    const elapsed =
      Math.max(
        0,
        now - current.updatedAt,
      );

    current.heat = Math.max(
      0,
      current.heat -
        elapsed *
          this.heatCooldownPerMs,
    );

    current.updatedAt = now;

    if (
      now >=
      current.overheatedUntil
    ) {
      current.overheatedUntil = 0;
    }

    return current;
  }

  private getTotalHunterReserve(): number {
    let totalReserve = 0;

    for (
      const [
        sessionId,
        player,
      ] of this.state.players
    ) {
      if (
        player.role !== "hunter" ||
        !player.alive
      ) {
        continue;
      }

      totalReserve +=
        this.getHunterRoundStats(
          sessionId,
        ).reserve;
    }

    return totalReserve;
  }

  private allHuntersOutOfAmmo(): boolean {
    const hunters =
      [
        ...this.state.players.values(),
      ].filter(
        (player) =>
          player.role === "hunter" &&
          player.alive,
      );

    return (
      hunters.length > 0 &&
      this.getTotalHunterReserve() <= 0
    );
  }

  private getAliveHiderCount(): number {
    return [
      ...this.state.players.values(),
    ].filter(
      (player) =>
        player.role === "hider" &&
        player.alive,
    ).length;
  }

  private distancePointToSegment(
    pointX: number,
    pointY: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): number {
    const dx = endX - startX;
    const dy = endY - startY;

    if (dx === 0 && dy === 0) {
      return Math.hypot(
        pointX - startX,
        pointY - startY,
      );
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        (
          (pointX - startX) * dx +
          (pointY - startY) * dy
        ) /
        (dx * dx + dy * dy),
      ),
    );

    const nearestX =
      startX + t * dx;

    const nearestY =
      startY + t * dy;

    return Math.hypot(
      pointX - nearestX,
      pointY - nearestY,
    );
  }

  private shuffle<T>(
    values: T[],
  ): T[] {
    const copy = [...values];

    for (
      let index =
        copy.length - 1;
      index > 0;
      index -= 1
    ) {
      const randomIndex =
        Math.floor(
          Math.random() *
            (index + 1),
        );

      [
        copy[index],
        copy[randomIndex],
      ] = [
        copy[randomIndex],
        copy[index],
      ];
    }

    return copy;
  }

  private getRandomLobbyPosition(): {
    x: number;
    y: number;
  } {
    return {
      x:
        90 +
        Math.random() * 560,
      y:
        170 +
        Math.random() * 300,
    };
  }

  private ensureValidHost(): void {
    /*
     * v0.10.10.230 GHOST HOST FIX:
     * During an active round a temporarily dropped host may remain in
     * state.players for reconnection. Once we are in the lobby, however,
     * only a player whose transport is currently live may own host rights.
     */
    const hostExists =
      Boolean(this.state.hostId) &&
      this.state.players.has(
        this.state.hostId,
      );

    const hostIsUsable =
      this.state.phase === "lobby"
        ? hostExists &&
          this.liveSessionIds.has(
            this.state.hostId,
          )
        : hostExists;

    if (hostIsUsable) {
      return;
    }

    const remainingSessionIds =
      [...this.state.players.keys()]
        .filter(
          (sessionId) =>
            this.state.phase !== "lobby" ||
            this.liveSessionIds.has(
              sessionId,
            ),
        );

    if (
      remainingSessionIds.length === 0
    ) {
      this.state.hostId = "";
      return;
    }

    const randomIndex =
      Math.floor(
        Math.random() *
          remainingSessionIds.length,
      );

    this.state.hostId =
      remainingSessionIds[
        randomIndex
      ];
  }

  private assignNewHost(): void {
    this.state.hostId = "";
    this.ensureValidHost();
  }
  onDispose(): void {
    this.liveSessionIds.clear();
    this.supersededSessionIds.clear();

    console.log(
      "[Color Hunt] room disposed",
      {
        roomId:
          this.roomId,
      },
    );
  }


  private updateRoomMetadata(): void {
    void this.setMetadata({
      roomTitle:
        this.state.roomTitle,
      isPrivate:
        this.state.isPrivate,
      playerCount:
        this.liveSessionIds.size,
      maxClients:
        this.maxClients,
      phase:
        this.state.phase,
      selectedMap:
        this.state.selectedMap,
      activeMap:
        this.state.activeMap,
    });
  }
}
