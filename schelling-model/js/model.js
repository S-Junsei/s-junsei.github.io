export const EMPTY = 0;
export const GROUP_A = 1;
export const GROUP_B = 2;

const MOORE_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
];

const VON_NEUMANN_OFFSETS = [
  [0, -1], [-1, 0], [1, 0], [0, 1],
];

function xmur3(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class SchellingModel {
  constructor(options = {}) {
    this.configure(options);
    this.reset(options.seed ?? 'schelling');
  }

  configure(options = {}) {
    this.size = clamp(Math.round(options.size ?? this.size ?? 24), 8, 60);
    this.vacancyRate = clamp(options.vacancyRate ?? this.vacancyRate ?? 0.15, 0.02, 0.6);
    this.groupARatio = clamp(options.groupARatio ?? this.groupARatio ?? 0.5, 0.05, 0.95);
    this.threshold = clamp(options.threshold ?? this.threshold ?? 0.4, 0, 1);
    this.neighborhood = options.neighborhood ?? this.neighborhood ?? 'moore';
    this.wrap = options.wrap ?? this.wrap ?? false;
    this.moveStrategy = options.moveStrategy ?? this.moveStrategy ?? 'satisfying';
  }

  reset(seed = this.seed ?? 'schelling') {
    this.seed = String(seed || 'schelling');
    const seedFn = xmur3(this.seed);
    this.random = mulberry32(seedFn());
    this.round = 0;
    this.totalMoves = 0;
    this.board = new Uint8Array(this.size * this.size);

    const total = this.board.length;
    const emptyCount = Math.round(total * this.vacancyRate);
    const occupiedCount = total - emptyCount;
    const groupACount = Math.round(occupiedCount * this.groupARatio);
    const groupBCount = occupiedCount - groupACount;

    const cells = [
      ...Array(groupACount).fill(GROUP_A),
      ...Array(groupBCount).fill(GROUP_B),
      ...Array(emptyCount).fill(EMPTY),
    ];
    this.shuffle(cells);
    this.board.set(cells);
    return this.metrics();
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  index(x, y) {
    return y * this.size + x;
  }

  coords(index) {
    return { x: index % this.size, y: Math.floor(index / this.size) };
  }

  neighborIndices(index) {
    const { x, y } = this.coords(index);
    const offsets = this.neighborhood === 'vonNeumann'
      ? VON_NEUMANN_OFFSETS
      : MOORE_OFFSETS;
    const result = [];

    for (const [dx, dy] of offsets) {
      let nx = x + dx;
      let ny = y + dy;
      if (this.wrap) {
        nx = (nx + this.size) % this.size;
        ny = (ny + this.size) % this.size;
      } else if (nx < 0 || ny < 0 || nx >= this.size || ny >= this.size) {
        continue;
      }
      result.push(this.index(nx, ny));
    }
    return result;
  }

  neighborStats(index, type = this.board[index], ignoreIndex = -1) {
    let same = 0;
    let other = 0;
    let empty = 0;
    for (const neighbor of this.neighborIndices(index)) {
      if (neighbor === ignoreIndex) {
        empty += 1;
        continue;
      }
      const value = this.board[neighbor];
      if (value === EMPTY) empty += 1;
      else if (value === type) same += 1;
      else other += 1;
    }
    const occupied = same + other;
    return {
      same,
      other,
      empty,
      occupied,
      similarity: occupied === 0 ? 1 : same / occupied,
    };
  }

  isSatisfied(index) {
    const type = this.board[index];
    if (type === EMPTY) return true;
    return this.neighborStats(index, type).similarity >= this.threshold;
  }

  unhappyIndices() {
    const result = [];
    for (let i = 0; i < this.board.length; i += 1) {
      if (this.board[i] !== EMPTY && !this.isSatisfied(i)) result.push(i);
    }
    return result;
  }

  emptyIndices(exclude = -1) {
    const result = [];
    for (let i = 0; i < this.board.length; i += 1) {
      if (i !== exclude && this.board[i] === EMPTY) result.push(i);
    }
    return result;
  }

  chooseDestination(type, sourceIndex) {
    const empties = this.emptyIndices(sourceIndex);
    if (empties.length === 0) return -1;

    if (this.moveStrategy === 'random') {
      return empties[Math.floor(this.random() * empties.length)];
    }

    const acceptable = [];
    for (const target of empties) {
      const similarity = this.neighborStats(target, type, sourceIndex).similarity;
      if (similarity >= this.threshold) acceptable.push(target);
    }
    if (acceptable.length === 0) return -1;
    return acceptable[Math.floor(this.random() * acceptable.length)];
  }

  step() {
    const initiallyUnhappy = this.unhappyIndices();
    if (initiallyUnhappy.length === 0) {
      return { moves: 0, initiallyUnhappy: 0, metrics: this.metrics() };
    }

    this.shuffle(initiallyUnhappy);
    let moves = 0;

    for (const source of initiallyUnhappy) {
      const type = this.board[source];
      if (type === EMPTY || this.isSatisfied(source)) continue;

      const target = this.chooseDestination(type, source);
      if (target < 0) continue;

      this.board[source] = EMPTY;
      this.board[target] = type;
      moves += 1;
    }

    this.round += 1;
    this.totalMoves += moves;
    return { moves, initiallyUnhappy: initiallyUnhappy.length, metrics: this.metrics() };
  }

  metrics() {
    let occupied = 0;
    let unhappy = 0;
    let similaritySum = 0;
    let groupA = 0;
    let groupB = 0;

    for (let i = 0; i < this.board.length; i += 1) {
      const type = this.board[i];
      if (type === EMPTY) continue;
      occupied += 1;
      if (type === GROUP_A) groupA += 1;
      if (type === GROUP_B) groupB += 1;
      const similarity = this.neighborStats(i, type).similarity;
      similaritySum += similarity;
      if (similarity < this.threshold) unhappy += 1;
    }

    return {
      round: this.round,
      occupied,
      empty: this.board.length - occupied,
      groupA,
      groupB,
      unhappy,
      satisfied: occupied - unhappy,
      satisfactionRate: occupied === 0 ? 1 : (occupied - unhappy) / occupied,
      meanSimilarity: occupied === 0 ? 1 : similaritySum / occupied,
      totalMoves: this.totalMoves,
    };
  }
}
