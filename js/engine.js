/**
 * LEVEL LIE — physics & rendering engine
 */

(function () {
  const GRAVITY = 2200;
  const MOVE_SPEED = 210;
  const JUMP_VEL = -620;
  const MAX_FALL = 900;
  const PLAYER_W = 28;
  const PLAYER_H = 36;

  class GameEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.W = canvas.width;
      this.H = canvas.height;

      this.keys = { left: false, right: false, jump: false };
      this.jumpPressed = false;
      this.jumpWasDown = false;

      this.state = "title"; // title | play | fakeWin | win | complete
      this.levelIndex = 0;
      this.level = null;
      this.deaths = 0;
      this.totalDeaths = 0;
      this.levelTime = 0;
      this.message = "";
      this.messageTimer = 0;

      this.player = this.makePlayer(40, 420);
      this.particles = [];
      this.shake = 0;
      this.inputScale = { x: 1, jump: true };
      this.reverseTimer = 0;
      this.jumpDisableTimer = 0;
      this.spawnGrace = 0;
      this.flags = {};
      this._scriptState = {};

      this._last = 0;
      this._raf = null;
      this.onWin = null;
      this.onComplete = null;
      this.onFakeWin = null;
    }

    makePlayer(x, y) {
      return {
        x,
        y,
        vx: 0,
        vy: 0,
        w: PLAYER_W,
        h: PLAYER_H,
        onGround: false,
        alive: true,
        facing: 1,
        blink: 0,
        coyote: 0,
        jumpBuffer: 0,
      };
    }

    deepCloneLevel(src) {
      // Scripts hold `run` functions — JSON clone would strip them and freeze the game.
      const scripts = src.scripts;
      const data = { ...src };
      delete data.scripts;
      const cloned = JSON.parse(JSON.stringify(data));
      // Always reattach from the live LEVELS definition (not a stale clone).
      cloned.scripts = scripts || [];
      return cloned;
    }

    startLevel(index) {
      this.levelIndex = index;
      const src = window.LEVELS[index];
      this.level = this.deepCloneLevel(src);
      // Belt-and-suspenders: never let scripts lose their run() handlers.
      this.level.scripts = src.scripts || [];
      this.deaths = 0;
      this.levelTime = 0;
      this.flags = {};
      this._scriptState = {};
      this.particles = [];
      this.reverseTimer = 0;
      this.jumpDisableTimer = 0;
      this.spawnGrace = 0;
      this.inputScale = { x: 1, jump: true };
      this.message = "";
      this.messageTimer = 0;
      this.respawn();
      this.state = "play";
      this.runScripts("onStart");
    }

    respawn() {
      const s = this.level.spawn;
      this.player = this.makePlayer(s.x, s.y);
      // Reset fallen platforms
      if (this.level.platforms) {
        this.level.platforms.forEach((p) => {
          if (p._fallen) {
            p._fallen = false;
            p._falling = false;
            p._fallTimer = 0;
            p.y = p._oy ?? p.y;
            p.solid = true;
          }
          if (p.trap === "fall" && p._oy == null) p._oy = p.y;
        });
      }
      if (this.level.hazards) {
        this.level.hazards.forEach((h) => {
          if (h.falling) {
            h.y = h._oy ?? h.y;
            h.vy = 0;
          }
          if (h._oy == null) h._oy = h.y;
        });
      }
      // Never leave the player standing inside a lethal hazard (soft-lock / death loop).
      this.ensureSafeSpawn();
      this.spawnGrace = 0.7;
    }

    isHazardLethal(h) {
      if (!h) return false;
      if (h.hidden) return false;
      if (h.armed === false) return false;
      return true;
    }

    overlapsLethalHazard(body) {
      for (const h of this.level.hazards || []) {
        if (!this.isHazardLethal(h)) continue;
        if (this.aabb(body, h)) return true;
      }
      return false;
    }

    /**
     * If the current spawn overlaps a lethal hazard, nudge the player to the
     * nearest clear x on the same y. Prevents "spawn on spikes → endless deaths".
     */
    ensureSafeSpawn() {
      const p = this.player;
      if (!p || !this.overlapsLethalHazard(p)) return;

      const preferred = this.level.spawn?.x ?? p.x;
      const y = p.y;
      let best = null;
      let bestDist = Infinity;

      for (let x = 18; x <= this.W - p.w - 18; x += 8) {
        const probe = { x, y, w: p.w, h: p.h };
        if (this.overlapsLethalHazard(probe)) continue;
        const dist = Math.abs(x - preferred);
        if (dist < bestDist) {
          bestDist = dist;
          best = x;
        }
      }

      if (best != null) {
        p.x = best;
        this.level.spawn = { x: best, y };
      }
    }

    say(text, time = 2.2) {
      this.message = text;
      this.messageTimer = time;
      const banner = document.getElementById("level-banner");
      if (banner) {
        banner.textContent = text;
        banner.classList.remove("hidden");
        clearTimeout(this._bannerT);
        this._bannerT = setTimeout(() => banner.classList.add("hidden"), time * 1000);
      }
    }

    spawnHazard(h) {
      this.level.hazards = this.level.hazards || [];
      if (h._oy == null) h._oy = h.y;
      this.level.hazards.push(h);
    }

    setJumpDisabled(t) {
      this.jumpDisableTimer = t;
    }

    reverseControls(t) {
      this.reverseTimer = t;
      this.inputScale.x = -1;
    }

    killPlayer(reason) {
      if (!this.player.alive) return;
      this.player.alive = false;
      this.deaths += 1;
      this.totalDeaths += 1;
      this.shake = 10;
      this.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, "#ff4d2e");
      this.runScripts("onDeathCount");
      setTimeout(() => {
        if (this.state === "play") this.respawn();
      }, 550);
      this._lastKillReason = reason;
    }

    winLevel() {
      if (this.state !== "play") return;
      this.state = "win";
      this.burst(this.player.x + 14, this.player.y + 10, "#ffd166");
      if (this.onWin) this.onWin(this.levelIndex);
    }

    showFakeWin() {
      this.state = "fakeWin";
      if (this.onFakeWin) this.onFakeWin();
    }

    completeGame() {
      this.state = "complete";
      if (this.onComplete) this.onComplete(this.totalDeaths);
    }

    runScripts(type, extra) {
      const scripts = this.level?.scripts || [];
      scripts.forEach((s, i) => {
        if (s.type !== type || typeof s.run !== "function") return;
        const key = `${type}_${i}`;
        if (s.once && this._scriptState[key]) return;
        if (type === "onDeathCount" && this.deaths < (s.count || 1)) return;
        if (type === "onTimer" && this.levelTime < (s.time || 0)) return;
        this._scriptState[key] = true;
        s.run(this, extra);
      });
    }

    updateScripts(dt) {
      const scripts = this.level?.scripts || [];
      scripts.forEach((s, i) => {
        if (typeof s.run !== "function") return;
        if (s.type === "onUpdate") s.run(this, dt);
        if (s.type === "onTimer") {
          const key = `onTimer_${i}`;
          if (!this._scriptState[key] && this.levelTime >= (s.time || 0)) {
            this._scriptState[key] = true;
            s.run(this);
          }
        }
        if (s.type === "onApproachDoor" && this.level.door) {
          const key = `onApproachDoor_${i}`;
          if (this._scriptState[key]) return;
          const d = this.level.door;
          const px = this.player.x + this.player.w / 2;
          const py = this.player.y + this.player.h / 2;
          const dx = px - (d.x + d.w / 2);
          const dy = py - (d.y + d.h / 2);
          const dist = Math.hypot(dx, dy);
          if (dist < (s.distance || 60)) {
            this._scriptState[key] = true;
            s.run(this);
          }
        }
        if (s.type === "onStandPlatform") {
          const key = `onStandPlatform_${i}`;
          if (this._scriptState[key]) return;
          const p = this.level.platforms[s.platformIndex];
          if (!p || !this.player.onGround) return;
          if (this.aabb(this.player, { x: p.x, y: p.y - 2, w: p.w, h: 8 })) {
            this._scriptState[key] = true;
            s.run(this);
          }
        }
      });
    }

    aabb(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    solidPlatforms() {
      return (this.level.platforms || []).filter((p) => p.solid && !p.fake && !p._fallen);
    }

    update(dt) {
      if (this.state !== "play") {
        this.updateParticles(dt);
        return;
      }

      this.levelTime += dt;
      if (this.messageTimer > 0) this.messageTimer -= dt;
      if (this.shake > 0) this.shake *= 0.85;

      if (this.reverseTimer > 0) {
        this.reverseTimer -= dt;
        if (this.reverseTimer <= 0) this.inputScale.x = 1;
      }
      if (this.jumpDisableTimer > 0) this.jumpDisableTimer -= dt;
      if (this.spawnGrace > 0) this.spawnGrace -= dt;

      // Falling ceiling spikes
      (this.level.hazards || []).forEach((h) => {
        if (h.falling) {
          h.vy = (h.vy || 0) + GRAVITY * 0.45 * dt;
          h.y += h.vy * dt;
        }
        if (h.blink) {
          const period = (h.blinkOn || 0.6) + (h.blinkOff || 0.6);
          const t = (this.levelTime + (h.phase || 0)) % period;
          h.hidden = t > (h.blinkOn || 0.6);
        }
      });

      // Runaway door
      const door = this.level.door;
      if (door?.runawayActive) {
        door.x += (door.runawaySpeed || 80) * dt;
        if (door.x > this.W - 50) {
          door.x = this.W - 50;
          door.y -= 120 * dt;
          if (door.y < 40) door.y = 40;
        }
      }

      this.updatePlayer(dt);
      this.updateScripts(dt);
      this.checkHazards();
      this.checkDoor();
      this.updateParticles(dt);
    }

    updatePlayer(dt) {
      const p = this.player;
      if (!p.alive) return;

      let move = 0;
      if (this.keys.left) move -= 1;
      if (this.keys.right) move += 1;
      move *= this.inputScale.x;
      p.vx = move * MOVE_SPEED;
      if (move) p.facing = move > 0 ? 1 : -1;

      // jump buffer / coyote
      const jumpDown = this.keys.jump;
      this.jumpPressed = jumpDown && !this.jumpWasDown;
      this.jumpWasDown = jumpDown;

      if (this.jumpPressed) p.jumpBuffer = 0.12;
      else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

      if (p.onGround) p.coyote = 0.09;
      else p.coyote = Math.max(0, p.coyote - dt);

      const canJump = this.jumpDisableTimer <= 0;
      if (p.jumpBuffer > 0 && p.coyote > 0 && canJump) {
        p.vy = JUMP_VEL;
        p.onGround = false;
        p.coyote = 0;
        p.jumpBuffer = 0;
        this.burst(p.x + p.w / 2, p.y + p.h, "#f4e6d4", 4);

        if (!this.flags.firstJump) {
          this.flags.firstJump = true;
          this.runScripts("onFirstJump");
        }
      } else if (this.jumpPressed && !canJump) {
        this.say("…нет.", 0.8);
      }

      // gravity
      p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
      if (!jumpDown && p.vy < -120) p.vy *= 0.96; // variable jump cut soft

      // horizontal move + collide
      p.x += p.vx * dt;
      this.collideAxis(p, "x");

      // vertical
      p.y += p.vy * dt;
      p.onGround = false;
      this.collideAxis(p, "y");

      // fall traps
      this.level.platforms.forEach((plat) => {
        if (plat.trap !== "fall" || plat._fallen || plat.fake) return;
        if (!p.onGround) return;
        // standing on it?
        if (
          p.y + p.h <= plat.y + 4 &&
          p.y + p.h >= plat.y - 6 &&
          p.x + p.w > plat.x + 4 &&
          p.x < plat.x + plat.w - 4
        ) {
          plat._fallTimer = (plat._fallTimer || 0) + dt;
          if (plat._fallTimer >= (plat.fallDelay || 0.2)) {
            plat._falling = true;
            plat.solid = false;
            plat._fallen = true;
            this.runScripts("onFallTrap");
            this.burst(plat.x + plat.w / 2, plat.y, "#a8927a", 8);
          }
        }
      });

      // first land after first jump
      if (this.flags.firstJump && p.onGround && !this.flags.landedAfter) {
        this.flags.landedAfter = true;
        this.runScripts("onLandAfterFirstJump");
      }

      // world bounds death
      if (p.y > this.H + 40) this.killPlayer("упал");

      // fake platforms: walk through visually but already not solid via filter... 
      // fake platforms are drawn but not in solidPlatforms
    }

    collideAxis(p, axis) {
      const plats = this.solidPlatforms();
      for (const plat of plats) {
        if (!this.aabb(p, plat)) continue;
        if (axis === "x") {
          if (p.vx > 0) p.x = plat.x - p.w;
          else if (p.vx < 0) p.x = plat.x + plat.w;
          p.vx = 0;
        } else {
          if (p.vy > 0) {
            p.y = plat.y - p.h;
            p.vy = 0;
            p.onGround = true;
          } else if (p.vy < 0) {
            p.y = plat.y + plat.h;
            p.vy = 0;
          }
        }
      }
      // clamp walls soft
      if (p.x < 0) p.x = 0;
      if (p.x + p.w > this.W) p.x = this.W - p.w;
    }

    checkHazards() {
      const p = this.player;
      if (!p.alive) return;
      // Brief post-respawn grace so a bad spawn cannot soft-lock the run.
      if (this.spawnGrace > 0) return;
      for (const h of this.level.hazards || []) {
        if (!this.isHazardLethal(h)) continue;
        if (this.aabb(p, h)) {
          this.killPlayer("шип");
          return;
        }
      }
    }

    checkDoor() {
      const p = this.player;
      const d = this.level.door;
      if (!p.alive || !d) return;
      if (!this.aabb(p, d)) return;

      // touch door scripts always
      const scripts = this.level.scripts || [];
      scripts.forEach((s, i) => {
        if (s.type !== "onTouchDoor" || typeof s.run !== "function") return;
        if (s.once && this._scriptState[`onTouchDoor_${i}`]) return;
        if (s.once) this._scriptState[`onTouchDoor_${i}`] = true;
        s.run(this);
      });

      if (d.fakeWin && !this.level._trueEnding) {
        // handled in script
        return;
      }
      if (d.real) {
        if (this.levelIndex >= window.LEVELS.length - 1) {
          this.completeGame();
        } else {
          this.winLevel();
        }
      }
    }

    burst(x, y, color, n = 12) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 180;
        this.particles.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 80,
          life: 0.4 + Math.random() * 0.4,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    }

    updateParticles(dt) {
      this.particles = this.particles.filter((pt) => {
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 800 * dt;
        return pt.life > 0;
      });
    }

    draw() {
      const ctx = this.ctx;
      const pad = this.shake > 0.5 ? (Math.random() - 0.5) * this.shake : 0;
      ctx.save();
      ctx.translate(pad, pad);

      // background
      const g = ctx.createLinearGradient(0, 0, 0, this.H);
      g.addColorStop(0, "#241811");
      g.addColorStop(1, "#120e0b");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);

      // subtle grid
      ctx.strokeStyle = "rgba(255,209,102,0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < this.W; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.H);
        ctx.stroke();
      }

      if (this.state === "title") {
        ctx.restore();
        return;
      }

      if (!this.level) {
        ctx.restore();
        return;
      }

      // platforms
      for (const p of this.level.platforms) {
        if (p._fallen) continue;
        if (p.invisible) continue;
        this.drawPlatform(p);
      }

      // hazards
      for (const h of this.level.hazards || []) {
        if (h.hidden) continue;
        if (h.armed === false) {
          // draw faint outline
          ctx.globalAlpha = 0.15;
          this.drawSpike(h);
          ctx.globalAlpha = 1;
        } else {
          this.drawSpike(h);
        }
      }

      // door
      if (this.level.door) this.drawDoor(this.level.door);

      // player
      if (this.player.alive) this.drawPlayer(this.player);
      else {
        ctx.globalAlpha = 0.35;
        this.drawPlayer(this.player);
        ctx.globalAlpha = 1;
      }

      // particles
      for (const pt of this.particles) {
        ctx.globalAlpha = Math.max(0, pt.life * 2);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    drawPlatform(p) {
      const ctx = this.ctx;
      if (p.fake) {
        ctx.fillStyle = "#3d3128";
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = "rgba(244,230,212,0.15)";
        ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
        // crack hint very subtle
        return;
      }
      ctx.fillStyle = "#4a3b30";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#6b5646";
      ctx.fillRect(p.x, p.y, p.w, 5);
      ctx.fillStyle = "#2a211c";
      ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
      if (p.trap === "fall") {
        ctx.fillStyle = "rgba(255,77,46,0.15)";
        ctx.fillRect(p.x + 4, p.y + 6, p.w - 8, 3);
      }
    }

    drawSpike(h) {
      const ctx = this.ctx;
      const spikes = Math.max(2, Math.floor(h.w / 12));
      const sw = h.w / spikes;
      ctx.fillStyle = "#ff2e4d";
      ctx.beginPath();
      if (h.fromCeiling) {
        for (let i = 0; i < spikes; i++) {
          const x = h.x + i * sw;
          ctx.moveTo(x, h.y);
          ctx.lineTo(x + sw / 2, h.y + h.h);
          ctx.lineTo(x + sw, h.y);
        }
      } else {
        for (let i = 0; i < spikes; i++) {
          const x = h.x + i * sw;
          ctx.moveTo(x, h.y + h.h);
          ctx.lineTo(x + sw / 2, h.y);
          ctx.lineTo(x + sw, h.y + h.h);
        }
      }
      ctx.fill();
      ctx.fillStyle = "#ffd166";
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    drawDoor(d) {
      const ctx = this.ctx;
      // frame
      ctx.fillStyle = d.real ? "#3ecf8e" : "#ff4d2e";
      ctx.fillRect(d.x - 3, d.y - 3, d.w + 6, d.h + 6);
      ctx.fillStyle = "#1a1512";
      ctx.fillRect(d.x, d.y, d.w, d.h);
      // panels
      ctx.strokeStyle = d.real ? "#2a9f6c" : "#a83220";
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x + 6, d.y + 8, d.w - 12, d.h / 2 - 12);
      ctx.strokeRect(d.x + 6, d.y + d.h / 2 + 2, d.w - 12, d.h / 2 - 12);
      // knob
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(d.x + d.w - 10, d.y + d.h / 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // devil smile on fake doors
      if (!d.real) {
        ctx.strokeStyle = "#ff4d2e";
        ctx.beginPath();
        ctx.arc(d.x + d.w / 2, d.y + 22, 8, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    }

    drawPlayer(p) {
      const ctx = this.ctx;
      const x = p.x;
      const y = p.y;
      // body
      ctx.fillStyle = "#f4e6d4";
      ctx.fillRect(x, y + 8, p.w, p.h - 8);
      // horns
      ctx.fillStyle = "#ff4d2e";
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 10);
      ctx.lineTo(x + 8, y);
      ctx.lineTo(x + 12, y + 10);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + p.w - 4, y + 10);
      ctx.lineTo(x + p.w - 8, y);
      ctx.lineTo(x + p.w - 12, y + 10);
      ctx.fill();
      // eyes
      ctx.fillStyle = "#140f0c";
      const eyeY = y + 18;
      const ex = p.facing >= 0 ? 1 : -1;
      ctx.fillRect(x + 7 + ex, eyeY, 4, 5);
      ctx.fillRect(x + 17 + ex, eyeY, 4, 5);
      // feet
      ctx.fillStyle = "#c4a882";
      ctx.fillRect(x + 2, y + p.h - 4, 10, 4);
      ctx.fillRect(x + p.w - 12, y + p.h - 4, 10, 4);
    }

    loop = (ts) => {
      if (!this._last) this._last = ts;
      let dt = (ts - this._last) / 1000;
      this._last = ts;
      dt = Math.min(0.033, dt);
      this.update(dt);
      this.draw();
      this._raf = requestAnimationFrame(this.loop);
    };

    start() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._last = 0;
      this._raf = requestAnimationFrame(this.loop);
    }

    resizeForDisplay() {
      // keep internal resolution; CSS scales
      const parent = this.canvas.parentElement;
      const controls = 118;
      const w = parent.clientWidth;
      const h = parent.clientHeight - controls;
      // internal logical size stays 390 x ~520 ratio
      const targetRatio = 390 / 520;
      let cw = 390;
      let ch = Math.round(390 * (h / w) * (w / 390));
      // simpler: fixed design res
      this.canvas.width = 390;
      this.canvas.height = Math.max(480, Math.min(640, Math.round(390 * (h / Math.max(w, 1)))));
      this.W = this.canvas.width;
      this.H = this.canvas.height;
    }
  }

  window.GameEngine = GameEngine;
})();
