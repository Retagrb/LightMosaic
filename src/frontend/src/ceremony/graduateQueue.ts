import type { GraduateJoinedPayload } from '../types/ceremony';

export class GraduateQueue {
  private queue: GraduateJoinedPayload[] = [];
  private active = 0;
  private generation = 0;

  constructor(
    private readonly maxConcurrent: number,
    private readonly paused: () => boolean,
  ) {}

  enqueue(p: GraduateJoinedPayload, run: (p: GraduateJoinedPayload, done: () => void) => void): void {
    this.queue.push(p);
    this.pump(run);
  }

  private pump(run: (p: GraduateJoinedPayload, done: () => void) => void): void {
    const gen = this.generation;
    while (!this.paused() && this.active < this.maxConcurrent && this.queue.length > 0) {
      const p = this.queue.shift()!;
      this.active++;
      run(p, () => {
        if (gen !== this.generation) return;
        this.active--;
        this.pump(run);
      });
    }
  }

  get activeCount(): number {
    return this.active;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    this.active = 0;
    this.generation++;
  }

  waitIdle(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.active === 0 && this.queue.length === 0) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });
  }
}
