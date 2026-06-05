import { displayConfig } from '../config/displayConfig';
import type { LayoutRect } from '../layout/stageLayout';

export class FinalSubtitle {
  readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'final-subtitle';
    this.el.textContent = displayConfig.finalSubtitle;
    this.el.style.color = displayConfig.finalSubtitleColor;
  }

  show(animate = true): void {
    this.el.classList.toggle('final-subtitle--animate', animate);
    this.el.classList.add('final-subtitle--visible');
  }

  hide(): void {
    this.el.classList.remove(
      'final-subtitle--visible',
      'final-subtitle--animate',
    );
  }

  setLayout(layout: LayoutRect): void {
    this.el.style.left = `${layout.x + layout.width * 0.5}px`;
    this.el.style.top = `${layout.y + layout.height * 1.01}px`;
  }
}
