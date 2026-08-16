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

  private readonly countdownDurationMs =
    3_000;

  private lobbyStartAllowedAt = 0;

  private paintDurationMs =
    120_000;

  private huntDurationMs = 80_000;

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
        this.state.activeMap =
          `map${
            Math.floor(
              Math.random() * 11,
            ) + 1
          }`;
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

  onCreate(
    options: JoinOptions,
  ): void {
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
    };
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
                expiresAt:
                  Date.now() +
                  35_000,
              },
            );
          }

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

  async onDrop(
    client: Client,
    code: number,
  ): Promise<void> {
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

    try {
      /* V101075_RECONNECT_30S */
      await this.allowReconnection(
        client,
        30,
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
            35_000,
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
     * hostId가 비어 있거나 이미 나간 플레이어를 가리키면
     * 현재 첫 번째 플레이어를 즉시 방장으로 지정합니다.
     *
     * 이 로직은 서버가 authoritative하게 방장 상태를 보장하므로
     * 클라이언트의 hostId 복제 타이밍에 의존하지 않습니다.
     */
    if (
      this.state.hostId &&
      this.state.players.has(
        this.state.hostId,
      )
    ) {
      return;
    }

    const remainingSessionIds =
      [
        ...this.state.players.keys(),
      ];

    if (
      remainingSessionIds.length === 0
    ) {
      this.state.hostId = "";
      return;
    }

    /*
     * 기존 방장이 나갔을 때 남아 있는 플레이어 중 한 명에게
     * 방장 권한을 랜덤으로 넘깁니다.
     */
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

  private updateRoomMetadata(): void {
    void this.setMetadata({
      roomTitle:
        this.state.roomTitle,
      isPrivate:
        this.state.isPrivate,
      playerCount:
        this.state.players.size,
      maxClients:
        this.maxClients,
      phase:
        this.state.phase,
    });
  }
}
