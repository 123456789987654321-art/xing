/* 空心正方体棋盘：共享棱角 / 接触连通 / 逐面重力 */
(function (g) {
  'use strict';
  const FACE_DEF = [
    { n: [0, 0, 1], d: [0, -1, 0] },
    { n: [1, 0, 0], d: [0, -1, 0] },
    { n: [0, 0, -1], d: [0, -1, 0] },
    { n: [-1, 0, 0], d: [0, -1, 0] },
    { n: [0, 1, 0], d: [0, 0, 1] },
    { n: [0, -1, 0], d: [0, 0, 1] }
  ];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  class Board {
    constructor(N) {
      this.N = N;
      this.h = 1;
      this.pitch = 2 / N;
      this.faces = FACE_DEF.map(f => ({ n: f.n.slice(), d: f.d.slice(), r: cross(f.n, f.d) }));
      // 顶底拥有水平棱和角，前后拥有剩余竖棱，每个实体只计一次。
      this.cells = [];
      this.layouts = this.faces.map((F, f) => {
        const rows = f < 4 ? N - 2 : N;
        const cols = f === 1 || f === 3 ? N - 2 : N;
        const start = this.cells.length;
        for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) this.cells.push({ f, i, j });
        return { rows, cols, start };
      });
      this.size = this.cells.length;
      this.color = new Int8Array(this.size).fill(-1);
      this.covered = new Uint8Array(this.size);
      this.nbr = this._buildNeighbors();
    }

    id(f, i, j) { return this.layouts[f].start + i * this.layouts[f].cols + j; }
    faceOf(id) { return this.cells[id].f; }
    rowOf(id) { return this.cells[id].i; }
    colOf(id) { return this.cells[id].j; }
    idOfFace(f) { return this.layouts[f].start; }

    cellPos(f, i, j) {
      const F = this.faces[f], layout = this.layouts[f], p = this.pitch;
      const a = (j - (layout.cols - 1) / 2) * p;
      const b = (i - (layout.rows - 1) / 2) * p;
      return F.n.map((n, axis) => n * (this.h - p / 2) + F.r[axis] * a + F.d[axis] * b);
    }
    cellCenter(id) { return this.cellPos(this.faceOf(id), this.rowOf(id), this.colOf(id)); }
    faceBasis(f) {
      const { n, r, d } = this.faces[f];
      return [r[0], r[1], r[2], -d[0], -d[1], -d[2], n[0], n[1], n[2]];
    }
    _buildNeighbors() {
      const coords = this.cells.map((_, id) => this.cellCenter(id).map(v => Math.round((v + this.h) / this.pitch - 0.5)));
      const byPosition = new Map(coords.map((p, id) => [p.join(','), id]));
      return coords.map(p => {
        const neighbors = [];
        for (let axis = 0; axis < 3; axis++) for (const direction of [-1, 1]) {
          const q = p.slice();
          q[axis] += direction;
          const id = byPosition.get(q.join(','));
          if (id !== undefined) neighbors.push(id);
        }
        return neighbors;
      });
    }
    neighbors(id) { return this.nbr[id].slice(); }
    colorOf(id) { return this.color[id]; }
    groupOf(id) {
      const c = this.color[id];
      if (c < 0 || this.covered[id]) return [];
      if (c === 6) {
        let best = [];
        for (let color = 0; color < 6; color++) {
          const group = this._groupColor(id, color);
          if (group.length > best.length) best = group;
        }
        return best;
      }
      return this._groupColor(id, c);
    }
    _groupColor(id, c) {
      const seen = new Uint8Array(this.size), out = [], stack = [id];
      seen[id] = 1;
      while (stack.length) {
        const cur = stack.pop();
        out.push(cur);
        for (const nx of this.nbr[cur]) {
          if (!seen[nx] && !this.covered[nx] && (this.color[nx] === c || this.color[nx] === 6)) { seen[nx] = 1; stack.push(nx); }
        }
      }
      return out;
    }
    hasMoves() {
      return this.color.some((c, id) => c >= 0 && !this.covered[id] && this.nbr[id].some(nx =>
        !this.covered[nx] && this.color[nx] >= 0 && (this.color[nx] === c || c === 6 || this.color[nx] === 6)));
    }
    coat(ids) {
      ids.forEach(id => { if (this.color[id] >= 0 && this.color[id] !== 6) this.covered[id] = 1; });
      this.revealExposed();
    }
    revealExposed() {
      const revealed = [];
      for (let id = 0; id < this.size; id++) {
        if (!this.covered[id]) continue;
        const p = this.cellCenter(id), d = this.faces[this.faceOf(id)].d;
        const above = this.nbr[id].find(nx => {
          const q = this.cellCenter(nx);
          return q.every((v, a) => Math.abs(v - p[a] + d[a] * this.pitch) < 1e-6);
        });
        if (above === undefined || this.color[above] < 0) { this.covered[id] = 0; revealed.push(id); }
      }
      return revealed;
    }
    aliveCount() {
      let n = 0;
      for (const c of this.color) if (c >= 0) n++;
      return n;
    }
    remove(ids) { for (const id of ids) { this.color[id] = -1; this.covered[id] = 0; } }

    // 每块按所属面的方向滑动，共享棱角只移动一次。
    applyGravity() {
      const moves = [];
      for (let f = 0; f < 6; f++) {
        const { rows, cols } = this.layouts[f];
        for (let j = 0; j < cols; j++) {
          let write = rows - 1;
          for (let i = rows - 1; i >= 0; i--) {
            const from = this.id(f, i, j), c = this.color[from];
            if (c < 0) continue;
            if (write !== i) {
              const to = this.id(f, write, j);
              this.color[to] = c;
              this.color[from] = -1;
              this.covered[to] = this.covered[from];
              this.covered[from] = 0;
              const a = this.cellCenter(from), b = this.cellCenter(to);
              moves.push({ from, to, dist: write - i, dy: b[1] - a[1], dir: b.map((v, axis) => v - a[axis]) });
            }
            write--;
          }
        }
      }
      this.revealExposed();
      return moves;
    }
    fillRandom(colorCount, rnd) {
      for (let tries = 0; tries < 40; tries++) {
        for (let id = 0; id < this.size; id++) this.color[id] = (rnd() * colorCount) | 0;
        if (!this.hasMoves()) continue;
        const seen = new Uint8Array(this.size);
        let max = 0;
        for (let id = 0; id < this.size; id++) {
          if (seen[id]) continue;
          const group = this.groupOf(id);
          for (const member of group) seen[member] = 1;
          max = Math.max(max, group.length);
        }
        if (max <= this.size * 0.45 || tries >= 30) return;
      }
    }
  }
  g.Board = Board;
  g.FACE_DEF = FACE_DEF;
})(typeof window !== 'undefined' ? window : globalThis);
