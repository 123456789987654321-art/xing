/* 游戏流程 / 交互 / 动画编排 */
(function () {
  'use strict';

  const MX = window.MX, m4 = MX.m4, m3 = MX.m3, v3 = MX.v3;
  const clamp = MX.clamp;

  /* ---------- 配色：红 紫 绿 蓝 黄 粉 ---------- */
  const PALETTE = [
    { name: '红', rgb: [0.91, 0.37, 0.29] },
    { name: '紫', rgb: [0.57, 0.38, 0.76] },
    { name: '绿', rgb: [0.27, 0.65, 0.43] },
    { name: '蓝', rgb: [0.25, 0.56, 0.79] },
    { name: '黄', rgb: [0.94, 0.72, 0.24] },
    { name: '粉', rgb: [0.86, 0.45, 0.67] },
    { name: '万能', rgb: [0.48, 0.52, 0.60] }
  ];
  const NC = 6;
  const TILE_BEVEL = 1.0, TILE_STAR = 1.0;

  /* 星级：按第一关目标的倍数走，这样不同尺寸的立方体都合适 */
  const STAR_MULT = [1, 3, 6, 10, 15];

  /* ============================================================
     应用主体
     ============================================================ */
  const App = {
    /* --- 运行时数据 --- */
    state: 'menu',
    mode: 'normal',
    level: 1,
    N: 5,
    zoom: 0,
    score: 0,
    target: 0,
    tilesAll: 0,
    board: null,
    rotor: null,
    mainMatcher: null,
    viewLinks: [],
    scene: null,
    tiles: null,          // 按格 id 索引
    dying: [],            // 正在消散的方块
    renderList: [],
    hoverIds: null,
    hintIds: null,
    hintTime: 0,
    hintCamera: null,
    timer: null,          // 一次性延时 { t, fn }
    clock: 0,
    lastTickSec: -1,
    lastHudSec: -1,
    landSfxCd: 0,
    best: 0,
    newRecord: false,

    /* ---------- 启动 ---------- */
    boot() {
      const canvas = document.getElementById('gl');
      try {
        this.scene = new window.Scene(canvas);
      } catch (err) {
        const b = document.getElementById('bootErr');
        b.className = '';
        b.textContent = '启动失败：' + err.message;
        return;
      }
      this.buildSky();
      this.bindUI();
      this.bindInput();
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.best = this.loadBest();
      this.updateMenuBest();

      // 显卡上下文丢失（驱动重置 / 标签页休眠太久）时给个明确提示
      canvas.addEventListener('webglcontextlost', (ev) => {
        ev.preventDefault();
        const b = document.getElementById('bootErr');
        b.className = '';
        b.innerHTML = '图形上下文丢失了（通常是显卡驱动重置或标签页休眠太久）。<br>刷新页面就能接着玩。';
      });

      // 菜单里的展示立方体
      this.board = new window.Board(5);
      this.board.fillRandom(NC, Math.random);
      this.spawnTilesInstant();
      this.scene.dist = this.scene.fitDist * 1.55;   // 菜单里把展示立方体放远一点，别顶到字

      const loop = (now) => {
        this.frame(now);
        requestAnimationFrame(loop);
      };
      this.last = performance.now();
      requestAnimationFrame(loop);
      window.addEventListener('resize', () => {
        this.scene.resize();
        if (this.state !== 'menu') this.setZoom(this.zoom);
      });
      // 样式表如果加载得比脚本晚，首帧的 clientWidth 会是 canvas 默认尺寸，重新量一次
      window.addEventListener('load', () => this.scene.resize());
    },

    buildSky() {
      const sky = document.getElementById('sky');
      const n = Math.min(140, Math.floor(window.innerWidth / 8));
      let html = '';
      for (let i = 0; i < n; i++) {
        const s = (Math.random() * 2.1 + 0.7).toFixed(1);
        html += '<i style="left:' + (Math.random() * 100).toFixed(2) + '%;top:' +
          (Math.random() * 100).toFixed(2) + '%;width:' + s + 'px;height:' + s +
          'px;animation-delay:' + (Math.random() * 3.4).toFixed(2) + 's;opacity:.' +
          (30 + Math.floor(Math.random() * 55)) + '"></i>';
      }
      sky.innerHTML = html;
    },

    /* ---------- 最高分 ---------- */
    loadBest() {
      try {
        const v = parseInt(window.localStorage.getItem((this.storagePrefix||'popstar3d')+'.best'), 10);
        return isFinite(v) && v > 0 ? v : 0;
      } catch (e) { return 0; }
    },
    saveBest(v) {
      try { window.localStorage.setItem((this.storagePrefix||'popstar3d')+'.best', String(v)); } catch (e) { /* 本地文件可能不允许 */ }
    },
    trackBest() {
      if (this.mode === 'test') return;
      if (this.score > this.best) {
        this.best = this.score;
        this.newRecord = true;
        this.saveBest(this.best);
        this.updateMenuBest();
      }
    },
    updateMenuBest() {
      const el = document.getElementById('menuBest');
      if (el) el.textContent = this.best;
    },

    /* ---------- 关卡参数 ---------- */
    cubeSizeFor(mode, level) {
      if (mode === 'test') return 7;
      return window.LevelProfile(level,mode).size;
    },
    targetFor(level, tiles) {
      // 挑战按本关块数独立设定目标；普通模式保留累计目标。
      const points = this.mode === 'challenge' ? 750 : 750 * level + 350 * level * (level - 1);
      const raw = points * (tiles / 150);
      return Math.round(raw / 100) * 100;
    },
    starSteps() {
      const base = this.targetFor(1, 98) || 500;
      return STAR_MULT.map((m) => Math.round(base * m / 100) * 100);
    },

    /* ============================================================
       方块 / 棋盘
       ============================================================ */
    colorAt(id) {
      if (id < 0) return -1;
      if (id < this.board.size) return this.board.colorOf(id);
      const index = id - this.board.size;
      if (this.rotor) return this.rotor.colors[index] ?? -1;
      return -1;
    },
    remainingCount() { return this.board.aliveCount() + (this.rotor ? this.rotor.remaining() : 0); },
    groupAt(id) {
      if (!this.rotor) return this.board.groupOf(id);
      const c = this.colorAt(id);
      if (c < 0 || this.board.covered[id]) return [];
      const contacts = (this.rotor ? this.rotor.contacts() : []).concat(this.rotor&&!this.rotor.projected?[]:this.viewLinks);
      const run = color => {
        const out = [], stack = [id], seen = new Set([id]);
        while (stack.length) {
          const cur = stack.pop(); out.push(cur);
          const neighbors = cur < this.board.size ? this.board.neighbors(cur) : this.rotor ? this.rotor.neighbors(cur - this.board.size).map(i => i + this.board.size) : [];
          contacts.forEach(([a, b]) => { if (a === cur) neighbors.push(b); else if (b === cur) neighbors.push(a); });
          for (const next of neighbors) if (!seen.has(next) && !this.board.covered[next] && (this.colorAt(next) === color || this.colorAt(next) === 6)) { seen.add(next); stack.push(next); }
        }
        return out;
      };
      return c === 6 ? Array.from({ length: 6 }, (_, color) => run(color)).sort((a, b) => b.length - a.length)[0] : run(c);
    },
    hasPotentialMoves() {
      if (this.board.hasMoves()) return true;
      if (this.rotor && this.rotor.projected) {
        const matches = (a, b) => a >= 0 && b >= 0 && (a === b || a === 6 || b === 6);
        const colors = [];
        for (let id = 0; id < this.board.size; id++) {
          const color = this.board.color[id];
          if (color < 0 || this.board.covered[id]) continue;
          if (colors.some(other => matches(color, other))) return true;
          colors.push(color);
        }
        for(let i=0;i<this.rotor.colors.length;i++) {
          const color=this.rotor.colors[i];
          if(color<0)continue;
          if(this.groupAt(this.board.size+i).length>=2)return true;
          // Eligible body blocks and different panels may join in a future view.
          if(colors.some(other=>matches(color,other)))return true;
          if(this.rotor.colors.some((c,j)=>Math.floor(j/6)!==Math.floor(i/6)&&matches(color,c)))return true;
        }
        return false;
      }
      if (this.rotor && this.rotor.remaining()) {
        const saved = this.rotor.angle;
        let possible = false;
        for (let step = 0; step < 48 && !possible; step++) {
          this.rotor.angle = step * Math.PI / 24;
          for (let i = 0; i < this.rotor.colors.length; i++) if (this.rotor.colors[i] >= 0 && this.groupAt(this.board.size + i).length >= 2) { possible = true; break; }
        }
        this.rotor.angle = saved;
        return possible;
      }
      return false;
    },
    updateMechanics(dt) {
      if (this.rotor && ['play', 'busy'].includes(this.state)) {
        this.rotor.update(dt);
        for (let i = 0; i < this.rotor.colors.length; i++) {
          const tile = this.tiles[this.board.size + i];
          if (!tile) continue;
          tile.center = this.rotor.center(i); tile.basis = this.rotor.basis(i); tile.homeBasis = tile.basis.slice();
        }
        const signature = JSON.stringify(this.rotor.contacts());
        if (this.rotorContactKey !== signature) {
          this.rotorContactKey = signature; this.clearHover();
          if (this.hintIds && this.hintIds.some(id => id >= this.board.size)) this.clearHint();
        }
      }
    },
    tileGeom() {
      const p = this.board.pitch;
      return { size: [p, p, p] };
    },

    /** 某格方块在世界空间中的中心 */
    centerOf(id) {
      return this.board.cellCenter(id);
    },

    makeTile(id, color) {
      const b = this.board;
      const f = b.faceOf(id);
      const geom = this.tileGeom();
      const basis = b.faceBasis(f);
      return {
        id,
        color,
        center: this.centerOf(id),
        homeBasis: basis,
        basis: basis.slice(),
        baseSize: geom.size.slice(),
        size: geom.size.slice(),
        model: m4.create(),
        alpha: 1,
        highlight: 0,
        hintGlow: 0,
        hintLift: 0,
        scaleMul: 1,
        squash: 0,
        anim: null,
        gone: false,
        spinAxis: v3.norm([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1])
      };
    },

    /** 立刻铺好（菜单展示用） */
    spawnTilesInstant() {
      const b = this.board;
      this.tiles = new Array(b.size).fill(null);
      this.tilesAll = b.size + (this.rotor ? this.rotor.colors.length : 0);
      for (let id = 0; id < b.size; id++) {
        if (b.color[id] >= 0) this.tiles[id] = this.makeTile(id, b.color[id]);
      }
    },

    /** 从天而降（开局动画） */
    spawnTilesFalling(fast) {
      const b = this.board;
      const k = fast ? 0.55 : 1;                 // 后续关卡节奏紧凑一点
      const waveStart = [0, 0.78, 1.52].map((s) => s * k);
      const waveOf = { 5: 0, 0: 1, 1: 1, 2: 1, 3: 1, 4: 2 };

      this.tiles = new Array(b.size).fill(null);
      this.tilesAll = b.size + (this.rotor ? this.rotor.colors.length : 0);
      this.dying.length = 0;

      for (let id = 0; id < b.size; id++) {
        if (b.color[id] < 0) continue;
        const f = b.faceOf(id);
        const t = this.makeTile(id, b.color[id]);
        const to = t.center.slice();
        // 从画面上方之外落下即可，太高的话大部分时间都在屏幕外，白等
        const drop = 9.5 + Math.random() * 3.5;
        t.center = [to[0] + (Math.random() - 0.5) * 1.1, to[1] + drop, to[2] + (Math.random() - 0.5) * 1.1];
        t.anim = {
          type: 'fall',
          t: 0,
          delay: waveStart[waveOf[f]] + Math.random() * 0.42 * k,
          dur: (0.58 + Math.random() * 0.12) * k,
          from: t.center.slice(),
          to,
          spinAxis: t.spinAxis,
          spin0: (Math.random() * 2 - 1) * 3.6,
          done: false
        };
        this.tiles[id] = t;
      }
      this.state = 'intro';
      // 最后一波最晚落地的时刻 = waveStart[2] + 随机延迟上限 + 最长下落时长
      this.introLeft = waveStart[2] + 0.42 * k + 0.70 * k + 0.28;
      window.Sfx.start();
    },

    /* ============================================================
       帧循环
       ============================================================ */
    frame(now) {
      // 上限 50ms：切标签页回来后不要一次跳太多；同时防止时间回退产生负的 dt
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.clock += dt;
      if(this.challenge){this.challenge.frame(dt);return;}

      if (this.state === 'menu') {
        this.scene.yaw += dt * 0.24;
        this.scene.pitch = 0.30 + Math.sin(this.clock * 0.42) * 0.16;
      }
      if (this.state === 'menu') this.scene.dist = clamp(this.scene.dist, this.scene.fitDist * 0.6, this.scene.fitDist * 1.9);

      this.updateAnimations(dt);
      this.updateTimers(dt);
      this.updateHover(dt);
      this.updateHint(dt);
      this.scene.particles.update(dt);
      this.scene.updateCamera(dt);
      this.updateMechanics(dt);

      this.buildRenderList();
      this.render();
      this.updatePerspectiveContacts();
    },

    updatePerspectiveContacts() {
      const sc=this.scene;
      if(!this.board || this.state!=='play')return;
      if(!this.rotor||!this.rotor.projected) { this.viewLinks=[];this.mainMatcher=null;return; }
      const panel=this.rotor;
      const fading=this.dying.map(t=>t.id+':'+t.center.join(',')+':'+t.scaleMul).join(';');
      const rotorKey=this.rotor?this.rotor.angle+':'+this.rotor.colors.join(','):'';
      const key=Array.from(sc.vp).join(',')+'|'+this.board.color.join(',')+'|'+panel.colors.join(',')+'|'+sc.w+','+sc.h+'|'+fading+'|'+rotorKey;
      if(panel.projectionKey===key)return;
      panel.projectionKey=key;
      panel.updateProjection(p=>sc.project(p),(id,center,seamPoint)=>{
        const p=seamPoint || sc.project(center);
        if(!p)return false;
        const x=p[0]/(sc.w/sc.dpr)*2-1,y=1-p[1]/(sc.h/sc.dpr)*2;
        return Math.abs(x)<=1 && Math.abs(y)<=1 && sc.pick(x,y,this.renderList)===id;
      },sc.eye,(p,candidates)=>{
        const x=p[0]/(sc.w/sc.dpr)*2-1,y=1-p[1]/(sc.h/sc.dpr)*2;
        const tiles=candidates?this.renderList.filter(t=>candidates.includes(t.id)||t.id>=this.board.size||this.dying.includes(t)):this.renderList;
        return Math.abs(x)<=1&&Math.abs(y)<=1?sc.pick(x,y,tiles):-1;
      },true);
      const next=panel.contacts().filter(pair=>pair[1]<this.board.size);
      if(JSON.stringify(next)!==JSON.stringify(this.viewLinks)) {
        this.viewLinks=next;this.clearHover();
        if(this.hintIds&&!this.hintIds.every(id=>this.groupAt(this.hintIds[0]).includes(id)))this.clearHint();
      }
    },

    updateTimers(dt) {
      if (this.timer) {
        this.timer.t -= dt;
        if (this.timer.t <= 0) {
          const fn = this.timer.fn;
          this.timer = null;
          fn();
        }
      }
      if (this.state === 'intro') {
        this.introLeft -= dt;
        if (this.introLeft <= 0 && !this.introDone) {
          this.introDone = true;
          this.state = 'play';
          this.updateHud();
          if ((this.mode === 'normal' || this.mode === 'test') && !this.hasPotentialMoves()) this.levelClear();
          else this.showMechanicIntro();
        }
      }
      if (this.landSfxCd > 0) this.landSfxCd -= dt;
    },

    updateAnimations(dt) {
      // 存活方块
      if (this.tiles) {
        for (let i = 0; i < this.tiles.length; i++) {
          const t = this.tiles[i];
          if (t) this.stepTile(t, dt);
        }
      }
      // 消散中的方块
      for (let i = this.dying.length - 1; i >= 0; i--) {
        const t = this.dying[i];
        const a = t.anim;
        a.t += dt;
        const elapsed = a.t - (a.delay || 0);
        if (elapsed < 0) continue;
        const p = clamp(elapsed / a.dur, 0, 1);
        t.center = [
          a.from[0] + a.vel[0] * p * a.dur * 0.5,
          a.from[1] + a.vel[1] * p * a.dur * 0.5 - 1.6 * p * p,
          a.from[2] + a.vel[2] * p * a.dur * 0.5
        ];
        if (a.firework && !a.exploded && elapsed >= 0.28) {
          a.exploded = true;
          this.scene.particles.burst(t.center, PALETTE[t.color].rgb, a.sparks, {
            speed: 2.8, size: 0.075, life: 1.25, gravity: 1.2, drag: 0.65
          });
        }
        m3.rotateBasis(m3.fromAxisAngle(a.spinAxis[0], a.spinAxis[1], a.spinAxis[2], a.spin0 * p), t.homeBasis, t.basis);
        const s = p < 0.16 ? 1 + p / 0.16 * 0.28 : 1.28 * Math.pow(1 - (p - 0.16) / 0.84, 1.5);
        t.scaleMul = s;
        t.alpha = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
        if (p >= 1) {
          t.gone = true;
          this.dying.splice(i, 1);
        }
      }
    },

    stepTile(t, dt) {
      if (t.squash > 0) t.squash *= Math.pow(0.0015, dt);
      if (t.squash < 0.002) t.squash = 0;

      const a = t.anim;
      if (!a) return;

      if (a.type === 'fall') {
        a.t += dt;
        const raw = a.t - a.delay;
        if (raw <= 0) { t.basis = t.homeBasis.slice(); return; }
        const p = clamp(raw / a.dur, 0, 1);
        const e = MX.easeInQuad(p);
        t.center = [
          a.from[0] + (a.to[0] - a.from[0]) * e,
          a.from[1] + (a.to[1] - a.from[1]) * e,
          a.from[2] + (a.to[2] - a.from[2]) * e
        ];
        // 翻滚：落地前转回正
        const ang = a.spin0 * (1 - e) * (1 - e);
        if (Math.abs(ang) > 0.001) {
          m3.rotateBasis(m3.fromAxisAngle(a.spinAxis[0], a.spinAxis[1], a.spinAxis[2], ang), t.homeBasis, t.basis);
        } else {
          t.basis = t.homeBasis.slice();
        }
        if (p >= 1) {
          t.center = a.to.slice();
          t.basis = t.homeBasis.slice();
          t.anim = null;
          t.squash = 1;
          if (this.landSfxCd <= 0) {
            this.landSfxCd = 0.055;
            window.Sfx.land(a.to[1] < -0.5);
          }
        }
        return;
      }

      if (a.type === 'slide') {
        a.t += dt;
        const p = clamp(a.t / a.dur, 0, 1);
        const e = a.vertical ? MX.easeInQuad(p) : MX.easeInOutCubic(p);
        t.center = [
          a.from[0] + (a.to[0] - a.from[0]) * e,
          a.from[1] + (a.to[1] - a.from[1]) * e,
          a.from[2] + (a.to[2] - a.from[2]) * e
        ];
        if (p >= 1) {
          t.center = a.to.slice();
          t.basis = t.homeBasis.slice();
          t.anim = null;
          t.squash = a.vertical ? 0.75 : 0.45;
        }
      }
    },

    /** 悬停高亮做呼吸动画 */
    updateHover(dt) {
      if (!this.tiles) return;
      const live = this.hoverIds;
      if (!live || !live.length) return;
      const pulse = 0.34 + 0.30 * Math.sin(this.clock * 7.0);
      for (let i = 0; i < live.length; i++) {
        const t = this.tiles[live[i]];
        if (t) { t.highlight = pulse; t.scaleMul = 1; }
      }
    },

    showHint() {
      if(this.challenge)return this.challenge.hintGroup();
      if (this.state !== 'play') return;
      this.clearHint();
      this.clearHover();
      const seen = new Set();
      let best = null, anchor = -1, bestRank = -1, visible = false;
      for (let id = 0; id < this.board.size + (this.rotor ? this.rotor.colors.length : 0); id++) {
        if (seen.has(id) || this.colorAt(id) < 0) continue;
        const group = this.groupAt(id);
        group.forEach(member => seen.add(member));
        if (group.length < 2) continue;
        let front = -1;
        for (const member of group) {
          const tile = this.tiles[member];
          const point = this.scene.project(tile.center);
          if (!point) continue;
          const nx = point[0] / (this.scene.w / this.scene.dpr) * 2 - 1;
          const ny = 1 - point[1] / (this.scene.h / this.scene.dpr) * 2;
          if (Math.abs(nx) <= 1 && Math.abs(ny) <= 1 && this.scene.pick(nx, ny, this.renderList) === member) { front = member; break; }
        }
        const rank = (front >= 0 ? 10000 : 0) + group.length;
        if (rank > bestRank) { best = group; anchor = front >= 0 ? front : group[0]; bestRank = rank; visible = front >= 0; }
      }
      const status = document.getElementById('hintStatus');
      if (!best) { status.textContent = this.rotor && this.rotor.projected ? '转动视角，让主体之间或固定方板的同色块在画面上接边' : this.rotor ? '当前没有组合，请等待旋转方板实际接触主体后再试' : '当前没有实际相邻的同色组合'; return; }
      this.hintIds = best;
      this.hintTime = 0;
      // 每次提示都把视角转到被标出的那一面：侧面平视、顶面俯视，已经对齐时不动镜头
      const anchorTile = this.tiles[anchor];
      const external = !!(anchorTile && anchorTile.external);
      const faceN = external
        ? (this.rotor && this.rotor.normal ? this.rotor.normal(anchor - this.board.size) : [1, 0, 0])
        : ((this.board.faces[this.board.faceOf(anchor)] || {}).n || [0, 0, 1]);
      const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
      const aimYaw = Math.abs(faceN[1]) > 0.7 ? this.scene.yaw : Math.atan2(faceN[0], faceN[2]);
      const aimPitch = Math.abs(faceN[1]) > 0.7 ? 1.05 : 0.2;
      if (!visible || Math.abs(wrap(aimYaw - this.scene.yaw)) > 0.04 || Math.abs(aimPitch - this.scene.pitch) > 0.04) {
        this.scene.orbit = null;
        this.hintCamera = { yaw: aimYaw, pitch: aimPitch, fromYaw: this.scene.yaw, fromPitch: this.scene.pitch };
      }
      status.textContent = '已标出 ' + best.length + ' 个同色方块，点击白色闪动的方块即可消除';
    },

    updateHint(dt) {
      if (!this.hintIds || this.state !== 'play') return;
      this.hintTime += dt;
      if (this.hintTime >= 3.5) { this.clearHint(); return; }
      if (this.hintCamera) {
        const c = this.hintCamera;
        const p = this.reduceMotion ? 1 : MX.easeInOutCubic(clamp(this.hintTime / 0.45, 0, 1));
        const delta = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
        this.scene.yaw = c.fromYaw + delta(c.yaw - c.fromYaw) * p;
        this.scene.pitch = c.fromPitch + delta(c.pitch - c.fromPitch) * p;
        if (p >= 1) this.hintCamera = null;
      }
      const bounce = this.reduceMotion ? 0 : Math.abs(Math.sin(this.hintTime * 7));
      for (const id of this.hintIds) {
        const tile = this.tiles[id];
        if (tile) { tile.hintGlow = 0.55 + bounce * 0.22; tile.hintLift = this.board.pitch * 0.2 * bounce; }
      }
    },

    clearHint() {
      if (this.hintIds && this.tiles) for (const id of this.hintIds) {
        const tile = this.tiles[id];
        if (tile) { tile.hintGlow = 0; tile.hintLift = 0; tile.renderCenter = null; }
      }
      this.hintIds = null;
      this.hintCamera = null;
    },

    clearHover() {
      if(this.challenge)this.challenge.clearHover();
      if (this.hoverIds) {
        for (let i = 0; i < this.hoverIds.length; i++) {
          const t = this.tiles[this.hoverIds[i]];
          if (t) { t.highlight = 0; t.scaleMul = 1; }
        }
      }
      this.hoverIds = null;
      this.hideTip();
    },

    /* ============================================================
       渲染
       ============================================================ */
    buildRenderList() {
      const list = this.renderList;
      list.length = 0;
      const add = (t) => {
        const s = t.scaleMul;
        t.size[0] = t.baseSize[0] * s;
        t.size[1] = t.baseSize[1] * s;
        t.size[2] = t.baseSize[2] * s;
        const normal = t.external && this.rotor ? this.rotor.normal(t.id-this.board.size) : t.external ? [1,0,0] : this.board.faces[this.board.faceOf(t.id)].n;
        t.renderCenter = t.center.map((v, a) => v + normal[a] * (t.hintLift || 0));
        m4.fromBasisScale(t.model, t.basis, t.renderCenter, t.size);
        const k = 1 - 0.30 * t.squash;
        t.model[1] *= k; t.model[5] *= k; t.model[9] *= k;
        list.push(t);
      };
      if (this.tiles) for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i]) add(this.tiles[i]);
      for (let i = 0; i < this.dying.length; i++) add(this.dying[i]);
    },

    render() {
      const sc = this.scene;
      if(this.state!=='menu'&&this.state!=='intro'){
        if(sc.applyZoom)sc.applyZoom(this.tiles||[],[0,0,0],.96,sc.fitDist*1.25,this.zoom);
        else sc.constrainZoom?.(this.tiles||[]);
        if(sc.zoomRange)document.getElementById('zoomSlider')?.setAttribute('aria-valuetext',Math.round(100*sc.zoomRange.far/sc.dist)+'%');
      }
      sc.beginFrame();
      // 只绘制彩色方块外壳；消除后的空洞直接露出内部。
      const list = this.renderList;
      const draw = t => {
        const covered = !t.special && !t.external && this.board.covered[t.id];
        const mark = t.special ? t.mark : (covered || t.color === 6 ? 1 : 0);
        const rgb = covered ? [0.035,0.04,0.055] : (t.rgb || PALETTE[t.color].rgb);
        sc.drawBox(t.model, rgb, [TILE_BEVEL, mark || t.special ? 0 : TILE_STAR], t.highlight, t.alpha, t.hintGlow || 0, mark);
      };
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (t.alpha > 0.985) draw(t);
      }
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (t.alpha <= 0.985) draw(t);
      }
      if (this.board && !['menu', 'intro', 'clear', 'over'].includes(this.state)) sc.drawDirectionArrows(this.board);
      sc.drawParticles();
    },

    /* ============================================================
       交互
       ============================================================ */
    setZoom(value) {
      if(this.challenge)return this.challenge.zoom(value);
      this.zoom = clamp(value, 0, 1);
      const range=this.scene.zoomRange;
      this.scene.dist = range?1/((1-this.zoom)/range.far+this.zoom/range.near):this.scene.fitDist * 1.25 / (1 + 0.6 * this.zoom);
      const slider = document.getElementById('zoomSlider');
      slider.value = String(this.zoom * 100);
      slider.setAttribute('aria-valuetext', Math.round(100 * (range?range.far/this.scene.dist:1+.6*this.zoom)) + '%');
    },

    setZoomFromDistance(distance) {
      const range=this.scene.zoomRange;
      if(range)return this.setZoom((1/Math.max(.001,distance)-1/range.far)/(1/range.near-1/range.far));
      if(this.challenge)return this.setZoom((this.challenge.fit/Math.max(.001,distance)-1)/1.5);
      this.setZoom((this.scene.fitDist * 1.25 / Math.max(distance, 0.001) - 1) / 0.6);
    },

    resetView() {
      this.hintCamera = null;
      this.scene.orbit = null;
      this.scene.yaw = 0.62;
      this.scene.pitch = 0.42;
      this.setZoom(0);
    },

    alignCurrentFace() {
      if(this.challenge)return this.challenge.align();
      if (!this.board) return;
      this.hintCamera = null;
      const sc = this.scene;
      const back = sc.orbit ? sc.orbit.back : [Math.cos(sc.pitch)*Math.sin(sc.yaw), Math.sin(sc.pitch), Math.cos(sc.pitch)*Math.cos(sc.yaw)];
      const face = this.board.faces.reduce((best, f) => v3.dot(f.n, back) > v3.dot(best.n, back) ? f : best);
      sc.orbit = { back: face.n.slice(), up: face.d.map(v => -v) };
      sc.yaw = Math.atan2(face.n[0], face.n[2]);
      sc.pitch = Math.asin(face.n[1]);
    },

    bindInput() {
      const cv = document.getElementById('gl');
      const pts = new Map();
      let dragging = false, moved = 0, downT = 0, pinch = 0, lastX = 0, lastY = 0;

      const ndc = (e) => [
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1)
      ];
      const canPlay = () => this.state === 'play';

      cv.addEventListener('pointerdown', (e) => {
        if(this.challenge?.marbleAim?.pointerDown(e)){cv.setPointerCapture(e.pointerId);return;}
        if(this.challenge?.thrower?.enabled()){
          pts.set(e.pointerId,{x:e.clientX,y:e.clientY});cv.setPointerCapture(e.pointerId);
          if(pts.size>=2){this.challenge.thrower.cancel();const a=[...pts.values()];pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);dragging=true;return;}
          if(this.challenge.thrower.pointerDown(e))return;
        }
        if(this.challenge?.rubikControls?.pointerDown(e)){cv.setPointerCapture(e.pointerId);return;}
        if(this.challenge?.assembly?.pointerDown(e)){cv.setPointerCapture(e.pointerId);return;}
        this.hintCamera = null;
        cv.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 1) { dragging = false; moved = 0; downT = performance.now(); lastX = e.clientX; lastY = e.clientY; }
        if (pts.size === 2) {
          const a = [...pts.values()];
          pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        }
        window.Sfx.init(); window.Sfx.resume();
      });

      cv.addEventListener('pointermove', (e) => {
        if(this.challenge?.marbleAim?.pointerMove(e))return;
        if(pts.size<2&&this.challenge?.thrower?.pointerMove(e)){const p=pts.get(e.pointerId);if(p){p.x=e.clientX;p.y=e.clientY;}return;}
        if(this.challenge?.rubikControls?.pointerMove(e))return;
        if(this.challenge?.assembly?.pointerMove(e))return;
        const p = pts.get(e.pointerId);

        // 未按下：鼠标悬停，预览可消除的组
        if (!p) {
          if (e.pointerType === 'mouse' && canPlay()) this.setHover(e);
          return;
        }
        p.x = e.clientX; p.y = e.clientY;

        if (pts.size >= 2) {
          const a = [...pts.values()];
          const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
          if (pinch > 0 && d > 0 && this.state !== 'menu') this.setZoomFromDistance(this.scene.dist * pinch / d);
          pinch = d;
          return;
        }

        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 7) {
          this.challenge?.clearHintView();
          dragging = true;
          this.clearHover();
          if(!this.challenge?.pan(dx,dy))this.scene.rotateOrbit(dx, dy);
        }
      });

      const endPointer = (e) => {
        if(this.challenge?.marbleAim?.pointerUp(e))return;
        if(this.challenge?.thrower?.pointerUp(e)){pts.delete(e.pointerId);moved=0;dragging=false;pinch=0;return;}
        if(this.challenge?.rubikControls?.pointerUp(e)){pts.delete(e.pointerId);moved=0;dragging=false;pinch=0;return;}
        if(this.challenge?.assembly?.pointerUp(e)){pts.delete(e.pointerId);moved=0;dragging=false;pinch=0;return;}
        const wasSingle = pts.size === 1;
        pts.delete(e.pointerId);
        if (!wasSingle) { pinch = 0; return; }
        const quick = performance.now() - downT < 480;
        if (!dragging && quick) this.click(e);
        moved = 0; dragging = false; pinch = 0;
      };
      cv.addEventListener('pointerup', endPointer);
      cv.addEventListener('pointercancel', (e) => { this.challenge?.marbleAim?.cancel();this.challenge?.rubikControls?.cancel();this.challenge?.assembly?.cancel();this.challenge?.thrower?.cancel();pts.delete(e.pointerId); pinch = 0; });

      cv.addEventListener('pointerleave', () => { if (this.state === 'play') this.clearHover(); });

      cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (this.state !== 'menu') this.setZoomFromDistance(this.scene.dist * Math.exp(e.deltaY * 0.0011));
      }, { passive: false });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.onEsc();
        if (e.key === 'r' || e.key === 'R') { if (this.state === 'over') this.restart(); }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'play') this.pause();
      });
    },

    setHover(e) {
      if(this.challenge)return this.challenge.setHover(e);
      const id = this.scene.pick(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1),
        this.renderList
      );
      const prev = this.hoverIds;
      if (prev && prev.length && prev[0] === id) return;
      this.clearHover();
      if (id < 0) return;
      const grp = this.groupAt(id);
      this.hoverIds = grp.length >= 2 ? grp : null;
      if (!this.hoverIds) {
        const t = this.tiles[id];
        if (t) t.highlight = 0.1;
        this.hideTip();
      } else {
        this.showTip(e.clientX, e.clientY, grp.length);
      }
    },

    showTip(x, y, n) {
      const el = document.getElementById('tip');
      el.innerHTML = '<b>' + n + '</b> 块 · +' + (5 * n * n) + ' 分';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.classList.add('on');
    },

    hideTip() {
      const el = document.getElementById('tip');
      if (el) el.classList.remove('on');
    },

    click(e) {
      if(this.challenge)return this.challenge.click(e);
      if (this.state !== 'play') return;
      const id = this.scene.pick(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1),
        this.renderList
      );
      if (id < 0) return;
      const grp = this.groupAt(id);
      if (grp.length < 2) {
        window.Sfx.invalid();
        const t = this.tiles[id];
        if (t) t.squash = 0.8;
        return;
      }
      this.pop(grp);
    },

    /* ============================================================
       消除 / 重力 / 结算
       ============================================================ */
    pop(group) {
      if (!group || group.length < 2) return;   // 单块不可消
      this.clearHint();
      this.state = 'busy';
      this.clearHover();
      const n = group.length;
      const gain = 5 * n * n;
      this.score += gain;
      this.trackBest();
      window.Sfx.pop(n);
      this.scene.addShake(Math.min(1.5, 0.22 + n * 0.055));

      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < group.length; i++) {
        const id = group[i];
        const t = this.tiles[id];
        if (!t) continue;
        cx += t.center[0]; cy += t.center[1]; cz += t.center[2];

        const away = v3.norm(t.center);
        const dir = v3.norm(v3.add(away, [0, 0.55, 0]));
        const spd = 2.4 + Math.random() * 2.2;
        t.anim = {
          type: 'pop',
          t: 0, dur: 0.5 + Math.random() * 0.14,
          from: t.center.slice(),
          vel: v3.mul(dir, spd),
          spinAxis: t.spinAxis,
          spin0: (Math.random() * 2 - 1) * 5.5
        };
        t.highlight = 0;
        this.dying.push(t);
        this.tiles[id] = null;
        if (t.external) this.rotor.colors[id - this.board.size] = -1;
        else this.board.remove([id]);

        this.scene.particles.burst(t.center, PALETTE[t.color].rgb, n >= 10 ? 12 : 7, {
          speed: 2.4 + n * 0.14, size: 0.078, life: 0.6, gravity: 4.0
        });
      }
      cx /= group.length; cy /= group.length; cz /= group.length;
      this.board.revealExposed();
      this.toast([cx, cy + 0.55, cz], '+' + gain, n >= 8 ? '' : 'small');
      this.updateHud();

      this.timer = { t: 0.36, fn: () => this.settle() };
    },

    settle() {
      const moves = this.board.applyGravity();
      if (!moves.length) { this.afterSettle(); return; }
      this.state = 'busy';
      let maxDur = 0;
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        const t = this.tiles[m.from];
        if (!t) continue;
        this.tiles[m.from] = null;
        this.tiles[m.to] = t;
        t.id = m.to;
        const dur = 0.12 + 0.17 * Math.sqrt(m.dist);
        maxDur = Math.max(maxDur, dur);
        t.anim = {
          type: 'slide', t: 0, dur,
          from: t.center.slice(),
          to: this.centerOf(m.to),
          vertical: Math.abs(m.dy) > 0.22
        };
      }
      this.timer = { t: maxDur + 0.06, fn: () => this.afterSettle() };
    },

    afterSettle() {
      this.state = 'play';
      this.updateHud();
      if (!this.hasPotentialMoves()) this.levelClear();
    },

    remainingBonus(remain) {
      return remain === 0 ? 2000 : Math.max(0, (13 - remain) * 100);
    },

    leftoverDelay(remain, index) {
      return remain <= 13 ? index * 0.12 : 0;
    },

    levelClear() {
      if (this.state === 'clear' || this.state === 'over') return;
      this.clearHint();
      this.state = 'clear';
      this.clearHover();
      const remain = this.remainingCount();
      const bonus = this.remainingBonus(remain);
      this.score += bonus;
      this.recordClear();
      this.trackBest();
      this.levelScoreBonus = bonus;
      this.levelRemain = remain;
      window.Sfx.levelClear();
      this.scene.addShake(0.6);
      // 剩余孤块只参与收尾烟花，保留棋盘计数用于结算，不追加消除分。
      const leftovers = this.tiles.filter(Boolean);
      leftovers.forEach((tile, i) => {
        tile.anim = {
          type: 'pop', firework: true, exploded: false,
          t: 0, delay: this.leftoverDelay(remain, i), dur: 1.05,
          from: tile.center.slice(),
          vel: v3.mul(v3.norm(v3.add(tile.center, [0, 0.8, 0])), 4.2),
          spinAxis: tile.spinAxis, spin0: 5 + Math.random() * 4,
          sparks: clamp(Math.floor(1100 / Math.max(1, leftovers.length)), 3, 36)
        };
        tile.highlight = 0;
        this.dying.push(tile);
        this.tiles[tile.id] = null;
      });

      for (let i = 0; i < 60; i++) {
        const c = PALETTE[(Math.random() * NC) | 0].rgb;
        this.scene.particles.spawn(
          [(Math.random() * 2 - 1) * 1.6, 1.4 + Math.random(), (Math.random() * 2 - 1) * 1.6],
          c, { speed: 3.4, size: 0.075, life: 1.1, gravity: 5.2 }
        );
      }
      this.updateHud();
      const lastDelay = this.leftoverDelay(remain, Math.max(0, leftovers.length - 1));
      this.timer = { t: Math.max(2.5, lastDelay + 1.6), fn: () => this.showClearPanel() };
    },

    showClearPanel() {
      if (this.mode === 'test') {
        this.overlay(`<h2 class="ov-title">测试完成</h2><p class="ov-sub">${window.LevelProfile(this.level).title} · 得分 ${this.score}</p><div class="ov-actions"><button class="ov-btn" data-act="restart">再试一次</button><button class="ov-btn plain" data-act="menu">选择其他关卡</button></div>`);
        return;
      }
      const passed = this.score >= this.target;
      if (!passed) { this.gameOver('分数不足'); return; }
      if((this.mode==='normal'&&this.level===15)||(this.mode==='challenge'&&this.level>=11)) {
        this.overlay(`<div class="ov-emoji">🎉</div><h2 class="ov-title win">${this.mode==='normal'?'普通模式全部通关':'挑战测试完成'}</h2><p class="ov-sub">第 ${this.level} 关完成 · ${this.mode==='challenge'?'本关得分':'总分'} ${this.score}</p><div class="ov-actions"><button class="ov-btn" data-act="menu">返回菜单选关</button></div>`);
        return;
      }
      const nextN = this.cubeSizeFor(this.mode, this.level + 1);
      const nextTiles = nextN ** 3 - (nextN - 2) ** 3;
      this.overlay(`
        <div class="ov-emoji">🎉</div>
        ${this.newRecord ? '<div class="ov-badge">新 纪 录</div>' : ''}
        <h2 class="ov-title win">第 ${this.level} 关通过</h2>
        <p class="ov-sub">立方体被清空，剩余 ${this.levelRemain} 块</p>
        <div class="ov-dots">${this.starDots()}</div>
        <div class="ov-rows">
          <div class="ov-row"><span>清空奖励</span><b class="green">+${this.levelScoreBonus}</b></div>
          <div class="ov-row"><span>本关目标</span><b>${this.target}</b></div>
          <div class="ov-row"><span>${this.mode==='challenge'?'本关得分':'总分'}</span><b>${this.score}</b></div>
          <div class="ov-row big"><span>下一关目标</span><b class="gold">${this.targetFor(this.level + 1, nextTiles)}</b></div>
        </div>
        <div class="ov-actions">
          <button class="ov-btn" data-act="next">进入第 ${this.level + 1} 关</button>
          <button class="ov-btn plain" data-act="menu">返回菜单</button>
        </div>`);
    },

    gameOver(reason) {
      this.state = 'over';
      window.Sfx.gameOver();
      const remain = this.board ? this.remainingCount() : 0;
      this.overlay(`
        <div class="ov-emoji">💫</div>
        ${this.newRecord ? '<div class="ov-badge">新 纪 录</div>' : ''}
        <h2 class="ov-title lose">游戏结束</h2>
        <p class="ov-sub">${reason} · 目标 ${this.target}</p>
        <div class="ov-dots">${this.starDots()}</div>
        <div class="ov-rows">
          <div class="ov-row big"><span>最终得分</span><b class="gold">${this.score}</b></div>
          <div class="ov-row"><span>历史最高</span><b>${this.best}</b></div>
          <div class="ov-row"><span>到达关卡</span><b>第 ${this.level} 关</b></div>
          <div class="ov-row"><span>剩余方块</span><b>${remain}</b></div>
        </div>
        <div class="ov-actions">
          <button class="ov-btn" data-act="retry">再来一局</button>
          <button class="ov-btn plain" data-act="menu">返回菜单</button>
        </div>`);
    },

    starDots() {
      const steps = this.starSteps();
      let n = 0;
      for (let i = 0; i < steps.length; i++) if (this.score >= steps[i]) n++;
      let h = '';
      for (let i = 0; i < steps.length; i++) h += '<i class="' + (i < n ? 'on' : '') + '"></i>';
      return h;
    },

    /* ============================================================
       流程控制
       ============================================================ */
    progressFor(mode) {
      this.progressCache=this.progressCache||{};
      if(this.progressCache[mode])return this.progressCache[mode];
      let p=null;
      try { p=JSON.parse(window.localStorage.getItem((this.storagePrefix||'popstar3d')+'.progress.'+mode+(mode==='challenge'?'.v2':''))); } catch(e) {}
      if(!p||!Number.isSafeInteger(p.next)||p.next<1||!Number.isFinite(p.score)||p.score<0||!p.cleared||typeof p.cleared!=='object')p={next:1,score:0,cleared:{}};
      if(mode==='challenge'){
        p.next=Math.min(p.next,12);
        const valid=([level,score])=>Number.isInteger(Number(level))&&Number(level)>=1&&Number(level)<=11&&Number.isFinite(score)&&score>=0;
        p.best=Object.fromEntries(Object.entries(p.best&&typeof p.best==='object'?p.best:{}).filter(valid));
        p.cleared=Object.fromEntries(Object.entries(p.cleared).filter(valid));
      }
      return this.progressCache[mode]=p;
    },
    recordClear() {
      if(!['normal','challenge'].includes(this.mode)||this.score<this.target)return;
      const p=this.progressFor(this.mode);
      if(!Object.prototype.hasOwnProperty.call(p.cleared,this.level))p.cleared[this.level]=this.entryScore||0;
      if(this.level>=p.next) {p.next=this.level+1;p.score=this.score;}
      if(this.mode==='challenge') {p.score=0;p.cleared[this.level]=0;}
      try {window.localStorage.setItem((this.storagePrefix||'popstar3d')+'.progress.'+this.mode,JSON.stringify(p));}catch(e) {}
    },
    showLevelSelect(mode) {
      this.selectMode=mode;
      const p=this.progressFor(mode),count=mode==='normal'?15:11;
      let buttons='';
      for(let level=1;level<=count;level++) {
        const cleared=Object.prototype.hasOwnProperty.call(p.cleared,level);
        const unlocked=mode==='challenge'||cleared||level===p.next;
        const profile=window.LevelProfile(level,mode);
        const label=cleared?'已通关':unlocked?'可挑战':'🔒';
        const best=Number.isFinite(p.best?.[level])&&p.best[level]>=0?p.best[level]:0;
        buttons+=`<button class="level-choice ${unlocked?'passed':'locked'}" ${unlocked?`data-act="selectLevel" data-level="${level}"`:'disabled'} aria-label="第 ${level} 关，${profile.title}，${unlocked?label:'未解锁'}">${level}${mode==='challenge'?'':`<small>${profile.size}×${profile.size}</small>`}<small>${profile.title}</small><small>${label}</small>${mode==='challenge'?`<small class="level-best">历史最高分：${best}</small>`:''}</button>`;
      }
      const continuation=p.next>count?'<p class="ov-sub">可选择关卡重玩</p>':`<button class="ov-btn" data-act="continueLevels">${p.next===1?'开始闯关':'继续闯关'} · 第 ${p.next} 关</button>`;
      this.overlay(`<h2 class="ov-title">${mode==='normal'?'普通模式':'挑战模式'} · 选关</h2><p class="ov-sub">${mode==='challenge'?'全部 11 关已开放 · 可任选关卡挑战':'彩色关卡可进入 · 通关后解锁下一关'}</p><div class="level-grid">${buttons}</div><div class="ov-actions">${continuation}<button class="ov-btn plain" data-act="helpClose">返回菜单</button></div>`);
    },
    startSelectedLevel(mode,level,continuing=false) {
      const p=this.progressFor(mode);
      if(!['normal','challenge'].includes(mode)||!Number.isSafeInteger(level)||level<1||level>(mode==='normal'?15:11)||(mode!=='challenge'&&!(Object.prototype.hasOwnProperty.call(p.cleared,level)||level===p.next)))return;
      this.mode=mode;this.level=level;
      this.score=mode==='challenge'?0:(level===p.next?p.score:(p.cleared[level]??0));
      this.entryScore=this.score;this.newRecord=false;this.startLevel(true);
    },
    startGame(mode, testLevel = 1) {
      this.mode = mode;
      this.level = mode === 'test' ? clamp(Math.round(testLevel), 1, 3) : 1;
      this.score = 0;
      this.entryScore=0;
      this.newRecord = false;
      this.startLevel(true);
    },

    startLevel(first) {
      if(this.mode==='challenge'&&(!Number.isSafeInteger(this.level)||this.level<1||this.level>11)){this.showLevelSelect('challenge');return;}
      if(this.challenge){this.challenge.dispose();this.challenge=null;}
      if(this.mode==='challenge'&&window.ChallengeGame){this.challenge=new window.ChallengeGame(this,this.level);return;}
      if(this.mode==='challenge') {this.score=0;this.newRecord=false;}
      this.entryScore=this.score;
      this.clearHint();
      const N = this.cubeSizeFor(this.mode, this.level);
      this.N = N;
      this.board = new window.Board(N);
      this.mainMatcher=null;this.viewLinks=[];
      this.board.fillRandom(NC, Math.random);
      const profile = window.LevelProfile(this.level,this.mode);
      const panelCount=this.mode==='normal'?N-4:1;
      this.rotor = profile.kind === 'rotor' ? new window.Rotor(this.board,Math.random,panelCount) : profile.kind === 'perspective' ? new window.PerspectivePanel(this.board,Math.random,panelCount) : null;
      this.tilesAll = this.board.size;
      this.target = this.targetFor(this.level, this.board.size);
      this.dying.length = 0;
      this.clearHover();
      this.timer = null;
      this.introDone = false;
      this.lastTickSec = -1;
      this.scene.particles.clear();
      this.spawnTilesFalling(!first);
      if (this.rotor) for (let i = 0; i < this.rotor.colors.length; i++) {
        const tile = this.makeTile(0, this.rotor.colors[i]);
        tile.id = this.board.size + i; tile.external = true;
        tile.center = this.rotor.center(i); tile.homeBasis = this.rotor.basis(i); tile.basis = tile.homeBasis.slice();
        this.tiles[tile.id] = tile;
      }
      this.hideOverlay();
      document.getElementById('menu').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('btnMechanicInfo').classList.toggle('hidden',!this.hasMechanicIntro());
      this.setZoom(first ? 0 : this.zoom);
      this.scene.orbit = null;
      this.scene.yaw = 0.62;
      this.scene.pitch = 0.42;
      this.showBanner();
      this.updateHud();
    },

    showBanner() {
      const b = document.getElementById('banner');
      b.innerHTML = '<div class="bn-lv">第 ' + this.level + ' 关</div>' +
        '<div class="bn-sub">' + window.LevelProfile(this.level,this.mode).title + ' · '+this.N+'×'+this.N+' · 目标 ' + this.target + ' 分' +
        '</div>';
      b.classList.remove('show');
      void b.offsetWidth;          // 强制重排，让动画能重播
      b.classList.add('show');
    },

    restart() { this.score=this.entryScore||0;this.newRecord=false;this.startLevel(true); },

    returnToLevelSelect() {
      const mode=this.mode==='challenge'?'challenge':'normal';
      this.toMenu();
      this.showLevelSelect(mode);
    },

    toMenu() {
      if(this.challenge){this.challenge.dispose();this.challenge=null;}
      this.clearHint();
      this.scene.orbit = null;
      this.rotor = null;
      this.mainMatcher=null;this.viewLinks=[];
      this.state = 'menu';
      this.timer = null;
      this.dying.length = 0;
      this.clearHover();
      document.getElementById('banner').classList.remove('show');
      this.hideOverlay();
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('menu').classList.remove('hidden');
      this.board = new window.Board(5);
      this.board.fillRandom(NC, Math.random);
      this.spawnTilesInstant();
      this.scene.particles.clear();
      this.scene.dist = this.scene.fitDist * 1.55;
      this.updateMenuBest();
      this.hideTip();
    },

    pause() {
      if (this.state !== 'play') return;
      this.state = 'paused';
      this.hideTip();
      this.overlay(`
        <div class="ov-emoji">⏸</div>
        <h2 class="ov-title">已暂停</h2>
        <p class="ov-sub">第 ${this.level} 关 · 得分 ${this.score}</p>
        <div class="ov-actions">
          <button class="ov-btn" data-act="resume">继续</button>
          <button class="ov-btn plain" data-act="restart">重新开始</button>
          <button class="ov-btn plain" data-act="menu">返回菜单</button>
        </div>`);
    },

    onEsc() {
      if (this.state === 'play') this.pause();
      else if (this.state === 'paused') this.resume();
      else if (this.state === 'over' || this.state === 'clear') this.toMenu();
    },

    resume() {
      this.hideOverlay();
      if (this.board && !this.introDone) this.state = 'intro';
      else this.state = 'play';
      this.last = performance.now();
    },

    /* ============================================================
       UI
       ============================================================ */
    bindUI() {
      document.querySelectorAll('[data-test-level]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.Sfx.init(); window.Sfx.resume();
          this.startGame('test', Number(btn.dataset.testLevel));
        });
      });
      const zoomSlider = document.getElementById('zoomSlider');
      zoomSlider.addEventListener('input', () => { this.clearHover(); this.setZoom(Number(zoomSlider.value) / 100); });
      zoomSlider.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.setZoom(this.zoom + (e.key === 'ArrowUp' ? 0.05 : -0.05));
        }
      });
      document.getElementById('btnResetView').addEventListener('click', () => { this.clearHover(); this.alignCurrentFace(); });
      document.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          window.Sfx.init(); window.Sfx.resume();
          this.showLevelSelect(btn.dataset.mode);
        });
      });
      document.getElementById('btnHowto').addEventListener('click', () => this.showHelp(true));
      document.getElementById('btnHelp').addEventListener('click', () => this.showHelp());
      document.getElementById('btnHint').addEventListener('click', () => this.showHint());
      document.getElementById('btnMechanicInfo').addEventListener('click', () => this.showMechanicIntro());
      document.getElementById('btnLevelSelect').addEventListener('click', () => this.returnToLevelSelect());
      document.getElementById('btnMenu').addEventListener('click', () => this.toMenu());
      const sb = document.getElementById('btnSound');
      sb.addEventListener('click', () => {
        window.Sfx.init();
        window.Sfx.setOn(!window.Sfx.on);
        sb.classList.toggle('off', !window.Sfx.on);
      });

      const ov = document.getElementById('overlay');
      ov.addEventListener('click', (e) => {
        const button=e.target.closest('[data-act]');
        const act = button ? button.dataset.act : null;
        if (!act) return;
        if(act==='selectLevel')this.startSelectedLevel(this.selectMode,Number(button.dataset.level));
        else if(act==='challengeSelect'||act==='levelSelect')this.returnToLevelSelect();
        else if(act==='continueLevels')this.startSelectedLevel(this.selectMode,this.progressFor(this.selectMode).next,true);
        else if (act === 'next') {
          this.level++;
          this.startLevel(false);
        } else if (act === 'retry') this.restart();
        else if (act === 'menu') this.toMenu();
        else if (act === 'resume') this.resume();
        else if (act === 'challengeFinish' && this.challenge) { this.resume();this.challenge.action('finish'); }
        else if (act === 'helpClose') this.hideOverlay();
        else if (act === 'dialogBack') this.backFromHelp();
        else if (act === 'restart') this.restart();
      });
    },

    overlay(html) {
      document.getElementById('btnDialogBack').hidden=!html.includes('class="ov-help"');
      const needsLevelReturn=this.state!=='menu'&&!/data-act="(?:levelSelect|challengeSelect)"/.test(html);
      document.getElementById('ovCard').innerHTML = html + (needsLevelReturn ? '<div class="ov-actions"><button class="ov-btn plain" data-act="levelSelect">返回选关</button></div>' : '');
      document.getElementById('overlay').classList.remove('hidden');
    },

    hideOverlay() { document.getElementById('overlay').classList.add('hidden'); document.getElementById('btnDialogBack').hidden=true; },

    rememberHelpReturn() {
      this.helpReturn={state:this.state,html:this.state==='paused'?document.getElementById('ovCard').innerHTML:null};
    },
    backFromHelp() {
      const previous=this.helpReturn;this.helpReturn=null;
      if(previous?.state==='paused'&&previous.html){this.state='paused';this.overlay(previous.html);}
      else if(previous?.state==='menu'){this.state='menu';this.hideOverlay();}
      else this.resume();
    },

    hasMechanicIntro() {
      return this.mode==='normal'&&(this.level===2||this.level===3);
    },
    showMechanicIntro() {
      if(this.challenge)return this.challenge.help();
      if(!this.hasMechanicIntro()||this.state!=='play')return;
      this.rememberHelpReturn();
      this.state='paused';this.clearHover();this.hideTip();
      const rotor=this.level===2;
      this.overlay(`<h2 class="ov-title">${rotor?'旋转方板':'视角拼接'}</h2><p class="ov-sub">新机关 · 先了解怎么玩</p><div class="ov-help"><ul>${rotor?
        '<li>2×3 方板贴着主体面，沿四条边<em>顺时针一转一停</em>。</li><li>方板与主体的同色块<em>实际接触</em>时，点击即可一起消除。</li><li>这一关只按实际接触判断，单纯看起来相连不算。</li>':
        '<li>旁边的 2×3 方板是固定的，试着<em>转动视角</em>。</li><li>让方板与主体的同色块在画面里<em>边缘对齐相接</em>，再点击一起消除。</li><li>主体方块之间也可视角拼接；只碰角、明显空隙或完全遮挡不算。</li>'}</ul><p>想再看一次，点击右下角的“！”。</p></div><div class="ov-actions"><button class="ov-btn" data-act="resume">我知道了</button></div>`);
    },
    showHelp(fromMenu) {
      if(this.challenge&&!fromMenu)return this.challenge.help();
      this.rememberHelpReturn();
      // 从菜单打开时不能把 state 改成 play，所以两种入口给不同的关闭按钮
      if (!fromMenu && this.state === 'play') this.state = 'paused';
      this.overlay(`
        <h2 class="ov-title">玩法说明</h2>
        <p class="ov-sub">立方体版消灭星星</p>
        <div class="ov-help">
          <h4>怎么消</h4>
          <ul>
            <li>点一下<em>连在一起的同色方块</em>（至少 2 块）即可消除，得分 <em>5 × 块数²</em>。</li>
            <li>连在一起是指<em>贴着的一格之内</em>：同一面上下左右相邻，或者<em>翻过棱边</em>的相邻方块。</li>
            <li>只有<em>视角拼接关</em>支持视角配对：转动视角后，同色块在画面中形成可见接边，即可点击一起消除。同一方块只计一块。<em>普通消除关和旋转方板关只按实际相邻或接触判断</em>。</li>
          </ul>
          <h4>消完怎么掉</h4>
          <ul>
            <li>每一面按自己那一面的「下方」收拢：四个<em>侧面向下滑</em>，<em>顶面和底面朝前面滑</em>。</li>
            <li>所以整个立方体会慢慢往下沉、往前堆，最后越来越难找到 2 块同色。</li>
          </ul>
          <h4>怎么算过关</h4>
          <ul>
            <li>只有视角拼接关可以继续转动视角配对；旋转关还会检查方板后续接触的机会。没有可继续消除的组合时结算，按<em>剩余方块数</em>计算清空奖励。</li>
            <li>普通模式按累计分数达标；挑战模式每关从 <em>0 分</em>开始，只用本关得分达到<em>本关目标分</em>。</li>
          </ul>
          <h4>操作</h4>
          <ul>
            <li>拖动 = 旋转视角；滚轮 / 双指 = 缩放；点击 = 消除；Esc = 暂停。</li>
            <li>左下角准星：转正当前面，让白色箭头朝下，保持当前大小。</li>
          </ul>
          <h4>机关关卡（均为 5×5）</h4>
          <ul>
            <li>第 1 关：普通 5×5 消除。后续关卡随进度增大尺寸，机关按格子尺寸适配。</li>
            <li>第 2 关：2×3 旋转方板，停 2.4 秒、转 90°，六个方块都能接触主体，同色组合仍需点击消除。</li>
            <li>普通模式随尺寸增加方板数量：5×5 至 9×9 分别有 1 至 5 块。旋转板前四块沿同一面的上、右、下、左轮转，第五块绕周围四个侧面停靠；视角板固定在不同面外侧。</li>
            <li>第 3 关：旁边固定的 2×3 方板。拖动视角，让它与主体的同色方块在画面中边缘对齐相接，然后点击组合消除。单纯重叠不算拼接。</li>
          </ul>
        </div>
        <div class="ov-actions" style="margin-top:18px">
          <button class="ov-btn" data-act="${fromMenu ? 'helpClose' : 'resume'}">知道了</button>
        </div>`);
    },

    updateHud() {
      if(this.challenge)return this.challenge.syncHud();
      const $ = (id) => document.getElementById(id);
      $('hudMode').textContent = this.mode === 'test' ? '关卡测试' : this.mode === 'normal' ? '普通模式' : '挑战模式';
      $('hudLevel').textContent = this.level;
      $('hudScore').textContent = this.score;
      $('hudTarget').textContent = this.target;
      $('hudRemain').textContent = this.board ? this.remainingCount() : 0;
      $('progFill').style.width = clamp((this.score / Math.max(1, this.target)) * 100, 0, 100).toFixed(1) + '%';

      const steps = this.starSteps();
      const stars = steps.map((s) => '<i class="' + (this.score >= s ? 'on' : '') + '">★</i>').join('');
      $('hudStars').innerHTML = stars;

      $('hudTimerBox').classList.add('hidden');
    },

    toast(world, text, cls) {
      const p = this.scene.project(world);
      if (!p) return;
      const el = document.createElement('div');
      el.className = 'toast ' + (cls || '');
      el.textContent = text;
      el.style.left = p[0] + 'px';
      el.style.top = p[1] + 'px';
      document.getElementById('toasts').appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }
  };

  window.App = App;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.boot());
  else App.boot();
})();
