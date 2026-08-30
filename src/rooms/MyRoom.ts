/* V1010554H_TRIPLE_TELEPORT_RANDOM_DESTINATIONS: generate three fresh nearby random destinations on every Triple Teleport cast. */
/* V1010554G_TRIPLE_TELEPORT_REAL_MOTION_SEQUENCE: three authoritative endpoints animated as high-speed moves, separate spin/pop, exact-origin return. */
/* V1010554F_TRIPLE_TELEPORT_SLOWER_TIMING: Triple Teleport cadence ~1.5x slower: readable 슉. 슉. 슉. -> 휘리릭 뾰옹~ -> origin. */
/* V1010554B_TRIPLE_TELEPORT_SERVER: authoritative Random Taunt + 3-step teleport + exact-origin terminal restore. */
/* V1010553_HARDENED_5POSE_HIT_DRAIN_SERVER */
/* V1010552_HIDER_HARDENED_SERVER: authoritative 15s invulnerability + movement lock + throttled TING. */
/* V1010549_RECONNECT_PAINT_FANOUT_LOAD_SHED_DIAG: remove reconnect-time full paint fan-out to peers; add server drop/reconnect diagnostics. */
/* V1010533_MULTI_HUNTER_VICTORY_KILL_ATTRIBUTION: shotgun/sniper/Vulcan found-Hider records carry Hunter sessionId + stable clientKey into victoryShowcase. */
/* V1010532B_VULCAN_RADIUS15_EXACT_SOURCE: authoritative random Vulcan impact center is radius 15px / diameter 30px around live mouse aim. */
/* V1010530_VULCAN_CIRCULAR_RANDOM_IMPACT: spotlight ellipse visual-only; damage follows server-random circular impacts. */
/* V1010526B_VULCAN_1P5X: authoritative tick 45ms->60ms; hitbox untouched. */
/* V1010524B_VULCAN_DOUBLE_ROF_SERVER: recursive authoritative Vulcan hit tick 90ms->45ms; elapsed-time heat remains 3s. */
/* V1010521G_VULCAN_SERVER_HEAT_RESULT_CLEAN_HIDER_OUTLINE_CURRENT_SOURCE: streams authoritative accumulated Vulcan HEAT every firing tick. */
/* V1010519_VULCAN_CONTINUOUS_HEAT_SPECTATOR_SYNC_DARK_ALIGN: authoritative accumulated Vulcan heat; partial rest cools, only 100% overheat locks for 3s. */
/* V1010510_VULCAN_HOLD_FIRE_CINEMATIC_SEARCHLIGHT: authoritative Vulcan hold-fire / proportional cooldown. */
/* V1010508_VULCAN_SEARCHLIGHT_COOLDOWN_CINEMATIC: selected Vulcan persists; 6s authoritative repeat-fire cooldown. */
/* V1010507_TACTICAL_VULCAN_AIR_SUPPORT: server-authoritative mutually-exclusive tactical support. */
/* V1010471_READY_DROP_SAFETY_ONLY: real transport drop cancels Lobby/Paint READY only; reconnect/player preservation remains unchanged. */
/* V1010452_SKILL_SYSTEM_FOUNDATION: role-neutral skill selection foundation; first Hider skills paintball/laser. */
/* V1010451G_FULL_ASSIST_VICTORY_HISTORY: retain complete Paint Help history for authoritative Hunter victory snapshots. */
/* V1010451D_LOBBY_READY_ROSTER_BROADCAST: broadcast authoritative READY roster on join/leave/reconnect. */
/* V1010451C_RESTORE_READY_CONTRACT_FIXED: fixed restoration of authoritative Lobby READY contract. */
/* V1010450ZF2_RECONNECT_LOOP_HOTFIX:
 * restore live-socket public listing + 8s Lobby reconnect window.
 */
/* V1010450ZF_RECONNECT_LOOP_HOTFIX: revert preserved-seat listing / 90s host Lobby reservation. */
import {
  Client,
  CloseCode,
  Room,
} from "colyseus";

import {
  MyRoomState,
  PlayerState,
} from "./schema/MyRoomState.js";

function PhaserMathClampServer(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(
      max,
      value,
    ),
  );
}


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

/* V1010453_SNIPER_SUPPORT_MODE */
type SniperToggleMessage = { active?: boolean };
type SniperAimMessage = { x?: number; y?: number };
type SniperFireMessage = { x?: number; y?: number };

type HiderHardenedTauntMessage = Record<string, never>;

/* V1010507_TACTICAL_VULCAN_AIR_SUPPORT */
type VulcanToggleMessage = { active?: boolean };
type VulcanAimMessage = { x?: number; y?: number };
type VulcanFireMessage = { x?: number; y?: number };
type VulcanFireStartMessage = Record<string, never>;
type VulcanFireStopMessage = Record<string, never>;

type FartUseMessage = {
  pressedAt?: number;
};

type PlayerSkillId =
  | "paintball"
  | "laser";

