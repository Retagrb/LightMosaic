import { displayConfig } from '../config/displayConfig';

export class StatsHud {
  readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'stats-hud';
    this.el.style.display = displayConfig.showStats ? '' : 'none';
  }

  update(lit: number, expected: number): void {
    this.el.textContent = `${lit} / ${expected}`;
  }
}
