/**
 * LEVEL LIE — UI, input, flow
 */

(function () {
  const canvas = document.getElementById("game");
  const engine = new GameEngine(canvas);

  const titleScreen = document.getElementById("title-screen");
  const winScreen = document.getElementById("win-screen");
  const winText = document.getElementById("win-text");
  const btnStart = document.getElementById("btn-start");
  const btnNext = document.getElementById("btn-next");
  const btnRestart = document.getElementById("btn-restart");
  const hud = document.getElementById("hud");
  const controls = document.getElementById("controls");
  const levelLabel = document.getElementById("level-label");
  const deathCount = document.getElementById("death-count");
  const btnLeft = document.getElementById("btn-left");
  const btnRight = document.getElementById("btn-right");
  const btnJump = document.getElementById("btn-jump");

  let fakeWinClicks = 0;

  function showPlayUI() {
    titleScreen.classList.add("hidden");
    winScreen.classList.add("hidden");
    hud.classList.remove("hidden");
    controls.classList.remove("hidden");
  }

  function updateHud() {
    const lvl = window.LEVELS[engine.levelIndex];
    levelLabel.textContent = `LEVEL ${lvl.id} · ${lvl.name}`;
    deathCount.textContent = `смертей ${engine.totalDeaths}`;
  }

  function bindHold(el, key) {
    const down = (e) => {
      e.preventDefault();
      engine.keys[key] = true;
      el.classList.add("pressed");
    };
    const up = (e) => {
      e.preventDefault();
      engine.keys[key] = false;
      el.classList.remove("pressed");
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("pointercancel", up);
  }

  bindHold(btnLeft, "left");
  bindHold(btnRight, "right");
  bindHold(btnJump, "jump");

  // Keyboard for desktop testing
  const keyMap = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "jump",
    a: "left",
    d: "right",
    w: "jump",
    " ": "jump",
    з: "left", // cyrillic layouts ignore mostly
  };

  window.addEventListener("keydown", (e) => {
    const k = keyMap[e.key] || keyMap[e.key.toLowerCase()];
    if (!k) return;
    e.preventDefault();
    engine.keys[k] = true;
    if (k === "left") btnLeft.classList.add("pressed");
    if (k === "right") btnRight.classList.add("pressed");
    if (k === "jump") btnJump.classList.add("pressed");
  });

  window.addEventListener("keyup", (e) => {
    const k = keyMap[e.key] || keyMap[e.key.toLowerCase()];
    if (!k) return;
    engine.keys[k] = false;
    if (k === "left") btnLeft.classList.remove("pressed");
    if (k === "right") btnRight.classList.remove("pressed");
    if (k === "jump") btnJump.classList.remove("pressed");
  });

  // Prevent iOS scroll/bounce
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.target.closest("#controls") || e.target === canvas) e.preventDefault();
    },
    { passive: false }
  );

  btnStart.addEventListener("click", () => {
    engine.totalDeaths = 0;
    fakeWinClicks = 0;
    engine.startLevel(0);
    showPlayUI();
    updateHud();
    if (window.LEVELS[0].hint) engine.say(window.LEVELS[0].hint, 2.5);
  });

  btnRestart.addEventListener("click", () => {
    // Trick: first restart sometimes kills you / resets oddly on level 3+
    if (engine.levelIndex >= 2 && Math.random() < 0.35 && engine.state === "play") {
      engine.say("Рестарт? Смешно.");
      engine.killPlayer("restart");
      updateHud();
      return;
    }
    engine.startLevel(engine.levelIndex);
    showPlayUI();
    updateHud();
  });

  engine.onWin = (index) => {
    updateHud();
    winScreen.classList.remove("hidden");
    winText.textContent =
      index === 0
        ? "Ты всё ещё веришь в честную игру?"
        : index % 2 === 0
          ? `Всего смертей: ${engine.totalDeaths}. Мало.`
          : "Дверь была настоящей. На этот раз.";
    btnNext.textContent = "ДАЛЬШЕ";
    btnNext.onclick = () => {
      const next = index + 1;
      if (next >= window.LEVELS.length) {
        engine.completeGame();
        return;
      }
      engine.startLevel(next);
      showPlayUI();
      updateHud();
      const hint = window.LEVELS[next].hint;
      if (hint) engine.say(hint, 2.5);
      // Level 3: swap jump button label
      if (window.LEVELS[next].reverseJumpLabel) {
        btnJump.textContent = "не прыг";
        setTimeout(() => {
          btnJump.textContent = "прыг";
        }, 5000);
      } else {
        btnJump.textContent = "прыг";
      }
    };
  };

  engine.onFakeWin = () => {
    winScreen.classList.remove("hidden");
    winText.textContent = "Поздравляем! Ты прошёл игру.";
    btnNext.textContent = "ЗАБРАТЬ ПРИЗ";
    fakeWinClicks = 0;
    btnNext.onclick = () => {
      fakeWinClicks += 1;
      if (fakeWinClicks === 1) {
        winText.textContent = "Приз — это ещё один уровень.";
        btnNext.textContent = "НУ ЛАДНО";
        engine.say("Ха-ха.");
      } else if (fakeWinClicks === 2) {
        winText.textContent = "Шутка. Дверь была фейком. Иди снова.";
        btnNext.textContent = "ЕЩЁ РАЗ";
        engine.level._trueEnding = true;
        engine.level.door = { x: 320, y: 416, w: 36, h: 64, real: true };
        // Clear blink spikes on the floor route
        engine.level.hazards = [];
        engine.say("Ладно. Справа внизу. Без шуток.");
        engine.respawn();
        engine.state = "play";
        showPlayUI();
        updateHud();
      } else {
        engine.startLevel(engine.levelIndex);
        showPlayUI();
        updateHud();
      }
    };
  };

  engine.onComplete = (deaths) => {
    winScreen.classList.remove("hidden");
    hud.classList.remove("hidden");
    winText.textContent = `Конец. Смертей: ${deaths}. Дьявол тобой доволен.`;
    btnNext.textContent = "СНАЧАЛА";
    btnNext.onclick = () => {
      titleScreen.classList.remove("hidden");
      winScreen.classList.add("hidden");
      hud.classList.add("hidden");
      controls.classList.add("hidden");
      engine.state = "title";
    };
  };

  // Live HUD death updates
  const origKill = engine.killPlayer.bind(engine);
  engine.killPlayer = (reason) => {
    origKill(reason);
    updateHud();
  };

  function fit() {
    engine.resizeForDisplay();
  }
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", () => setTimeout(fit, 200));
  fit();
  engine.start();

  // PWA — force update so old cached engine.js cannot freeze on door touch
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js?v=4").then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => {});
  }
})();