type SkillSelectMessage = {
  skillId?: PlayerSkillId;
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

/* V1010450ZE_MINIMIZED_HOST_LISTING_GRACE: preserve public Lobby listing during temporary minimized-host reconnect. */
export class MyRoom extends Room {
  /* V1010390_SERVER_MAP12_16_SAFE_RECOVERY: map1..map16 restored; forest remains lobby-only. */
  /* V1010388_SERVER_VICTORY_SHOWCASE: victory snapshot metadata for social-result cards. */
  /* V1010366B_PAINT_HUNT_RECONNECT_BARRIER_EXACT: Paint->Hunt waits for a stable live roster and reconnect convergence. */
  /* V1010364S_P0_MULTIPLAYER_STABILITY: short lobby ghost grace, live-start authority, lower recovery chatter. */
  /* V1010345S_DISCONNECT_GRACE_HARDENING: tolerate transient transport loss before changing round outcome. */
  /* V1010341S_SERVER_PAINT_STABILITY_SAFE: authoritative full-paint restore retained through Hunt. */
  /* V1010339S_FULL_PAINT_SERVER: authoritative full camouflage restore cap = 500 strokes. */
  /* V1010307_SERVER_AUTHORITATIVE_GAS_TARGET: fart_state/poop_burst carry authoritative 36/72/100 GAS destination. */
  /* V1010306_SERVER_GAS_THIRD_STAYS_MAX: 1st drains to36, 2nd drains to72, 3rd stays MAX and detector locks. */
  /* V1010304_SERVER_FINAL_GAS_DRAIN: no GAS zero-then-refill snap; poop drains directly to its escalation floor. */
  /* V1010302B_SERVER_FART_PROGRESSION_LOCK_RECOVER: 3 farts -> poop, then 2 -> poop, then 1 -> poop, then locked until next round. */
  /* V1010300_SERVER_EMPTY_ROOM_HARD_DISPOSE: zero-live-client public rooms are hidden immediately and disposed aggressively. */
  /* V1010297B_POST_ROUND_RECONNECT_RESTORE_RECOVER: recover a reserved player whose Schema actor was removed at round reset. */
  /* V1010285_AVATAR_PRESET_FULL_POINTS: keep complete lobby avatar paint when broadcasting to waiting room. */
  /* V1010282_FART_RADIUS_110: authoritative 360-degree fart detection radius = 110. */
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
   * V1010451M5S_SERVER_INTENTIONAL_LOBBY_LEAVE_GHOST_FIX_ROOT_ROBUST
   * Explicit Lobby exits bypass temporary reconnect reservation.
   */
  private readonly intentionalLeaveSessionIds =
    new Set<string>();

  /*
   * V1010452S3_STALE_EMPTY_LOBBY_LOCK
   *
   * True only while a Lobby has zero REAL transports but is still alive for
   * the proven 8-second same-session reconnect reservation.
   * Fresh onJoin must never revive this stale shell.
   */
  private staleEmptyLobbyLocked = false;

  /*
   * V1010366B_PAINT_HUNT_RECONNECT_BARRIER_EXACT
   *
   * The recorded failure showed server phase/timer continuing into Hunt while
   * the live roster / paint transport was still converging after a disconnect.
   * Treat transport membership changes as a short critical section.
   */
  private connectionTopologyChangedAt =
    0;

  private readonly paintHuntTopologySettleMs =
    2_000;

  private markConnectionTopologyChanged():
    void {
    this.connectionTopologyChangedAt =
      Date.now();
  }

  private isPaintHuntTopologySettled(
    now = Date.now(),
  ): boolean {
    return (
      now -
        this.connectionTopologyChangedAt >=
      this.paintHuntTopologySettleMs
    );
  }

  private getRoundAliveHiderIds():
    string[] {
    return [...this.state.players.entries()]
      .filter(
        ([, player]) =>
          player.role === "hider" &&
          player.alive,
      )
      .map(
        ([sessionId]) =>
          sessionId,
      );
  }

  private canEnterHuntFromPaint(
    now = Date.now(),
  ): boolean {
    if (
      this.state.phase !== "paint" ||
      !this.isPaintHuntTopologySettled(
        now,
      )
    ) {
      return false;
    }

    const roundHiderIds =
      this.getRoundAliveHiderIds();

    if (roundHiderIds.length < 1) {
      return false;
    }

    /*
     * A reconnect-reserved Hider remains in state.players, but MUST NOT allow
     * Paint -> Hunt until its actual transport is live again (or existing
     * disconnect-outcome logic resolves/removes it).
     */
    return roundHiderIds.every(
      (sessionId) =>
        this.liveSessionIds.has(
          sessionId,
        ) &&
        !this.supersededSessionIds.has(
          sessionId,
        ),
    );
  }

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
     * V1010450ZF2_LIVE_SOCKET_LISTING_AUTHORITY
     *
     * Public room visibility follows REAL live transports only.
     * Reconnect-preserved state.players must not advertise a room when
     * no socket is actually connected.
     */
    const liveCount =
      this.liveSessionIds.size;

    const shouldHide =
      this.state.isPrivate ||
      liveCount === 0;

    this.setPrivate(
      shouldHide,
    );

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

  /*
   * V1010297B_POST_ROUND_RECONNECT_RESTORE_RECOVER
   * Preserve identity for a player removed by Finished -> Lobby while
   * its Colyseus reconnection reservation is still alive.
   */
  private readonly postRoundReconnectBySessionId =
    new Map<
      string,
      {
        name: string;
        clientKey: string;
        avatar: any[];
        expiresAt: number;
      }
    >();

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

  /*
   * V1010345S_DISCONNECT_GRACE_HARDENING
   *
   * Mobile/Wi-Fi/browser transport stalls of 10-15s are unfortunately common
   * enough that they must not decide a live round. Give the SAME player/session
   * 25s of silent recovery, then retain the existing 5s visible countdown.
   * Total gameplay outcome grace = 30s.
   */
  private readonly disconnectSilentGraceMs =
    25_000;
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

  /* V1010453_SNIPER_SUPPORT_MODE */
  private readonly sniperActiveHunters = new Set<string>();
  private readonly lastSniperAimAt = new Map<string, number>();
  private readonly lastSniperFireAt = new Map<string, number>();
  private readonly sniperAvailableRemainingMs = 30_000;
  private readonly sniperWarningRemainingMs = 35_000;
  /* V1010453E_SNIPER_2S_RELOAD */
  private readonly sniperReloadMs = 2_000;
  private readonly sniperHitRadius = 20;

  /* V1010552_HIDER_RANDOM_TAUNT_HARDENED */
  private readonly hardenedHiderEndsAt = new Map<string, number>();
  private readonly hardenedHiderPose = new Map<string, number>();
  private readonly lastHardenedHitFxAt = new Map<string, number>();
  private readonly hiderHardenedDurationMs = 15_000;
  private readonly hiderHardenedHitFxCooldownMs = 200;

  /* V1010554B_TRIPLE_TELEPORT_SERVER: authoritative Hider Triple Teleport state. */
  private readonly tripleTeleportActiveHiders = new Set<string>();
  private readonly tripleTeleportGeneration = new Map<string, number>();
  private readonly tripleTeleportOriginByHider = new Map<string, { x: number; y: number }>();

  /* V1010507_TACTICAL_VULCAN_AIR_SUPPORT: support choice is mutually exclusive per hunter/round. */
  private readonly vulcanActiveHunters = new Set<string>();
  private readonly tacticalSupportCommittedHunters = new Set<string>();
  private readonly lastVulcanAimAt = new Map<string, number>();
  private readonly lastVulcanFireAt = new Map<string, number>();
  private readonly vulcanDurationMs = 3_000;
  private readonly vulcanCooldownMs = 6_000;
  private readonly vulcanHitRadiusX = 105;
  private readonly vulcanHitRadiusY = 66;
  private readonly vulcanAimByHunter = new Map<string, { x: number; y: number }>();
  private readonly vulcanFiringStartedAt = new Map<string, number>();
  private readonly vulcanHeatByHunter = new Map<string, number>();
  private readonly vulcanHeatUpdatedAt = new Map<string, number>();

  private readonly vulcanCoolingUntil = new Map<string, number>();
  private readonly vulcanFireGeneration = new Map<string, number>();


  private readonly weaponHeatStates =
    new Map<string, WeaponHeatState>();

  private readonly hunterRoundStats =
    new Map<string, HunterRoundStats>();

  private readonly lobbyReadySessionIds =
    new Set<string>();

  private readonly paintReadySessionIds =
    new Set<string>();

  /*
   * V1010452_SKILL_SYSTEM_FOUNDATION
   * Skill ownership follows stable clientKey so reconnect/session handoff
   * keeps the same selection. Only the owner receives its selection packet.
   */
  private readonly selectedSkillByClientKey =
    new Map<string, PlayerSkillId>();

  private lastPaintReadyPulseAt = 0;

  private readonly maxHunterReserve = 12;

  /* V1010242_HUNTER_FART_SKILL: server-authoritative comedy detector. */
  private readonly fartRadius = 110;
  /* V1010247_FART_ULTIMATE_BALANCE: GAS is now danger/pressure, not remaining fuel. */
  private readonly fartCost = 36;
  /*
   * V1010302B_SERVER_FART_PROGRESSION_LOCK_RECOVER
   *
   * Round progression:
   * accident 0 -> floor 0  : 3 farts
   * accident 1 -> floor 36 : 2 farts
   * accident 2 -> floor 72 : 1 fart
   * accident 3 -> fart locked until next round
   */
  private readonly fartAccidentCountByHunter =
    new Map<string, number>();

  private readonly fartLockedHunters =
    new Set<string>();

  /*
   * V1010281_FART_SERVER_COOLDOWN: authoritative anti-spam cadence.
   * Client also throttles for UX, but the server is the final guard.
   */
  private readonly fartUseCooldownMs = 900;
  private readonly lastFartUseAtByHunter =
    new Map<string, number>();
  private readonly fartRegenPerSecond = 0.75;
  private readonly poopDurationMs = 5_000;
  private readonly fartGaugeByHunter = new Map<string, number>();
  private readonly fartGaugeUpdatedAt = new Map<string, number>();
  private readonly poopUntilByHunter = new Map<string, number>();
  private readonly lastFartStateSentAt = new Map<string, number>();
  private readonly poopLaughTriggeredHunters = new Set<string>();


  private readonly heatPerShot = 34;
  private readonly heatCooldownPerMs = 0.025;
  private readonly overheatDurationMs = 2_500;


  private updateVulcanHeat(
    sessionId: string,
    now: number,
    firing: boolean,
  ): number {
    const previousHeat =
      PhaserMathClampServer(
        this.vulcanHeatByHunter.get(
          sessionId,
        ) ??
        0,
        0,
        1,
      );

    const lastUpdatedAt =
      this.vulcanHeatUpdatedAt.get(
        sessionId,
      ) ??
      now;

    const elapsed =
      Math.max(
        0,
        Math.min(
          3_000,
          now -
            lastUpdatedAt,
        ),
      );

    let nextHeat =
      firing
        ? previousHeat +
          elapsed /
            3_000
        : previousHeat -
          elapsed /
            3_000;

    nextHeat =
      PhaserMathClampServer(
        nextHeat,
        0,
        1,
      );

    this.vulcanHeatByHunter.set(
      sessionId,
      nextHeat,
    );

    this.vulcanHeatUpdatedAt.set(
      sessionId,
      now,
    );

    return nextHeat;
  }

  private stopVulcanHoldFire(
    sessionId: string,
    now = Date.now(),
    overheated = false,
  ): void {
    const startedAt =
      this.vulcanFiringStartedAt.get(
        sessionId,
      );

    if (!startedAt) {
      return;
    }

    const heat =
      this.updateVulcanHeat(
        sessionId,
        now,
        true,
      );

    this.vulcanFiringStartedAt.delete(
      sessionId,
    );

    this.vulcanFireGeneration.set(
      sessionId,
      (
        this.vulcanFireGeneration.get(
          sessionId,
        ) ??
        0
      ) +
      1,
    );

    const isOverheated =
      overheated ||
      heat >=
        0.999;

    const cooldownMs =
      isOverheated
        ? 3_000
        : 0;

    const readyAt =
      now +
      cooldownMs;

    if (
      isOverheated
    ) {
      this.vulcanHeatByHunter.set(
        sessionId,
        1,
      );

      this.vulcanHeatUpdatedAt.set(
        sessionId,
        now,
      );

      this.vulcanCoolingUntil.set(
        sessionId,
        readyAt,
      );
    } else {
      this.vulcanCoolingUntil.delete(
        sessionId,
      );
    }

    this.broadcast(
      'vulcan_firing',
      {
        shooterId:
          sessionId,
        active:
          false,
        startedAt,
        heldMs:
          Math.max(
            0,
            now -
              startedAt,
          ),
        cooldownMs,
        readyAt,
        serverNow:
          now,
        heat:
          isOverheated
            ? 1
            : heat,
      },
    );
  }

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
        lobbyReadyState:
          this.getLobbyReadyState(),
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

  /*
   * V1010388_SERVER_VICTORY_SHOWCASE
   * Keep the exact place/order where each Hider was found.
   * This survives only until the round result card has been delivered.
   */
  private readonly victoryFoundHiders:
    Array<{
      sessionId: string;
      name: string;
      x: number;
      y: number;
      foundOrder: number;
      foundAt: number;
      /* V1010533_MULTI_HUNTER_VICTORY_KILL_ATTRIBUTION: authoritative personal-kill owner. */
      foundByHunterSessionId: string;
      foundByHunterClientKey: string;
    }> = [];

  messages = {
    /*
     * V1010451M5S_SERVER_INTENTIONAL_LOBBY_LEAVE_GHOST_FIX_ROOT_ROBUST / LEAVE_INTENT
     */
    leave_room_intent: (
      client: Client,
    ): void => {
      if (
        this.state.phase !== "lobby" ||
        !this.state.players.has(
          client.sessionId,
        )
      ) {
        return;
      }

      this.intentionalLeaveSessionIds.add(
        client.sessionId,
      );
    },


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
          .slice(0, 120) /* V101023837_SERVER_PAINT_STABILITY: preserve full editor preset */
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
                .slice(0, 600)
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
      /* V101023837_SERVER_PAINT_STABILITY: both paint roles may restore camouflage after reconnect. */
      if (
        !player ||
        (
          player.role !== "hunter" &&
          player.role !== "hider"
        )
      ) {
        return;
      }

      const raw =
        Array.isArray(
          payload?.strokes,
        )
          ? payload.strokes
              /*
               * V1010339S_FULL_PAINT_SERVER
               * Dense complete-body camouflage can exceed 240 strokes.
               */
              .slice(0, 500)
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
       * Spam protection (V1010451M7_SERVER_CHAT_SPAM_RELAX):
       * - accidental same-message duplicate within 650ms is silently ignored
       * - other messages faster than 300ms are blocked
       * - max 8 accepted messages / 10 seconds
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

      /*
       * V1010451M7_SERVER_CHAT_SPAM_RELAX
       *
       * Accidental duplicate submit (Enter/click firing twice) is ignored
       * silently instead of showing a false "spam" warning.
       */
      if (
        previous &&
        previous.text ===
          comparable &&
        now -
          previous.sentAt <
          650
      ) {
        return;
      }

      /*
       * Real flood protection remains, but normal conversation is less strict.
       */
      if (
        now - latest <
          300 ||
        timestamps.length >=
          8
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

    lobby_ready: (
      client: Client,
      payload: {
        ready?: boolean;
      },
    ): void => {
      this.ensureValidHost();

      if (
        this.state.phase !== "lobby" ||
        client.sessionId === this.state.hostId ||
        !this.state.players.has(client.sessionId) ||
        this.supersededSessionIds.has(client.sessionId) ||
        !this.clients.some(
          (connectedClient) =>
            connectedClient.sessionId === client.sessionId,
        )
      ) {
        return;
      }

      if (Boolean(payload?.ready)) {
        this.lobbyReadySessionIds.add(
          client.sessionId,
        );
      } else {
        this.lobbyReadySessionIds.delete(
          client.sessionId,
        );
      }

      this.broadcastLobbyReadyState();
    },

    request_lobby_ready_state: (
      client: Client,
    ): void => {
      this.sendLobbyReadyState(client);
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
        !player.alive ||
        (
          player.role === "hunter" &&
          (this.sniperActiveHunters.has(client.sessionId) || this.vulcanActiveHunters.has(client.sessionId))
        ) ||
        (player.role === "hider" && (this.isHiderHardened(client.sessionId) || this.tripleTeleportActiveHiders.has(client.sessionId)))
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

      /*
       * V1010390_SERVER_MAP12_16_SAFE_RECOVERY
       * forest is lobby-only and must never be accepted as a playable map.
       * Valid round maps: map1..map16, plus "random".
       */
      const valid =
        requested === "random" ||
        /^map(?:[1-9]|1[0-6])$/.test(
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

      /*
       * V1010364S_P0_MULTIPLAYER_STABILITY
       * state.players can intentionally contain reconnect-reserved actors.
       * A browser that was simply closed must never count toward a new round.
       */
      const liveLobbyPlayerIds =
        [...this.liveSessionIds]
          .filter(
            (sessionId) =>
              this.state.players.has(
                sessionId,
              ) &&
              !this.supersededSessionIds.has(
                sessionId,
              ),
          );

      if (liveLobbyPlayerIds.length < 2) {
        client.send(
          "start_game_error",
          {
            message:
              "게임 시작에는 현재 접속 중인 플레이어가 최소 2명 필요합니다.",
          },
        );

        return;
      }

      const lobbyReadyState =
        this.getLobbyReadyState();

      if (!lobbyReadyState.canStart) {
        client.send(
          "start_game_error",
          {
            message:
              "아직 준비하지 않은 플레이어가 있습니다.",
          },
        );
        this.sendLobbyReadyState(client);
        return;
      }

      /*
       * Defensive cleanup before role assignment. Normally lobby onDrop removes
       * these after the short grace below, but START must be authoritative even
       * if the user presses it during that grace window.
       */
      for (
        const sessionId of
        [...this.state.players.keys()]
      ) {
        if (
          liveLobbyPlayerIds.includes(
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
        this.lobbyAvatarPresets.delete(
          sessionId,
        );
        this.roundPaintStrokes.delete(
          sessionId,
        );
      }

      this.ensureValidHost();
      this.updateRoomMetadata();

      /*
       * 모든 클라이언트가 반드시 동일한 맵을 사용하도록
       * RANDOM 판정은 서버에서 딱 한 번 수행합니다.
       */
      if (
        this.state.selectedMap ===
          "random"
      ) {
        /*
         * Pick from all 16 playable maps except the map used by the
         * immediately previous RANDOM round. Forest is lobby-only and is
         * intentionally excluded. This guarantees RANDOM never gives the same
         * map twice in a row while keeping every playable map equally likely.
         */
        const randomCandidates =
          Array.from(
            {
              length: 16,
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


    fart_use: (
      client: Client,
      _message: FartUseMessage,
    ): void => {
      if (
        this.state.phase !==
        'hunt'
      ) {
        return;
      }

      const hunter =
        this.state.players.get(
          client.sessionId,
        );

      if (
        !hunter ||
        hunter.role !==
          'hunter' ||
        !hunter.alive
      ) {
        return;
      }

      const now =
        Date.now();

      const existingPoopUntil =
        this.poopUntilByHunter.get(
          client.sessionId,
        ) ?? 0;

      if (
        existingPoopUntil >
        now
      ) {
        return;
      }
      /*
       * V1010386C_SERVER_SIMPLE_THREE_FART_CYCLE_CURRENT_SAFE
       * No permanent fart lock. poopUntil is the only temporary lock.
       */


      
      const previousFartUseAt =
        this.lastFartUseAtByHunter.get(
          client.sessionId,
        ) ?? 0;

      if (
        now -
          previousFartUseAt <
        this.fartUseCooldownMs
      ) {
        return;
      }

      /*
       * Record before gauge calculation so duplicate/rapid packets cannot
       * consume multiple GAS charges in the same burst.
       */
      this.lastFartUseAtByHunter.set(
        client.sessionId,
        now,
      );

const gauge =
        this.getUpdatedFartGauge(
          client.sessionId,
          now,
        );

      const nextGauge =
        gauge +
        this.fartCost;

      const willPoop =
        nextGauge >= 100;

      const appliedGauge =
        Math.min(
          100,
          nextGauge,
        );

      this.fartGaugeByHunter.set(
        client.sessionId,
        appliedGauge,
      );

      this.fartGaugeUpdatedAt.set(
        client.sessionId,
        now,
      );

      const soundTier =
        appliedGauge >= 72
          ? 3
          : appliedGauge >= 36
            ? 2
            : 1;

      /*
       * Third press is still a real fart.
       * Burst + Hider cough + Hunter ! happen BEFORE the accident.
       */
      this.broadcast(
        'fart_burst',
        {
          hunterId:
            client.sessionId,
          x:
            hunter.x,
          y:
            hunter.y,
          radius:
            this.fartRadius,
          soundTier,
        },
      );

      let detected =
        false;

      this.state.players.forEach(
        (
          hider,
          hiderId,
        ) => {
          if (
            hider.role !==
              'hider' ||
            !hider.alive
          ) {
            return;
          }

          const distance =
            Math.hypot(
              hunter.x -
                hider.x,
              hunter.y -
                hider.y,
            );

          if (
            distance >
            this.fartRadius
          ) {
            return;
          }

          detected =
            true;

          this.broadcast(
            'hider_cough',
            {
              hunterId:
                client.sessionId,
              hiderId,
              x:
                hider.x,
              y:
                hider.y,
            },
          );
        },
      );

      if (detected) {
        client.send(
          'fart_detected',
          {
            reaction:
              'cough',
          },
        );
      }

      if (willPoop) {
        const poopUntil =
          now +
          this.poopDurationMs;

        /*
         * V1010386C_SERVER_SIMPLE_THREE_FART_CYCLE_CURRENT_SAFE
         * Third fart causes one accident, then reset immediately.
         */
        this.fartAccidentCountByHunter.set(
          client.sessionId,
          0,
        );

        this.fartLockedHunters.delete(
          client.sessionId,
        );

        this.fartGaugeByHunter.set(
          client.sessionId,
          0,
        );

        this.fartGaugeUpdatedAt.set(
          client.sessionId,
          now,
        );

        this.poopUntilByHunter.set(
          client.sessionId,
          poopUntil,
        );

        this.poopLaughTriggeredHunters.delete(
          client.sessionId,
        );

        this.broadcast(
          'poop_burst',
          {
            hunterId:
              client.sessionId,
            hunterName:
              hunter.name,
            x:
              hunter.x,
            y:
              hunter.y,
            poopUntil,
            serverNow:
              now,
            targetGauge:
              this.getFartPostPoopFloor(
                client.sessionId,
              ),
            accidentCount: 0,
            locked: false,
            /*
             * V1010266_SERVER_POOP_DETECTED_FLAG: client must not infer combo from message timing.
             */
            detected,
          },
        );
      }

      this.sendFartState(
        client,
        now,
      );
    },

    /* V1010453_SNIPER_SUPPORT_MODE */
    /* V1010554B_TRIPLE_TELEPORT_SERVER: Random Taunt router + test-only Triple Teleport trigger. */
    hider_random_taunt: (client: Client): void => {
      const hider=this.state.players.get(client.sessionId);
      if(
        this.state.phase!=="hunt" ||
        !hider ||
        hider.role!=="hider" ||
        !hider.alive ||
        this.isHiderHardened(client.sessionId) ||
        this.tripleTeleportActiveHiders.has(client.sessionId)
      ) return;

      if(Math.random()<0.5){
        this.handleHiderHardenedTaunt(client);
      }else{
        this.startHiderTripleTeleport(client);
      }
    },

    hider_triple_teleport_test: (client: Client): void => {
      this.startHiderTripleTeleport(client);
    },

    hider_hardened_taunt: (client: Client, _message: HiderHardenedTauntMessage): void => {
      this.handleHiderHardenedTaunt(client);
    },

    sniper_toggle: (
      client: Client,
      message: SniperToggleMessage,
    ): void => {
      if (this.state.phase !== "hunt") return;

      const hunter = this.state.players.get(client.sessionId);
      if (!hunter || hunter.role !== "hunter" || !hunter.alive) return;

      const remainingMs = Math.max(0, this.state.phaseEndsAt - Date.now());
      const wantsActive = Boolean(message?.active);

      if (wantsActive && remainingMs > this.sniperAvailableRemainingMs) {
        client.send("sniper_state", {
          sessionId: client.sessionId,
          active: false,
          available: false,
          remainingMs,
          serverNow: Date.now(),
        });
        return;
      }

      if (wantsActive) {
        if (this.tacticalSupportCommittedHunters.has(client.sessionId)) return;
        this.tacticalSupportCommittedHunters.add(client.sessionId);
        this.vulcanActiveHunters.delete(client.sessionId);
        this.sniperActiveHunters.add(client.sessionId);
      } else {
        this.sniperActiveHunters.delete(client.sessionId);
      }

      this.broadcast("sniper_state", {
        sessionId: client.sessionId,
        active: wantsActive,
        available: remainingMs <= this.sniperAvailableRemainingMs,
        remainingMs,
        serverNow: Date.now(),
      });
    },

    sniper_aim: (
      client: Client,
      message: SniperAimMessage,
    ): void => {
      if (
        this.state.phase !== "hunt" ||
        !this.sniperActiveHunters.has(client.sessionId)
      ) return;

      const hunter = this.state.players.get(client.sessionId);
      if (!hunter || hunter.role !== "hunter" || !hunter.alive) return;

      const x = Number(message?.x);
      const y = Number(message?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const now = Date.now();
      const previous = this.lastSniperAimAt.get(client.sessionId) ?? 0;
      if (now - previous < 66) return;
      this.lastSniperAimAt.set(client.sessionId, now);

      this.broadcast("sniper_aim", {
        sessionId: client.sessionId,
        x: Math.max(0, Math.min(960, x)),
        y: Math.max(0, Math.min(540, y)),
      });
    },

    sniper_fire: (
      client: Client,
      message: SniperFireMessage,
    ): void => {
      if (
        this.state.phase !== "hunt" ||
        !this.sniperActiveHunters.has(client.sessionId)
      ) return;

      const hunter = this.state.players.get(client.sessionId);
      if (!hunter || hunter.role !== "hunter" || !hunter.alive) return;

      const remainingMs = Math.max(0, this.state.phaseEndsAt - Date.now());
      if (remainingMs > this.sniperAvailableRemainingMs) return;

      const x = Math.max(0, Math.min(960, Number(message?.x)));
      const y = Math.max(0, Math.min(540, Number(message?.y)));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const now = Date.now();
      const previous = this.lastSniperFireAt.get(client.sessionId) ?? 0;
      if (now - previous < this.sniperReloadMs) {
        client.send("sniper_reload", {
          readyAt: previous + this.sniperReloadMs,
          serverNow: now,
        });
        return;
      }
      this.lastSniperFireAt.set(client.sessionId, now);

      let hitId = "";
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const [sessionId, target] of this.state.players) {
        if (target.role !== "hider" || !target.alive) continue;
        const distance = Math.hypot(target.x - x, target.y - y);
        if (distance <= this.sniperHitRadius && distance < bestDistance) {
          bestDistance = distance;
          hitId = sessionId;
        }
      }

      if (hitId && this.isHiderHardened(hitId)) { this.broadcastHardenedHit(hitId, x, y); hitId = ""; }

      if (hitId) {
        const target = this.state.players.get(hitId);
        if (target && target.role === "hider" && target.alive) {
          if (!this.victoryFoundHiders.some((entry) => entry.sessionId === hitId)) {
            this.victoryFoundHiders.push({
              sessionId: hitId,
              name: String(target.name ?? "Hider").slice(0, 32),
              x: target.x,
              y: target.y,
              foundOrder: this.victoryFoundHiders.length + 1,
              foundAt: now,
              foundByHunterSessionId:
                client.sessionId,
              foundByHunterClientKey:
                this.clientKeyBySessionId.get(client.sessionId) ??
                client.sessionId,
            });
          }
          target.alive = false;
        }
      }

      this.broadcast("sniper_fired", {
        shooterId: client.sessionId,
        x,
        y,
        hitId,
        readyAt: now + this.sniperReloadMs,
        serverNow: now,
      });

      if (hitId && this.getAliveHiderCount() === 0) {
        this.finishGame("hunters");
      }
    },

    /* V1010507_TACTICAL_VULCAN_AIR_SUPPORT: area-search alternative to sniper. */
    vulcan_toggle: (
      client: Client,
      message: VulcanToggleMessage,
    ): void => {
      if (this.state.phase !== 'hunt') return;
      const hunter = this.state.players.get(client.sessionId);
      if (!hunter || hunter.role !== 'hunter' || !hunter.alive) return;
      const remainingMs = Math.max(0, this.state.phaseEndsAt - Date.now());
      const wantsActive = Boolean(message?.active);
      if (wantsActive && remainingMs > this.sniperAvailableRemainingMs) return;

      if (wantsActive) {
        if (this.tacticalSupportCommittedHunters.has(client.sessionId)) return;
        this.tacticalSupportCommittedHunters.add(client.sessionId);
        this.sniperActiveHunters.delete(client.sessionId);
        this.vulcanActiveHunters.add(client.sessionId);
      } else {
        this.vulcanActiveHunters.delete(client.sessionId);
      }

      this.broadcast('vulcan_state', {
        sessionId: client.sessionId,
        active: wantsActive,
        available: remainingMs <= this.sniperAvailableRemainingMs,
        remainingMs,
        serverNow: Date.now(),
      });
    },

    vulcan_aim: (
      client: Client,
      message: VulcanAimMessage,
    ): void => {
      if (this.state.phase !== 'hunt' || !this.vulcanActiveHunters.has(client.sessionId)) return;
      const hunter = this.state.players.get(client.sessionId);
      if (!hunter || hunter.role !== 'hunter' || !hunter.alive) return;
      const x = Number(message?.x);
      const y = Number(message?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const now = Date.now();
      const previous = this.lastVulcanAimAt.get(client.sessionId) ?? 0;
      if (now - previous < 66) return;
      this.lastVulcanAimAt.set(client.sessionId, now);
      const aimX = Math.max(0, Math.min(960, x));
      const aimY = Math.max(0, Math.min(540, y));
      this.vulcanAimByHunter.set(client.sessionId, { x: aimX, y: aimY });
      this.broadcast('vulcan_aim', {
        sessionId: client.sessionId,
        x: aimX,
        y: aimY,
      });
    },

    vulcan_fire_start: (
      client: Client,
      _message: VulcanFireStartMessage,
    ): void => {
      if (
        this.state.phase !== 'hunt' ||
        !this.vulcanActiveHunters.has(client.sessionId)
      ) return;

      const hunter =
        this.state.players.get(
          client.sessionId,
        );

      if (
        !hunter ||
        hunter.role !== 'hunter' ||
        !hunter.alive
      ) return;

      const now =
        Date.now();

      const heat =
        this.updateVulcanHeat(
          client.sessionId,
          now,
          false,
        );

      if (
        heat >= 0.999 ||
        (this.vulcanCoolingUntil.get(client.sessionId) ?? 0) > now ||
        this.vulcanFiringStartedAt.has(client.sessionId)
      ) {
        return;
      }

      this.vulcanFiringStartedAt.set(
        client.sessionId,
        now,
      );

      this.vulcanHeatUpdatedAt.set(
        client.sessionId,
        now,
      );

      const generation =
        (
          this.vulcanFireGeneration.get(
            client.sessionId,
          ) ??
          0
        ) +
        1;

      this.vulcanFireGeneration.set(
        client.sessionId,
        generation,
      );

      this.broadcast(
        'vulcan_firing',
        {
          shooterId:
            client.sessionId,
          active:
            true,
          startedAt:
            now,
          heldMs:
            0,
          cooldownMs:
            0,
          readyAt:
            now,
          serverNow:
            now,
          heat,
        },
      );

      const tick =
        (): void => {
          if (
            this.state.phase !==
              'hunt' ||
            !this.vulcanActiveHunters.has(
              client.sessionId,
            ) ||
            this.vulcanFireGeneration.get(
              client.sessionId,
            ) !==
              generation
          ) {
            return;
          }

          const startedAt =
            this.vulcanFiringStartedAt.get(
              client.sessionId,
            );

          if (!startedAt) {
            return;
          }

          const tickNow =
            Date.now();

          const heatNow =
            this.updateVulcanHeat(
              client.sessionId,
              tickNow,
              true,
            );

          /*
           * V521 SERVER_HEAT_STREAM:
           * UI and damage authority share this exact accumulated HEAT.
           */
          this.broadcast(
            'vulcan_firing',
            {
              shooterId:
                client.sessionId,
              active:
                true,
              startedAt,
              heldMs:
                Math.max(
                  0,
                  tickNow -
                    startedAt,
                ),
              cooldownMs:
                0,
              readyAt:
                tickNow,
              serverNow:
                tickNow,
              heat:
                heatNow,
            },
          );

          const aim =
            this.vulcanAimByHunter.get(
              client.sessionId,
            ) ??
            {
              x: 480,
              y: 270,
            };

          /*
           * V1010530_VULCAN_CIRCULAR_RANDOM_IMPACT
           *
           * IMPORTANT:
           * - The animated spotlight ellipse remains 100% VISUAL.
           * - Damage no longer uses vulcanHitRadiusX/Y.
           * - Every authoritative 60ms tick chooses ONE random impact point
           *   inside a small circle around the live mouse aim.
           * - The SAME impact coordinate is broadcast to clients and used
           *   for the actual Hider hit test.
           */
          const spreadRadius =
            15;

          const hitRadius =
            22;

          const angle =
            Math.random() *
            Math.PI *
            2;

          // sqrt() makes random points uniform across the circle's AREA.
          const distance =
            Math.sqrt(
              Math.random(),
            ) *
            spreadRadius;

          const impactX =
            Math.max(
              0,
              Math.min(
                960,
                aim.x +
                  Math.cos(
                    angle,
                  ) *
                    distance,
              ),
            );

          const impactY =
            Math.max(
              0,
              Math.min(
                540,
                aim.y +
                  Math.sin(
                    angle,
                  ) *
                    distance,
              ),
            );

          /*
           * One authoritative visual/damage coordinate.
           * Existing clients that don't listen to this packet simply ignore it;
           * the server hit logic below remains authoritative.
           */
          this.broadcast(
            'vulcan_fired',
            {
              shooterId:
                client.sessionId,
              x:
                impactX,
              y:
                impactY,
              radius:
                hitRadius,
              serverNow:
                tickNow,
            },
          );

          const hitRadiusSq =
            hitRadius *
            hitRadius;

          for (
            const [
              sessionId,
              target,
            ] of
            this.state.players
          ) {
            if (
              target.role !==
                'hider' ||
              !target.alive
            ) {
              continue;
            }

            const dx =
              target.x -
              impactX;

            const dy =
              target.y -
              impactY;

            if (
              dx * dx +
                dy * dy >
              hitRadiusSq
            ) {
              continue;
            }

            if (this.isHiderHardened(sessionId, tickNow)) {
              this.broadcastHardenedHit(sessionId, impactX, impactY);
              continue;
            }

            target.alive =
              false;

            if (
              !this.victoryFoundHiders.some(
                (
                  entry,
                ) =>
                  entry.sessionId ===
                  sessionId,
              )
            ) {
              this.victoryFoundHiders.push({
                sessionId,
                name:
                  String(
                    target.name ??
                      'Hider',
                  ).slice(
                    0,
                    32,
                  ),
                x:
                  target.x,
                y:
                  target.y,
                foundOrder:
                  this.victoryFoundHiders.length +
                  1,
                foundAt:
                  tickNow,
                foundByHunterSessionId:
                  client.sessionId,
                foundByHunterClientKey:
                  this.clientKeyBySessionId.get(client.sessionId) ??
                  client.sessionId,
              });
            }
          }

          if (
            this.getAliveHiderCount() ===
            0
          ) {
            this.finishGame(
              'hunters',
            );

            return;
          }

          if (
            heatNow >=
            0.999
          ) {
            this.stopVulcanHoldFire(
              client.sessionId,
              tickNow,
              true,
            );

            return;
          }

          this.clock.setTimeout(
            tick,
            60,
          );
        };

      this.clock.setTimeout(
            tick,
            60,
          );
    },

    vulcan_fire_stop: (
      client: Client,
      _message: VulcanFireStopMessage,
    ): void => {
      this.stopVulcanHoldFire(
        client.sessionId,
        Date.now(),
        false,
      );
    },

    /* Legacy one-click packet remains ignored. */
    vulcan_fire: (
      _client: Client,
      _message: VulcanFireMessage,
    ): void => {},

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

      if (this.vulcanActiveHunters.has(client.sessionId)) {
        return;
      }

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

      /*
       * V1010464_SERVER_UNLIMITED_SHOTGUN_AMMO
       * Shotgun reserve is temporarily unlimited. HEAT alone gates fire rate.
       */
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

      /* V1010464_SERVER_UNLIMITED_SHOTGUN_AMMO: reserve intentionally stays constant. */
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
      const hardenedBlockedIds = new Set<string>();

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
            if (this.isHiderHardened(sessionId)) {
              if (!hardenedBlockedIds.has(sessionId)) { hardenedBlockedIds.add(sessionId); this.broadcastHardenedHit(sessionId, target.x, target.y); }
              continue;
            }
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
          /*
           * V1010388_SERVER_VICTORY_SHOWCASE
           * Snapshot BEFORE alive=false so the Hunter victory poster can
           * recreate the exact hiding spot where this Hider was discovered.
           */
          if (
            !this.victoryFoundHiders.some(
              (entry) =>
                entry.sessionId ===
                hitId,
            )
          ) {
            this.victoryFoundHiders.push({
              sessionId: hitId,
              name: String(
                target.name ??
                  "Hider",
              ).slice(0, 32),
              x: target.x,
              y: target.y,
              foundOrder:
                this.victoryFoundHiders.length +
                1,
              foundAt:
                Date.now(),
              foundByHunterSessionId:
                client.sessionId,
              foundByHunterClientKey:
                this.clientKeyBySessionId.get(client.sessionId) ??
                client.sessionId,
            });
          }

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
          ? hitIds.size * 100
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
       * V1010464_SERVER_UNLIMITED_SHOTGUN_AMMO
       * No ammo-depletion defeat. Hunt now ends only by:
       * - all Hiders found -> Hunters
       * - Hunt timer expiry -> Hiders
       * Shotgun spam remains limited by HEAT/overheat.
       */
      /* V1010464F_FIRST_SHOT_LOBBY_RESET_HOTFIX: never reset a live Hunt after a normal shotgun shot. */
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
        !player.alive ||
        !this.liveSessionIds.has(
          client.sessionId,
        ) ||
        this.supersededSessionIds.has(
          client.sessionId,
        )
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

      /*
       * v0.10.10.240 READY CONFIRMATION PULSE:
       * A recovering mobile session can send READY at the exact moment the
       * replacement transport becomes authoritative. Re-send the authoritative
       * READY state a few times so both the Hider button and Hunter counter
       * converge without depending on one timing-sensitive broadcast.
       * The membership Set remains the single source of truth.
       */
      [90, 280, 700].forEach(
        (delay) => {
          this.clock.setTimeout(
            () => {
              if (
                this.state.phase !== "paint" ||
                !this.state.players.has(
                  client.sessionId,
                ) ||
                this.supersededSessionIds.has(
                  client.sessionId,
                )
              ) {
                return;
              }

              this.broadcastPaintReadyState();
            },
            delay,
          );
        },
      );
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

      const allRoundHidersLive =
        [...this.state.players.entries()]
          .filter(
            ([, player]) =>
              player.role === "hider" &&
              player.alive,
          )
          .every(
            ([sessionId]) =>
              this.liveSessionIds.has(
                sessionId,
              ) &&
              !this.supersededSessionIds.has(
                sessionId,
              ),
          );

      if (
        readyState.total < 1 ||
        readyState.ready !==
          readyState.total ||
        !allRoundHidersLive ||
        !this.canEnterHuntFromPaint()
      ) {
        return;
      }

      this.state.phaseEndsAt =
        Date.now();

      this.startHuntPhase();
    },

    skill_select: (
      client: Client,
      message: SkillSelectMessage,
    ): void => {
      if (this.state.phase !== "paint") return;

      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      const skillId = message?.skillId;
      if (skillId !== "paintball" && skillId !== "laser") return;

      /*
       * First test rollout: Hider can select these two skills.
       * The storage/API is role-neutral so Hunter skills can reuse it later.
       */
      if (player.role !== "hider") return;

      const clientKey =
        this.clientKeyBySessionId.get(client.sessionId) ??
        client.sessionId;

      this.selectedSkillByClientKey.set(clientKey, skillId);

      client.send("skill_state", { skillId });
    },

    request_skill_state: (
      client: Client,
    ): void => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const clientKey =
        this.clientKeyBySessionId.get(client.sessionId) ??
        client.sessionId;

      client.send("skill_state", {
        skillId:
          this.selectedSkillByClientKey.get(clientKey) ??
          "paintball",
      });
    },

    request_paint_ready_state: (
      client: Client,
    ): void => {
      /* V101072_READY_REQUEST_PHASE_RECOVERY */
/* V1010424_RESTORE_LARGE_ROOM_SERVER_BUDGET / READY_NARROW_RESPONSE */
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

      /*
       * V1010451G_FULL_ASSIST_VICTORY_HISTORY
       *
       * An 80x120 Paint Help projection can legitimately contain hundreds of
       * colour/size buckets on detailed maps. 500 was too small and erased the
       * oldest assist strokes (often the head/top of the avatar) before the
       * Hunter victory snapshot was captured.
       *
       * 2400 is still bounded, but large enough for the complete helper paint
       * plus normal manual corrections. The existing 300-points-per-message
       * validation remains unchanged.
       */
      const maxRoundPaintStrokesPerTarget =
        2400;

      if (
        targetHistory.length >
        maxRoundPaintStrokesPerTarget
      ) {
        targetHistory.splice(
          0,
          targetHistory.length -
            maxRoundPaintStrokesPerTarget,
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


  /* V1010242_HUNTER_FART_SKILL */
  /* V1010247_FART_ULTIMATE_BALANCE */
  /* V1010281_FART_SERVER_COOLDOWN: authoritative 900ms fart cadence. */
  /* V1010277_GAS_10S_LINEAR_DRAIN: 10s accident + authoritative linear GAS drain. */
  /* V1010278_GAS_8S: authoritative accident duration = 8s. */
  /* V1010362_POOP_DEBUFF_5S: authoritative poop movement debuff duration = 5s. */
  /* V1010261_THIRD_FART_DETECT_FIRST */
  /* V1010266_SERVER_POOP_DETECTED_FLAG */
  /* V1010254_RESET_FART_EACH_ROUND */
  private getFartPostPoopFloor(
    _sessionId: string,
  ): number {
    /* V1010386C_SERVER_SIMPLE_THREE_FART_CYCLE_CURRENT_SAFE: every accident returns to GAS 0. */
    return 0;
  }

  private getUpdatedFartGauge(
    sessionId: string,
    now = Date.now(),
  ): number {
    const previous =
      this.fartGaugeByHunter.get(
        sessionId,
      ) ?? 0;

    const updatedAt =
      this.fartGaugeUpdatedAt.get(
        sessionId,
      ) ?? now;

    const poopUntil =
      this.poopUntilByHunter.get(
        sessionId,
      ) ?? 0;

    const floor =
      this.getFartPostPoopFloor(
        sessionId,
      );

    let next: number;

    if (poopUntil > now) {
      /*
       * V1010386C_SERVER_SIMPLE_THREE_FART_CYCLE_CURRENT_SAFE: GAS is pinned to 0 for the full 5-second debuff.
       */
      next = 0;
    } else {
      const elapsedSeconds =
        Math.max(
          0,
          now - updatedAt,
        ) /
        1000;

      next =
        Math.max(
          floor,
          Math.min(
            100,
            previous -
              elapsedSeconds *
                this.fartRegenPerSecond,
          ),
        );
    }

    this.fartGaugeByHunter.set(
      sessionId,
      next,
    );

    this.fartGaugeUpdatedAt.set(
      sessionId,
      now,
    );

    return next;
  }

  private sendFartState(
    client: Client,
    now = Date.now(),
  ): void {
    const gauge = this.getUpdatedFartGauge(
      client.sessionId,
      now,
    );
    const poopUntil =
      this.poopUntilByHunter.get(client.sessionId) ?? 0;
    client.send('fart_state', {
      gauge,
      poopUntil,
      serverNow: now,
      radius: this.fartRadius,

      /*
       * V1010307_SERVER_AUTHORITATIVE_GAS_TARGET: client must never guess the post-poop destination.
       */
      targetGauge:
        this.getFartPostPoopFloor(
          client.sessionId,
        ),
      accidentCount: 0,
      locked: false,
    });
  }

  private updateFartSkillSystem(): void {
    if (this.state.phase !== 'hunt') {
      return;
    }

    const now = Date.now();

    this.clients.forEach(
      (client) => {
        const hunter =
          this.state.players.get(
            client.sessionId,
          );

        if (
          !hunter ||
          hunter.role !== 'hunter' ||
          !hunter.alive
        ) {
          return;
        }

        this.getUpdatedFartGauge(
          client.sessionId,
          now,
        );

        const lastState =
          this.lastFartStateSentAt.get(
            client.sessionId,
          ) ?? 0;

        if (
          now - lastState >= 250
        ) {
          this.lastFartStateSentAt.set(
            client.sessionId,
            now,
          );

          this.sendFartState(
            client,
            now,
          );
        }

        const poopUntil =
          this.poopUntilByHunter.get(
            client.sessionId,
          ) ?? 0;

        if (
          poopUntil > 0 &&
          poopUntil <= now
        ) {
          this.poopUntilByHunter.delete(
            client.sessionId,
          );

          this.poopLaughTriggeredHunters.delete(
            client.sessionId,
          );

          this.sendFartState(
            client,
            now,
          );
        }
      },
    );
  }


  private handleHiderHardenedTaunt(client: Client): void {
    if(this.state.phase!=="hunt") return;

    const hider=this.state.players.get(client.sessionId);
    if(
      !hider ||
      hider.role!=="hider" ||
      !hider.alive ||
      this.isHiderHardened(client.sessionId) ||
      this.tripleTeleportActiveHiders.has(client.sessionId)
    ) return;

    const now=Date.now();
    const endsAt=now+this.hiderHardenedDurationMs;
    const pose=1+Math.floor(Math.random()*5);

    this.hardenedHiderEndsAt.set(client.sessionId,endsAt);
    this.hardenedHiderPose.set(client.sessionId,pose);

    this.broadcast("hider_hardened_state",{
      sessionId:client.sessionId,
      active:true,
      pose,
      endsAt,
      serverNow:now
    });

    this.clock.setTimeout(()=>{
      if((this.hardenedHiderEndsAt.get(client.sessionId)??0)!==endsAt) return;

      this.hardenedHiderEndsAt.delete(client.sessionId);
      this.hardenedHiderPose.delete(client.sessionId);
      this.lastHardenedHitFxAt.delete(client.sessionId);

      this.broadcast("hider_hardened_state",{
        sessionId:client.sessionId,
        active:false,
        pose,
        endsAt:0,
        serverNow:Date.now()
      });
    },this.hiderHardenedDurationMs);
  }

  private startHiderTripleTeleport(client: Client): void {
    const id=client.sessionId;
    const hider=this.state.players.get(id);

    if(
      this.state.phase!=="hunt" ||
      !hider ||
      hider.role!=="hider" ||
      !hider.alive ||
      this.isHiderHardened(id) ||
      this.tripleTeleportActiveHiders.has(id)
    ) return;

    const originX=hider.x;
    const originY=hider.y;
    const generation=(this.tripleTeleportGeneration.get(id)??0)+1;

    this.tripleTeleportGeneration.set(id,generation);
    this.tripleTeleportActiveHiders.add(id);
    this.tripleTeleportOriginByHider.set(id,{x:originX,y:originY});

    const emit=(
      stage:string,
      step:number,
      fromX:number,
      fromY:number,
      x:number,
      y:number,
    ):void=>{
      this.broadcast("hider_triple_teleport",{
        sessionId:id,
        stage,
        step,
        fromX,
        fromY,
        x,
        y,
        originX,
        originY,
        serverNow:Date.now(),
      });
    };

    emit("start",0,originX,originY,originX,originY);

    /*
     * V1010554G_TRIPLE_TELEPORT_REAL_MOTION_SEQUENCE
     *
     * This is no longer "three coordinate teleports".
     * Server still owns the authoritative endpoints, while clients animate
     * a fast 205ms movement between them.
     *
     * 0ms    camera zoom-out begins
     * 420ms  high-speed move 1
     * 850ms  high-speed move 2
     * 1280ms high-speed move 3
     * 1580ms spin + pop at final point (NO position change)
     * 2180ms exact original hiding position restored
     */
    /*
     * V1010554H_TRIPLE_TELEPORT_RANDOM_DESTINATIONS
     * Generate a fresh three-point route EVERY CAST.
     *
     * Keep the points near the original hiding spot so the local Hider only
     * needs a small zoom-out, while still guaranteeing visibly different
     * directions/positions between casts.
     */
    const randomTargets:Array<{x:number;y:number}>=[];
    let previousX=originX;
    let previousY=originY;

    for(let step=0;step<3;step+=1){
      let chosenX=originX;
      let chosenY=originY;
      let bestDistance=-1;

      for(let attempt=0;attempt<16;attempt+=1){
        const angle=
          Math.random()*
          Math.PI*
          2;
        const distance=
          78+
          Math.random()*
          58;

        const candidateX=
          PhaserMathClampServer(
            originX+
              Math.cos(angle)*
              distance,
            28,
            932,
          );
        const candidateY=
          PhaserMathClampServer(
            originY+
              Math.sin(angle)*
              distance,
            38,
            502,
          );

        const fromPrevious=
          Math.hypot(
            candidateX-previousX,
            candidateY-previousY,
          );
        const fromOrigin=
          Math.hypot(
            candidateX-originX,
            candidateY-originY,
          );

        const score=
          Math.min(
            fromPrevious,
            fromOrigin+28,
          );

        if(score>bestDistance){
          chosenX=candidateX;
          chosenY=candidateY;
          bestDistance=score;
        }

        /*
         * Good enough: clearly separated from previous point and not just a
         * tiny wobble around the origin.
         */
        if(
          fromPrevious>=72 &&
          fromOrigin>=62
        ){
          break;
        }
      }

      randomTargets.push({
        x:chosenX,
        y:chosenY,
      });
      previousX=chosenX;
      previousY=chosenY;
    }

    let prevX=originX;
    let prevY=originY;

    randomTargets.forEach((_target,index)=>{
      this.clock.setTimeout(()=>{
        const p=this.state.players.get(id);

        if(
          this.tripleTeleportGeneration.get(id)!==generation ||
          this.state.phase!=="hunt" ||
          !p ||
          !p.alive
        ){
          this.cancelHiderTripleTeleport(id,generation);
          return;
        }

        const target=
          randomTargets[index];

        const x=target.x;
        const y=target.y;

        const fromX=prevX;
        const fromY=prevY;

        /*
         * Endpoint is authoritative now. Client visually traverses from -> to.
         */
        p.x=x;
        p.y=y;
        prevX=x;
        prevY=y;

        emit(
          "step",
          index+1,
          fromX,
          fromY,
          x,
          y,
        );
      },420+index*430);
    });

    /*
     * Separate vanish stage AFTER the third movement has visibly completed.
     * No extra coordinate jump here.
     */
    this.clock.setTimeout(()=>{
      if(this.tripleTeleportGeneration.get(id)!==generation)return;

      const p=this.state.players.get(id);
      if(
        this.state.phase!=="hunt" ||
        !p ||
        !p.alive
      ){
        this.cancelHiderTripleTeleport(id,generation);
        return;
      }

      emit(
        "vanish",
        3,
        p.x,
        p.y,
        p.x,
        p.y,
      );
    },1580);

    this.clock.setTimeout(()=>{
      if(this.tripleTeleportGeneration.get(id)!==generation)return;

      const p=this.state.players.get(id);

      if(
        this.state.phase!=="hunt" ||
        !p ||
        !p.alive
      ){
        this.cancelHiderTripleTeleport(id,generation);
        return;
      }

      const fromX=p.x;
      const fromY=p.y;

      /*
       * Exact server-authoritative return to the ORIGINAL hiding coordinate.
       */
      p.x=originX;
      p.y=originY;

      this.tripleTeleportActiveHiders.delete(id);
      this.tripleTeleportOriginByHider.delete(id);

      emit(
        "return",
        3,
        fromX,
        fromY,
        originX,
        originY,
      );
    },2180);
  }

  private cancelHiderTripleTeleport(
    id:string,
    generation=this.tripleTeleportGeneration.get(id)??0,
  ):void{
    if(this.tripleTeleportGeneration.get(id)!==generation) return;

    const origin=this.tripleTeleportOriginByHider.get(id);
    const p=this.state.players.get(id);

    const fromX=p?.x??origin?.x??0;
    const fromY=p?.y??origin?.y??0;
    const x=origin?.x??fromX;
    const y=origin?.y??fromY;

    this.tripleTeleportGeneration.set(id,generation+1);
    this.tripleTeleportActiveHiders.delete(id);
    this.tripleTeleportOriginByHider.delete(id);

    if(p&&origin){
      p.x=origin.x;
      p.y=origin.y;
    }

    this.broadcast("hider_triple_teleport",{
      sessionId:id,
      stage:"cancel",
      step:0,
      fromX,
      fromY,
      x,
      y,
      originX:x,
      originY:y,
      serverNow:Date.now(),
    });
  }

  private isHiderHardened(sessionId: string, now = Date.now()): boolean {
    const endsAt = this.hardenedHiderEndsAt.get(sessionId) ?? 0;
    if (endsAt <= now) { if (endsAt > 0) { this.hardenedHiderEndsAt.delete(sessionId); this.hardenedHiderPose.delete(sessionId); this.lastHardenedHitFxAt.delete(sessionId); } return false; }
    return true;
  }

  private broadcastHardenedHit(sessionId: string, x: number, y: number): void {
    const now=Date.now(),previous=this.lastHardenedHitFxAt.get(sessionId)??0;if(now-previous<this.hiderHardenedHitFxCooldownMs)return;const current=this.hardenedHiderEndsAt.get(sessionId)??0;if(current<=now)return;this.lastHardenedHitFxAt.set(sessionId,now);const endsAt=Math.max(now,current-1000),pose=1+Math.floor(Math.random()*5);this.hardenedHiderEndsAt.set(sessionId,endsAt);this.hardenedHiderPose.set(sessionId,pose);this.broadcast("hider_hardened_hit",{sessionId,x,y,pose,endsAt,serverNow:now});if(endsAt<=now){this.hardenedHiderEndsAt.delete(sessionId);this.hardenedHiderPose.delete(sessionId);this.lastHardenedHitFxAt.delete(sessionId);this.broadcast("hider_hardened_state",{sessionId,active:false,pose,endsAt:0,serverNow:now});return;}this.clock.setTimeout(()=>{if((this.hardenedHiderEndsAt.get(sessionId)??0)!==endsAt)return;this.hardenedHiderEndsAt.delete(sessionId);this.hardenedHiderPose.delete(sessionId);this.lastHardenedHitFxAt.delete(sessionId);this.broadcast("hider_hardened_state",{sessionId,active:false,pose,endsAt:0,serverNow:Date.now()});},Math.max(1,endsAt-now));
  }

  onCreate(
    options: JoinOptions,
  ): void {
    this.autoDispose = true;

    /*
     * V1010424_RESTORE_LARGE_ROOM_SERVER_BUDGET
     * Restore the known-good 3-10 player room transport budget.
     * 66ms ~= 15Hz room-wide Schema patch fanout.
     */
    this.setPatchRate(
      66,
    );

    /*
     * clock timeout이 어떤 이유로 지연되더라도 phaseEndsAt을 기준으로
     * 250ms마다 서버가 라운드 진행 상태를 보정합니다.
     */
    this.setSimulationInterval(
      () => {
        this.checkPhaseDeadline();
        this.updateFartSkillSystem();

        /*
         * V1010364S_P0_MULTIPLAYER_STABILITY
         * READY changes are already broadcast immediately. Keep only a slow
         * recovery pulse instead of broadcasting room-wide twice per second.
         */
        if (
          this.state.phase === "paint" &&
          Date.now() -
            this.lastPaintReadyPulseAt >=
            2_000
        ) {
          this.lastPaintReadyPulseAt =
            Date.now();
          this.broadcastPaintReadyState();
        }
      },
      100,
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
    /*
     * V1010452S4_STALE_ROOM_PREAUTH_GHOST_BLOCK
     *
     * When the last REAL Lobby transport drops, 452s3 keeps the old PlayerState
     * for the proven 8-second same-session reconnect window. A stale room-list
     * card can still be clicked during listing-cache convergence.
     *
     * Reject that NEW join before onJoin/state synchronization. This prevents:
     * - the old ghost actor flashing for a moment
     * - a fresh session inheriting host after clicking the stale room card
     *
     * Legitimate same-session recovery is handled by allowReconnection() ->
     * onReconnect(), so it does not need to pass this fresh-join auth gate.
     */
    if (
      this.state.phase === "lobby" &&
      this.staleEmptyLobbyLocked &&
      this.liveSessionIds.size === 0
    ) {
      return false;
    }

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
    this.markConnectionTopologyChanged();

    /*
     * V1010452S3_STALE_EMPTY_LOBBY_LOCK / FRESH_JOIN_GUARD
     *
     * The room list may lag behind setPrivate(true). If this room lost its
     * final real Lobby socket, only Colyseus onReconnect() for the preserved
     * session may revive it. A normal room-card click is a fresh onJoin and
     * must be rejected before it can create a ghost actor or inherit host.
     */
    if (
      this.state.phase === "lobby" &&
      this.staleEmptyLobbyLocked
    ) {
      this.state.hostId = "";

      this.liveSessionIds.delete(
        client.sessionId,
      );
      this.markConnectionTopologyChanged();

      this.updateRoomMetadata();
      this.syncRoomListingVisibility();
      this.setPrivate(true);

      client.send(
        "join_rejected",
        {
          reason: "room_closed",
          returnToLobby: true,
        },
      );

      this.clock.setTimeout(
        () => {
          try {
            client.leave(
              4004,
              "room_closed",
            );
          } catch {
            // Transport may already be gone.
          }
        },
        0,
      );

      return;
    }

    /*
     * V1010387_SERVER_FULL_ROOM_HARD_GUARD
     *
     * Colyseus maxClients=10 is already the primary capacity guard.
     * This is a second defensive boundary: even if a transport race or
     * future framework/config change ever lets an extra live transport reach
     * onJoin(), it is rejected before PlayerState creation.
     */
    if (
      this.liveSessionIds.size >
      this.maxClients
    ) {
      client.send(
        "join_rejected",
        {
          reason: "room_full",
          playerCount:
            this.maxClients,
          maxClients:
            this.maxClients,
          returnToLobby: true,
        },
      );

      this.liveSessionIds.delete(
        client.sessionId,
      );

      this.updateRoomMetadata();
      this.syncRoomListingVisibility();

      this.clock.setTimeout(
        () => {
          try {
            client.leave(
              4002,
              "room_full",
            );
          } catch {
            // Transport may already be gone.
          }
        },
        0,
      );

      return;
    }

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

      /*
       * V1010451_SHARE_AND_REJOIN_BOUNDARY / NO_RESURRECT_AFTER_LOBBY_LEAVE
       *
       * Once the server has removed a player seat, a later fresh clientKey
       * join must NOT resurrect that user into a round that started while the
       * app was backgrounded. Same-session reconnect still works because the
       * current-round PlayerState remains present during its grace window.
       */
      if (
        !ownsExistingRoundPlayer
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
    this.markConnectionTopologyChanged();

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

    /*
     * V101023840_MOBILE_RECONNECT_CONVERGENCE
     * A fresh mobile fallback gets a new sessionId. Preserve READY ownership
     * across that identity replacement.
     */
    let inheritedPaintReady = false;

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
          inheritedPaintReady =
            this.paintReadySessionIds.has(
              existingSessionId,
            );

          this.paintReadySessionIds.delete(
            existingSessionId,
          );
          this.lobbyReadySessionIds.delete(
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

                  /* V1010549_RECONNECT_PAINT_FANOUT_LOAD_SHED_DIAG
                   * Existing clients already receive the remapped reconnecting player's
                   * paint through the bounded targeted paint_stroke replay below.
                   * Re-sending the ENTIRE round_paint_state to every socket here caused
                   * a large reconnect-time fan-out under realistic 200+ stroke/player load.
                   * Keep only the lightweight authoritative roster snapshot for peers.
                   * The reconnecting/fresh client still receives one full paint snapshot
                   * through V101085_REJOIN_FULL_STATE_PULSE.
                   */
                  this.clients.forEach(
                    (connectedClient) => {
                      this.sendLobbySnapshot(
                        connectedClient,
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

    /*
     * V101023840_MOBILE_RECONNECT_CONVERGENCE
     * Session replacement is now complete. Transfer READY only for an active,
     * living Hider and immediately publish the authoritative count.
     */
    if (
      this.state.phase === "paint" &&
      player.role === "hider" &&
      player.alive &&
      inheritedPaintReady
    ) {
      this.paintReadySessionIds.add(
        client.sessionId,
      );
    }

    if (this.state.phase === "paint") {
      this.broadcastPaintReadyState();
    }

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

              /*
               * V101023837_SERVER_PAINT_STABILITY: full recovery state is needed only by the reconnecting
               * client. Existing clients already receive targeted paint replay.
               */
              this.sendLobbySnapshot(
                client,
              );

              client.send(
                "round_paint_state",
                {
                  strokes:
                    [...this.roundPaintStrokes.values()]
                      .flat(),
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

    /*
     * V1010451D_LOBBY_READY_ROSTER_BROADCAST / JOIN
     * A new Lobby seat changes READY denominator for every browser.
     */
    if (this.state.phase === "lobby") {
      this.broadcastLobbyReadyState();

      /*
       * V1010552_LOBBY_ROSTER_CONVERGENCE_HOTFIX / JOIN_FULL_ROSTER_CONVERGENCE
       *
       * Existing clients normally learn a new Lobby player through Schema onAdd.
       * If that stream briefly adds/removes out of order, the client can show a
       * white fallback actor and then lose the player while the newcomer remains
       * connected. Broadcast one tiny Lobby-only roster snapshot to EVERY live
       * client so all browsers converge on the authoritative server roster.
       */
      this.clients.forEach(
        (connectedClient) => {
          this.sendLobbySnapshot(
            connectedClient,
          );
        },
      );

      /*
       * One short settle pulse covers the join/Schema ordering window without
       * reintroducing active-round paint fanout removed by v549.
       */
      this.clock.setTimeout(
        () => {
          if (
            this.state.phase !== "lobby" ||
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
            },
          );
        },
        180,
      );
    }

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

      [120, 420, 900, 1800].forEach(
        (delay) => {
          this.clock.setTimeout(
            () => {
              if (
                !this.clients.includes(
                  client,
                ) ||
                !this.state.players.has(
                  client.sessionId,
                )
              ) {
                return;
              }

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

              if (
                this.state.phase ===
                  "paint"
              ) {
                this.sendPaintReadyState(
                  client,
                );
              }
            },
            delay,
          );
        },
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

  /* V1010295_ALL_PHASE_RECONNECT: every phase gets transport recovery + authoritative replay. */
  async onDrop(
    client: Client,
    code: number,
  ): Promise<void> {
    /*
     * V1010451M5S_SERVER_INTENTIONAL_LOBBY_LEAVE_GHOST_FIX_ROOT_ROBUST / DROP_FAST_PATH
     *
     * "Leave room" is a permanent Lobby exit, not a recoverable socket drop.
     * Reuse the existing authoritative onLeave cleanup immediately.
     */
    if (
      this.intentionalLeaveSessionIds.delete(
        client.sessionId,
      )
    ) {
      this.onLeave(
        client,
        code as CloseCode,
      );
      return;
    }


    this.liveSessionIds.delete(
      client.sessionId,
    );
    this.markConnectionTopologyChanged();

    /*
     * V1010471_READY_DROP_SAFETY_ONLY
     *
     * REAL transport drop invalidates READY immediately.
     * PlayerState/reconnect reservation/host recovery/fresh handoff remain untouched.
     */
    const lobbyReadyWasRemoved =
      this.lobbyReadySessionIds.delete(
        client.sessionId,
      );

    const paintReadyWasRemoved =
      this.paintReadySessionIds.delete(
        client.sessionId,
      );

    if (
      this.state.phase === "lobby" &&
      lobbyReadyWasRemoved
    ) {
      this.broadcastLobbyReadyState();
    }

    if (
      this.state.phase === "paint" &&
      paintReadyWasRemoved
    ) {
      this.broadcastPaintReadyState();
    }

    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    /*
     * V1010452S3_STALE_EMPTY_LOBBY_LOCK / DROP
     *
     * Hide already happens above via liveSessionIds.size === 0.
     * Additionally freeze this zero-live Lobby against NEW joins while the
     * existing 8-second same-session reconnect reservation is pending.
     */
    if (
      this.state.phase === "lobby" &&
      this.liveSessionIds.size === 0
    ) {
      this.staleEmptyLobbyLocked = true;
      this.state.hostId = "";
      this.setPrivate(true);

      /*
       * Publish the zero-live/no-host state immediately. The room-list service
       * may still show a cached card briefly, but that card can no longer enter
       * the room and no disconnected actor owns host authority.
       */
      this.updateRoomMetadata();
      this.syncRoomListingVisibility();
    }

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
    const dropDiagPlayer =
      this.state.players.get(
        client.sessionId,
      );

    const dropDiagStrokes =
      [...this.roundPaintStrokes.values()]
        .flat();

    console.log(
      "[NETDIAG SERVER v549][DROP]",
      {
        sessionId:
          client.sessionId,
        code,
        phase:
          this.state.phase,
        role:
          dropDiagPlayer?.role ??
          "unknown",
        alive:
          dropDiagPlayer?.alive ??
          false,
        liveTotal:
          this.liveSessionIds.size,
        liveHunters:
          this.countLiveRole(
            "hunter",
          ),
        liveHiders:
          this.countLiveRole(
            "hider",
          ),
        roundStrokeCount:
          dropDiagStrokes.length,
        roundPointCount:
          dropDiagStrokes.reduce(
            (total, stroke) =>
              total +
              (
                Array.isArray(
                  stroke?.points,
                )
                  ? stroke.points.length
                  : 0
              ),
            0,
          ),
      },
    );

    console.log(
      "[Chameleon Hunt] temporary drop",
      {
        sessionId:
          client.sessionId,
        code,
      },
    );

    /*
     * V1010295_ALL_PHASE_RECONNECT: Lobby is a phase too. Do not immediately destroy the player on a
     * temporary mobile transport drop. The common allowReconnection() below
     * now protects lobby/countdown/paint/hunt/finished uniformly.
     */
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
      /*
       * V1010364S_P0_MULTIPLAYER_STABILITY
       *
       * Lobby actors are disposable: a closed mobile browser should disappear
       * quickly instead of remaining as a five-minute ghost and being assigned
       * a role in the next round.
       *
       * Active rounds keep the long reservation because mobile OS suspension
       * is common and the existing round-outcome grace already handles absence.
       */
      /*
       * V1010450ZF_RESTORE_LOBBY_RECONNECT_WINDOW
       * Restore the proven Lobby reconnect behavior.
       */
      const reconnectSeconds =
        this.state.phase === "lobby"
          ? 8
          : 300;

      await this.allowReconnection(
        client,
        reconnectSeconds,
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
      )
    ) {
      this.liveSessionIds.delete(
        client.sessionId,
      );
    this.markConnectionTopologyChanged();
      this.updateRoomMetadata();
      this.syncRoomListingVisibility();

      console.warn(
        "[Chameleon Hunt] ignored superseded reconnect",
        {
          sessionId:
            client.sessionId,
        },
      );
      return;
    }

    if (
      !this.state.players.has(
        client.sessionId,
      )
    ) {
      const recovery =
        this.postRoundReconnectBySessionId.get(
          client.sessionId,
        );

      if (
        this.state.phase !== "lobby" ||
        !recovery ||
        recovery.expiresAt <=
          Date.now()
      ) {
        this.liveSessionIds.delete(
          client.sessionId,
        );
    this.markConnectionTopologyChanged();
        this.updateRoomMetadata();
        this.syncRoomListingVisibility();

        console.warn(
          "[Chameleon Hunt] ignored stale reconnect",
          {
            sessionId:
              client.sessionId,
            phase:
              this.state.phase,
          },
        );
        return;
      }

      const restoredPlayer =
        new PlayerState();

      restoredPlayer.name =
        recovery.name ||
        "Player";
      restoredPlayer.role =
        "hider";
      restoredPlayer.hunterVolunteer =
        false;
      restoredPlayer.alive =
        true;

      const lobbyPosition =
        this.getRandomLobbyPosition();

      restoredPlayer.x =
        lobbyPosition.x;
      restoredPlayer.y =
        lobbyPosition.y;

      this.state.players.set(
        client.sessionId,
        restoredPlayer,
      );

      if (
        recovery.clientKey
      ) {
        this.clientKeyBySessionId.set(
          client.sessionId,
          recovery.clientKey,
        );
      }

      if (
        Array.isArray(
          recovery.avatar,
        ) &&
        recovery.avatar.length >
          0
      ) {
        this.lobbyAvatarPresets.set(
          client.sessionId,
          recovery.avatar,
        );
      }

      this.postRoundReconnectBySessionId.delete(
        client.sessionId,
      );

      this.weaponHeatStates.set(
        client.sessionId,
        {
          heat: 0,
          updatedAt:
            Date.now(),
          overheatedUntil:
            0,
        },
      );

      this.noHunterGraceGeneration +=
        1;

      this.ensureValidHost();

      console.log(
        "[Chameleon Hunt] restored post-round lobby reconnect",
        {
          sessionId:
            client.sessionId,
          players:
            this.state.players.size,
        },
      );
    }

    /*
     * V1010452S3_STALE_EMPTY_LOBBY_LOCK / RECONNECT
     *
     * We reached here only after superseded/stale reconnect rejection above.
     * Therefore this is a legitimate preserved-session recovery.
     */
    if (
      this.state.phase === "lobby"
    ) {
      this.staleEmptyLobbyLocked = false;
    }

    this.liveSessionIds.add(
      client.sessionId,
    );
    this.markConnectionTopologyChanged();

    this.markRoleConnectionRestored(
      client.sessionId,
    );

    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    /*
     * V1010451D_LOBBY_READY_ROSTER_BROADCAST / RECONNECT
     * Recovered Lobby transport rejoins the READY denominator immediately.
     */
    if (this.state.phase === "lobby") {
      this.broadcastLobbyReadyState();

      /*
       * V1010552_LOBBY_ROSTER_CONVERGENCE_HOTFIX / RECONNECT_FULL_ROSTER_CONVERGENCE
       * A recovered Lobby seat is roster topology too. Refresh every live client
       * once so a browser that missed Schema recovery immediately heals.
       */
      this.clients.forEach(
        (connectedClient) => {
          this.sendLobbySnapshot(
            connectedClient,
          );
        },
      );
    }

    /* V101078_CANCEL_NO_HUNTER_ON_RECONNECT */
    this.noHunterGraceGeneration += 1;

    console.log(
      "[NETDIAG SERVER v549][RECONNECT]",
      {
        sessionId:
          client.sessionId,
        phase:
          this.state.phase,
        role:
          this.state.players.get(
            client.sessionId,
          )?.role ??
          "unknown",
        liveTotal:
          this.liveSessionIds.size,
        liveHunters:
          this.countLiveRole(
            "hunter",
          ),
        liveHiders:
          this.countLiveRole(
            "hider",
          ),
      },
    );

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

    if (
      this.state.phase === "finished" &&
      (
        this.state.winner === "hunters" ||
        this.state.winner === "hiders"
      )
    ) {
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

      client.send(
        "round_result",
        {
          winner:
            this.state.winner,
          revealedHiders,
          durationMs:
            Math.max(
              0,
              this.state.phaseEndsAt -
                Date.now(),
            ),
        },
      );
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
    this.intentionalLeaveSessionIds.delete(
      client.sessionId,
    );


    this.liveSessionIds.delete(
      client.sessionId,
    );
    this.markConnectionTopologyChanged();

    /*
     * Hide/update before any round-specific early return.
     */
    this.updateRoomMetadata();
    this.syncRoomListingVisibility();

    /* V101073_DUPLICATE_LEAVE_GUARD */
    /*
     * V1010451D_LOBBY_READY_ROSTER_BROADCAST / DUPLICATE_LEAVE
     * Duplicate/stale leave can still change transport membership.
     */
    if (
      !this.state.players.has(
        client.sessionId,
      )
    ) {
      if (this.state.phase === "lobby") {
        this.broadcastLobbyReadyState();
      }
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
    this.lobbyReadySessionIds.delete(client.sessionId);
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

    /*
     * V1010451D_LOBBY_READY_ROSTER_BROADCAST / LEAVE
     * Host and guests now receive the same authoritative READY denominator.
     */
    if (this.state.phase === "lobby") {
      this.broadcastLobbyReadyState();
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

    /*
     * V1010300_SERVER_EMPTY_ROOM_HARD_DISPOSE: hide the room synchronously BEFORE waiting for Colyseus client
     * collection / listing-cache convergence.
     */
    this.syncRoomListingVisibility();

    this.setPrivate(
      true,
    );

    this.setMetadata({
      ...(this.metadata ?? {}),
      playerCount: 0,
      clients: 0,
    });

    const disposeIfStillEmpty =
      (): void => {
        if (
          this.state.phase !==
            "lobby" ||
          this.liveSessionIds.size >
            0
        ) {
          return;
        }

        this.syncRoomListingVisibility();

        console.log(
          "[Color Hunt] hard-disposing empty lobby",
          {
            roomId:
              this.roomId,
          },
        );

        void this.disconnect();
      };

    /*
     * First tick handles normal voluntary Lobby leave quickly.
     * Second tick is a fallback for transport collection settling late.
     */
    this.clock.setTimeout(
      disposeIfStillEmpty,
      60,
    );

    this.clock.setTimeout(
      disposeIfStillEmpty,
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
      if (
        this.canEnterHuntFromPaint()
      ) {
        this.startHuntPhase();
      } else {
        /*
         * V1010366B_PAINT_HUNT_RECONNECT_BARRIER_EXACT / DEADLINE_HOLD
         *
         * Keep authoritative Paint alive in short slices. The UI may briefly
         * show extra Paint time, but we never create the catastrophic state
         * seen in the recording: Hunt timer alive while actors/paint are dead.
         */
        this.state.phaseEndsAt =
          Date.now() +
          1_000;

        this.broadcastPhaseChanged();
        this.broadcastPaintReadyState();
      }

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
    /*
     * V1010254_RESET_FART_EACH_ROUND:
     * GAS/poop state is ROUND-SCOPED, never room-scoped.
     * Without this reset, a Hunter ending the previous match at 72~100 GAS
     * can inherit that pressure and instantly poop on the next round.
     */
    this.fartGaugeByHunter.clear();
    this.fartGaugeUpdatedAt.clear();
    this.lastFartUseAtByHunter.clear();
    this.fartAccidentCountByHunter.clear();
    this.fartLockedHunters.clear();
    this.poopUntilByHunter.clear();
    this.poopLaughTriggeredHunters.clear();

    const now =
      Date.now();

    /*
     * Explicitly seed every current Hunter at GAS 0 and notify them
     * immediately, so client HUD and authoritative state start in sync.
     */
    this.state.players.forEach(
      (
        player,
        sessionId,
      ) => {
        if (
          player.role !==
          "hunter"
        ) {
          return;
        }

        this.fartGaugeByHunter.set(
          sessionId,
          0,
        );

        this.fartGaugeUpdatedAt.set(
          sessionId,
          now,
        );

        const hunterClient =
          this.clients.find(
            (
              connectedClient,
            ) =>
              connectedClient.sessionId ===
              sessionId,
          );

        if (
          hunterClient
        ) {
          this.sendFartState(
            hunterClient,
            now,
          );
        }
      },
    );

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

    /*
     * V1010388_SERVER_VICTORY_SHOWCASE: every Paint phase starts a brand-new victory timeline.
     */
    this.victoryFoundHiders.splice(
      0,
      this.victoryFoundHiders.length,
    );

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
     * V1010366B_PAINT_HUNT_RECONNECT_BARRIER_EXACT / FINAL_GATE
     *
     * Timers, READY and stale delayed callbacks all converge here.
     * Never cross the Paint boundary with an unstable live roster.
     */
    if (
      this.state.phase === "paint" &&
      !this.canEnterHuntFromPaint()
    ) {
      return;
    }

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

    /* V1010453_SNIPER_SUPPORT_MODE: each Hunt starts clean. */
    this.sniperActiveHunters.clear();
    this.hardenedHiderEndsAt.clear();
    this.hardenedHiderPose.clear();
    this.lastHardenedHitFxAt.clear();
    this.lastSniperAimAt.clear();
    this.lastSniperFireAt.clear();
    this.vulcanActiveHunters.clear();
    this.vulcanHeatByHunter.clear();
    this.vulcanHeatUpdatedAt.clear();
    this.vulcanAimByHunter.clear();
    this.vulcanFiringStartedAt.clear();
    this.vulcanCoolingUntil.clear();
    this.vulcanFireGeneration.clear();
    this.vulcanHeatByHunter.clear();
    this.vulcanHeatUpdatedAt.clear();
    this.tacticalSupportCommittedHunters.clear();
    this.lastVulcanAimAt.clear();
    this.lastVulcanFireAt.clear();



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

    this.sniperActiveHunters.clear();

    /* V1010554B_TRIPLE_TELEPORT_SERVER: victory/result owns the frame immediately. */
    for(const id of [...this.tripleTeleportActiveHiders]){
      this.cancelHiderTripleTeleport(
        id,
        this.tripleTeleportGeneration.get(id)??0,
      );
    }
    this.tripleTeleportActiveHiders.clear();


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

    const victoryShowcase = {
      activeMap:
        this.state.activeMap,
      foundHiders:
        this.victoryFoundHiders.map(
          (entry) => ({
            sessionId:
              entry.sessionId,
            name:
              entry.name,
            x:
              entry.x,
            y:
              entry.y,
            foundOrder:
              entry.foundOrder,
            foundAt:
              entry.foundAt,
            foundByHunterSessionId:
              entry.foundByHunterSessionId,
            foundByHunterClientKey:
              entry.foundByHunterClientKey,
          }),
        ),
      survivingHiders:
        [...this.state.players.entries()]
          .filter(
            ([, player]) =>
              player.role === "hider" &&
              player.alive,
          )
          .map(
            ([sessionId, player]) => ({
              sessionId,
              name:
                String(
                  player.name ??
                    "Hider",
                ).slice(0, 32),
              x:
                player.x,
              y:
                player.y,
            }),
          ),
    };

    this.broadcast(
      "round_result",
      {
        winner,
        reason,
        revealedHiders,
        durationMs:
          this.resultDurationMs,
        /*
         * V1010388_SERVER_VICTORY_SHOWCASE: compact metadata only; paint pixels stay client-side.
         */
        victoryShowcase,
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
    /*
     * V1010254_RESET_FART_EACH_ROUND: defensive round-end cleanup.
     */
    this.tripleTeleportActiveHiders.clear();
    this.tripleTeleportGeneration.clear();
    this.tripleTeleportOriginByHider.clear();
    this.fartGaugeByHunter.clear();
    this.fartGaugeUpdatedAt.clear();
    this.poopUntilByHunter.clear();
    this.poopLaughTriggeredHunters.clear();
    this.state.phase = "lobby";

    this.sniperActiveHunters.clear();
    this.hardenedHiderEndsAt.clear();
    this.hardenedHiderPose.clear();
    this.lastHardenedHitFxAt.clear();
    this.lastSniperAimAt.clear();
    this.lastSniperFireAt.clear();
    this.vulcanActiveHunters.clear();
    this.vulcanHeatByHunter.clear();
    this.vulcanHeatUpdatedAt.clear();
    this.vulcanAimByHunter.clear();
    this.vulcanFiringStartedAt.clear();
    this.vulcanCoolingUntil.clear();
    this.vulcanFireGeneration.clear();
    this.vulcanHeatByHunter.clear();
    this.vulcanHeatUpdatedAt.clear();
    this.tacticalSupportCommittedHunters.clear();
    this.lastVulcanAimAt.clear();
    this.lastVulcanFireAt.clear();
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

      const disconnectedPlayer =
        this.state.players.get(
          sessionId,
        );

      if (disconnectedPlayer) {
        this.postRoundReconnectBySessionId.set(
          sessionId,
          {
            name:
              disconnectedPlayer.name,
            clientKey:
              this.clientKeyBySessionId.get(
                sessionId,
              ) ?? "",
            avatar:
              this.lobbyAvatarPresets.get(
                sessionId,
              ) ?? [],
            expiresAt:
              Date.now() +
              5 * 60_000,
          },
        );
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

    /*
     * V1010388_SERVER_VICTORY_SHOWCASE: result has already been broadcast and displayed for 5s.
     */
    this.victoryFoundHiders.splice(
      0,
      this.victoryFoundHiders.length,
    );

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

    this.lobbyReadySessionIds.clear();

    this.broadcast(
      "reset_round",
      {},
    );

    this.broadcastLobbyReadyState();

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

  private getLobbyReadyState(): {
    readySessionIds: string[];
    readyCount: number;
    totalCount: number;
    allReady: boolean;
    canStart: boolean;
    livePlayerCount: number;
    hasDisconnectedPlayers: boolean;
  } {
    this.ensureValidHost();

    /*
     * V1010451C_RESTORE_READY_CONTRACT_FIXED / CLIENTS_ARE_TRANSPORT_TRUTH
     * READY eligibility uses Colyseus' actual connected transports.
     */
    const connectedSessionIds =
      this.clients
        .map(
          (connectedClient) =>
            connectedClient.sessionId,
        )
        .filter(
          (sessionId) =>
            this.state.players.has(sessionId) &&
            this.liveSessionIds.has(sessionId) &&
            !this.supersededSessionIds.has(sessionId),
        );

    const connectedSet =
      new Set(connectedSessionIds);

    for (const sessionId of connectedSet) {
      this.liveSessionIds.add(sessionId);
    }

    const eligibleReadyIds =
      connectedSessionIds.filter(
        (sessionId) =>
          sessionId !== this.state.hostId,
      );

    const eligibleSet =
      new Set(eligibleReadyIds);

    for (const sessionId of [...this.lobbyReadySessionIds]) {
      if (!eligibleSet.has(sessionId)) {
        this.lobbyReadySessionIds.delete(
          sessionId,
        );
      }
    }

    const readySessionIds =
      eligibleReadyIds.filter(
        (sessionId) =>
          this.lobbyReadySessionIds.has(
            sessionId,
          ),
      );

    const readyCount =
      readySessionIds.length;

    const totalCount =
      eligibleReadyIds.length;

    const livePlayerCount =
      connectedSessionIds.length;

    const hasDisconnectedPlayers =
      [...this.state.players.keys()]
        .some(
          (sessionId) =>
            !connectedSet.has(sessionId) &&
            !this.supersededSessionIds.has(sessionId),
        );

    const allReady =
      totalCount > 0 &&
      readyCount === totalCount;

    return {
      readySessionIds,
      readyCount,
      totalCount,
      allReady,
      canStart:
        livePlayerCount >= 2 &&
        allReady &&
        !hasDisconnectedPlayers,
      livePlayerCount,
      hasDisconnectedPlayers,
    };
  }

  private sendLobbyReadyState(
    client: Client,
  ): void {
    client.send(
      "lobby_ready_state",
      this.getLobbyReadyState(),
    );
  }

  private broadcastLobbyReadyState(): void {
    this.broadcast(
      "lobby_ready_state",
      this.getLobbyReadyState(),
    );
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
          ([sessionId, player]) =>
            player.role === "hider" &&
            player.alive &&
            this.liveSessionIds.has(
              sessionId,
            ) &&
            !this.supersededSessionIds.has(
              sessionId,
            ),
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
     * V1010452S3_STALE_EMPTY_LOBBY_LOCK / HOST
     *
     * A locked zero-live Lobby has no active host. state.players can still
     * contain the reconnect-reserved old actor, but it has no authority until
     * its real transport reconnects.
     */
    if (
      this.state.phase === "lobby" &&
      this.staleEmptyLobbyLocked &&
      this.liveSessionIds.size === 0
    ) {
      this.state.hostId = "";
      return;
    }

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
    this.intentionalLeaveSessionIds.clear();
    this.staleEmptyLobbyLocked = false;

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
