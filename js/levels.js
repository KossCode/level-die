/**
 * LEVEL LIE — level definitions
 * World size: 390 x 520 (canvas play area; controls below)
 * Player spawn, platforms, hazards, doors, triggers, scripts.
 */

const TILE = 26;

function rect(x, y, w, h, opts = {}) {
  return { x, y, w, h, ...opts };
}

window.LEVELS = [
  {
    id: 1,
    name: "ДОВЕРИЕ",
    hint: "Просто дойди до двери.",
    spawn: { x: 40, y: 420 },
    platforms: [
      rect(0, 480, 390, 40, { solid: true }),
      rect(0, 0, 390, 24, { solid: true }),
      rect(0, 24, 18, 456, { solid: true }),
      rect(372, 24, 18, 456, { solid: true }),
    ],
    door: { x: 300, y: 416, w: 36, h: 64, real: false },
    fakeDoors: [],
    hazards: [],
    scripts: [
      {
        type: "onTouchDoor",
        once: true,
        run(game) {
          game.say("Ха. Не эта.");
          game.spawnHazard(rect(292, 456, 52, 24, { kind: "spike", fromCeiling: false }));
          game.killPlayer("Дверь была фейком");
          // Real door appears on left after death / on next attempt handled below
        },
      },
      {
        type: "onDeathCount",
        count: 1,
        once: true,
        run(game) {
          game.level.door = { x: 48, y: 416, w: 36, h: 64, real: true };
          game.say("Теперь слева. Или нет?");
        },
      },
    ],
  },

  {
    id: 2,
    name: "МОСТ",
    hint: "Прыгай аккуратно.",
    spawn: { x: 36, y: 420 },
    platforms: [
      rect(0, 480, 110, 40, { solid: true }),
      rect(280, 480, 110, 40, { solid: true }),
      rect(120, 480, 150, 40, { solid: true, trap: "fall", fallDelay: 0.18 }),
      rect(0, 0, 390, 24, { solid: true }),
      rect(0, 24, 18, 456, { solid: true }),
      rect(372, 24, 18, 456, { solid: true }),
      rect(180, 360, 70, 18, { solid: true, fake: true }),
      // Secret safe ledge after you learn the trick
      rect(200, 420, 50, 14, { solid: true, invisible: true }),
    ],
    door: { x: 318, y: 416, w: 36, h: 64, real: true },
    hazards: [
      rect(130, 456, 130, 24, { kind: "spike", hidden: true, revealOn: "fallTrap" }),
    ],
    scripts: [
      {
        type: "onFallTrap",
        once: true,
        run(game) {
          game.say("Мост любил тебя… недолго.");
          game.level.hazards.forEach((h) => {
            if (h.revealOn === "fallTrap") h.hidden = false;
          });
        },
      },
      {
        type: "onDeathCount",
        count: 2,
        once: true,
        run(game) {
          game.say("Иногда воздух тоже держит.");
        },
      },
    ],
  },

  {
    id: 3,
    name: "КНОПКА",
    hint: "Прыжок — твой друг.",
    spawn: { x: 40, y: 420 },
    reverseJumpLabel: true,
    platforms: [
      rect(0, 480, 390, 40, { solid: true }),
      rect(0, 0, 390, 24, { solid: true }),
      rect(0, 24, 18, 456, { solid: true }),
      rect(372, 24, 18, 456, { solid: true }),
      rect(160, 380, 80, 18, { solid: true }),
      rect(250, 300, 80, 18, { solid: true }),
      rect(160, 220, 80, 18, { solid: true }),
      rect(60, 160, 80, 18, { solid: true }),
    ],
    door: { x: 70, y: 96, w: 36, h: 64, real: true },
    hazards: [
      rect(250, 276, 80, 24, { kind: "spike", hidden: true, revealOn: "firstJump" }),
    ],
    scripts: [
      {
        type: "onFirstJump",
        once: true,
        run(game) {
          game.say("Кнопка «прыг» иногда врёт.");
          game.level.hazards.forEach((h) => {
            if (h.revealOn === "firstJump") h.hidden = false;
          });
          // Swap jump to do nothing for 1.2s then restore, and reverse controls briefly
          game.setJumpDisabled(1.4);
        },
      },
      {
        type: "onLandAfterFirstJump",
        once: true,
        run(game) {
          game.reverseControls(3.5);
          game.say("А теперь влево — это вправо.");
        },
      },
    ],
  },

  {
    id: 4,
    name: "ПОЧТИ",
    hint: "Дверь рядом.",
    spawn: { x: 40, y: 420 },
    platforms: [
      rect(0, 480, 390, 40, { solid: true }),
      rect(0, 0, 390, 24, { solid: true }),
      rect(0, 24, 18, 456, { solid: true }),
      rect(372, 24, 18, 456, { solid: true }),
      rect(200, 420, 100, 18, { solid: true }),
      rect(90, 340, 100, 18, { solid: true }),
      rect(220, 260, 100, 18, { solid: true }),
      rect(300, 180, 54, 18, { solid: true }),
    ],
    door: { x: 310, y: 116, w: 36, h: 64, real: true, runaway: true, runawaySpeed: 90 },
    hazards: [
      rect(90, 316, 100, 24, { kind: "spike", armed: false }),
    ],
    scripts: [
      {
        type: "onApproachDoor",
        distance: 70,
        once: true,
        run(game) {
          game.say("Догони, если сможешь.");
          game.level.door.runawayActive = true;
          game.level.hazards[0].armed = true;
        },
      },
    ],
  },

  {
    id: 5,
    name: "ЧЕСТНОСТЬ",
    hint: "На этот раз всё честно.",
    spawn: { x: 40, y: 420 },
    platforms: [
      rect(0, 480, 390, 40, { solid: true }),
      rect(0, 0, 390, 24, { solid: true }),
      rect(0, 24, 18, 456, { solid: true }),
      rect(372, 24, 18, 456, { solid: true }),
      // Safe looking path
      rect(60, 400, 70, 16, { solid: true }),
      rect(150, 340, 70, 16, { solid: true, fake: true }),
      rect(240, 280, 70, 16, { solid: true }),
      rect(150, 220, 70, 16, { solid: true, trap: "fall", fallDelay: 0.05 }),
      rect(50, 160, 90, 16, { solid: true }),
      // Hidden real path on the floor right side - need to walk into wall gap? 
      // Actually: door is at bottom right but spikes cover approach until you wait
    ],
    door: { x: 300, y: 416, w: 36, h: 64, real: false },
    realDoorHidden: { x: 48, y: 96, w: 36, h: 64, real: true },
    hazards: [
      rect(280, 456, 80, 24, { kind: "spike" }),
      rect(50, 136, 90, 24, { kind: "spike", hidden: true, revealOn: "touchTop" }),
    ],
    scripts: [
      {
        type: "onTouchDoor",
        once: false,
        run(game) {
          if (!game.level.door.real) {
            game.say("«Честно» — тоже ложь.");
            game.killPlayer("Фейковая дверь");
          }
        },
      },
      {
        type: "onDeathCount",
        count: 2,
        once: true,
        run(game) {
          game.level.door = { ...game.level.realDoorHidden };
          game.say("Ладно. Наверху слева.");
        },
      },
      {
        type: "onStandPlatform",
        platformIndex: 8, // top platform index in list (0-based among platforms) - careful
        once: true,
        run(game) {
          game.level.hazards.forEach((h) => {
            if (h.revealOn === "touchTop") h.hidden = false;
          });
          game.say("Шипы скучали по тебе.");
        },
      },
    ],
  },

  {
    id: 6,
    name: "ТИШИНА",
    hint: "…",
    spawn: { x: 40, y: 200 },
    platforms: [
      rect(0, 260, 120, 24, { solid: true }),
      rect(0, 0, 390, 24, { solid: true }),
      rect(0, 24, 18, 456, { solid: true }),
      rect(372, 24, 18, 200, { solid: true }),
      rect(200, 320, 90, 18, { solid: true }),
      rect(80, 400, 90, 18, { solid: true }),
      rect(220, 460, 150, 24, { solid: true }),
      // Invisible bridge
      rect(120, 260, 100, 18, { solid: true, invisible: true }),
      rect(270, 260, 100, 18, { solid: true, invisible: true }),
    ],
    door: { x: 310, y: 396, w: 36, h: 64, real: true },
    hazards: [
      rect(130, 456, 90, 24, { kind: "spike" }),
      rect(200, 296, 90, 24, { kind: "spike", hidden: true, revealOn: "timer", timer: 2.5 }),
    ],
    scripts: [
      {
        type: "onStart",
        once: true,
        run(game) {
          game.say("Пол есть. Просто стесняется.");
        },
      },
      {
        type: "onTimer",
        time: 2.5,
        once: true,
        run(game) {
          game.level.hazards.forEach((h) => {
            if (h.revealOn === "timer") h.hidden = false;
          });
        },
      },
    ],
  },

  {
    id: 7,
    name: "ПОБЕДА",
    hint: "Последний уровень. Честно.",
    spawn: { x: 40, y: 420 },
    platforms: [
      rect(0, 480, 390, 40, { solid: true }),
      rect(0, 0, 390, 24, { solid: true }),
      rect(0, 24, 18, 456, { solid: true }),
      rect(372, 24, 18, 456, { solid: true }),
      rect(100, 400, 60, 16, { solid: true }),
      rect(180, 340, 60, 16, { solid: true }),
      rect(260, 280, 60, 16, { solid: true }),
      rect(180, 220, 60, 16, { solid: true }),
      rect(100, 160, 60, 16, { solid: true }),
      rect(200, 100, 120, 16, { solid: true }),
    ],
    door: { x: 250, y: 36, w: 36, h: 64, real: true, fakeWin: true },
    hazards: [
      rect(180, 316, 60, 24, { kind: "spike", blink: true, blinkOn: 0.7, blinkOff: 0.55 }),
      rect(100, 136, 60, 24, { kind: "spike", blink: true, blinkOn: 0.5, blinkOff: 0.7, phase: 0.3 }),
    ],
    scripts: [
      {
        type: "onTouchDoor",
        once: true,
        run(game) {
          if (game.level.door.fakeWin && !game.level._trueEnding) {
            game.showFakeWin();
          }
        },
      },
    ],
  },

  {
    id: 8,
    name: "ЛАДНО",
    hint: "Хватит врать.",
    spawn: { x: 175, y: 420 },
    platforms: [
      rect(0, 480, 390, 40, { solid: true }),
      rect(0, 0, 390, 24, { solid: true }),
      rect(0, 24, 18, 456, { solid: true }),
      rect(372, 24, 18, 456, { solid: true }),
    ],
    door: { x: 177, y: 416, w: 36, h: 64, real: true },
    hazards: [],
    scripts: [
      {
        type: "onStart",
        once: true,
        run(game) {
          game.say("Иди. Без фокусов.");
          // After 0.8s crush ceiling spike from above if they wait; door works immediately
          game.level._mercyTimer = 0;
        },
      },
      {
        type: "onUpdate",
        run(game, dt) {
          if (game.level._cleared) return;
          game.level._mercyTimer = (game.level._mercyTimer || 0) + dt;
          // If player hasn't entered door in 4s, spawn surprise spike under them... joke then remove
          if (game.level._mercyTimer > 4 && !game.level._annoyed) {
            game.level._annoyed = true;
            game.say("Ну же…");
          }
          if (game.level._mercyTimer > 7 && !game.level._trap) {
            game.level._trap = true;
            game.spawnHazard(rect(160, 40, 70, 24, { kind: "spike", fromCeiling: true, falling: true, vy: 0 }));
            game.say("Ладно, ОДИН фокус.");
          }
        },
      },
    ],
  },
];
