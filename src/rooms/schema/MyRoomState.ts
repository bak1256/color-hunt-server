import {
  MapSchema,
  Schema,
  defineTypes,
} from "@colyseus/schema";

export type PlayerRole =
  | "hunter"
  | "hider";

export type GamePhase =
  | "lobby"
  | "countdown"
  | "paint"
  | "hunt"
  | "finished";

/*
 * IMPORTANT
 * ---------
 * Decorator 기반 @type() 정의를 제거했습니다.
 *
 * Colyseus Schema는 TypeScript compiler의
 * `useDefineForClassFields` / decorator 설정이 맞지 않으면
 * 서버 내부 state는 정상처럼 보이면서도 최초 JOIN_ROOM의
 * Schema handshake가 클라이언트에서 끝나지 않을 수 있습니다.
 *
 * 이 경우 서버에서는:
 *   clients: 1
 *   playerCount: 1
 * 로 정상인데
 *
 * client.create()/joinById() Promise는 resolve되지 않아
 * UI가 "플레이어 연결 중..."에서 멈출 수 있습니다.
 *
 * defineTypes() 방식은 decorator compiler 설정에 의존하지 않습니다.
 */
export class PlayerState extends Schema {
  name = "Player";
  role: PlayerRole = "hider";
  hunterVolunteer = false;
  x = 480;
  y = 270;
  alive = true;
}

defineTypes(
  PlayerState,
  {
    name: "string",
    role: "string",
    hunterVolunteer:
      "boolean",
    x: "number",
    y: "number",
    alive: "boolean",
  },
);

export class MyRoomState extends Schema {
  gameName =
    "Chameleon Hunt";

  roomTitle =
    "Chameleon Room";

  isPrivate = false;

  phase: GamePhase =
    "lobby";

  phaseEndsAt = 0;

  hunterCount = 0;

  winner = "";

  hostId = "";

  /*
   * selectedMap:
   *   "random" | "map1" ... "map12"
   * activeMap:
   *   실제 라운드에 확정된 map1 ... map12
   */
  selectedMap = "random";

  activeMap = "forest";

  players =
    new MapSchema<PlayerState>();
}

defineTypes(
  MyRoomState,
  {
    gameName: "string",
    roomTitle: "string",
    isPrivate: "boolean",
    phase: "string",
    phaseEndsAt: "number",
    hunterCount: "number",
    winner: "string",
    hostId: "string",
    selectedMap: "string",
    activeMap: "string",
    players: {
      map: PlayerState,
    },
  },
);
