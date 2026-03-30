const HASH_SIZE = 8192; // Power of 2
const MAX_ENTITIES = 20000;

/**
 * A highly optimized flat-array spatial hash for extreme performance.
 * Avoids all object allocations and Map lookups.
 */
export class SpatialGrid {
  private head: Int32Array;
  private next: Int32Array;
  private cellSize: number;
  private queryResults: number[] = [];

  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
    this.head = new Int32Array(HASH_SIZE).fill(-1);
    this.next = new Int32Array(MAX_ENTITIES).fill(-1);
  }

  private hash(x: number, y: number): number {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    // Simple spatial hash function
    const h = (gx * 73856093) ^ (gy * 19349663);
    return (h >>> 0) & (HASH_SIZE - 1);
  }

  clear() {
    this.head.fill(-1);
    // We don't need to clear `next` because `head` being -1 means we never traverse it.
  }

  insert(eid: number, x: number, y: number) {
    const h = this.hash(x, y);
    this.next[eid] = this.head[h];
    this.head[h] = eid;
  }

  query(x: number, y: number, radius: number): number[] {
    this.queryResults.length = 0;
    const startX = Math.floor((x - radius) / this.cellSize);
    const endX = Math.floor((x + radius) / this.cellSize);
    const startY = Math.floor((y - radius) / this.cellSize);
    const endY = Math.floor((y + radius) / this.cellSize);

    for (let gx = startX; gx <= endX; gx++) {
      for (let gy = startY; gy <= endY; gy++) {
        const h = ((gx * 73856093) ^ (gy * 19349663)) >>> 0 & (HASH_SIZE - 1);
        let curr = this.head[h];
        while (curr !== -1) {
          this.queryResults.push(curr);
          curr = this.next[curr];
        }
      }
    }
    return this.queryResults;
  }
}
