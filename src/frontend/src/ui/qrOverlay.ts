import QRCode from 'qrcode';
import { displayConfig } from '../config/displayConfig';

export type QrPlacement = 'center' | 'corner';

const QR_SIZE = { center: 200, corner: 140 } as const;
const QR_PAD = { center: 12, corner: 8 } as const;

export class QrOverlay {
  readonly el: HTMLDivElement;
  private frame: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private hint: HTMLParagraphElement;
  joinUrl = '';
  private placement: QrPlacement = 'center';
  private renderGen = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'qr-overlay qr-center';
    this.frame = document.createElement('div');
    this.frame.className = 'qr-frame qr-frame--loading';
    this.hint = document.createElement('p');
    this.hint.textContent = '扫码点亮你的名字';
    this.canvas = document.createElement('canvas');
    this.frame.appendChild(this.canvas);
    this.el.appendChild(this.frame);
    this.el.appendChild(this.hint);
    this.el.style.display = displayConfig.showQr ? '' : 'none';
    this.syncFrameSize();
  }

  private qrPixelSize(): number {
    return QR_SIZE[this.placement];
  }

  private syncFrameSize(): void {
    const size = this.qrPixelSize();
    const pad = QR_PAD[this.placement];
    const outer = size + pad * 2;
    this.frame.style.width = `${outer}px`;
    this.frame.style.height = `${outer}px`;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
  }

  private setLoading(loading: boolean): void {
    this.frame.classList.toggle('qr-frame--loading', loading);
  }

  async setJoinUrl(url: string): Promise<void> {
    this.joinUrl = url;
    if (!url) {
      this.setLoading(true);
      return;
    }

    const gen = ++this.renderGen;
    this.setLoading(true);
    this.syncFrameSize();
    const width = this.qrPixelSize();
    await QRCode.toCanvas(this.canvas, url, { width, margin: 1 });
    if (gen !== this.renderGen) return;
    this.setLoading(false);
  }

  /** Center when nobody has checked in; corner once at least one person has joined. */
  setHasCheckIns(has: boolean, opts?: { animate?: boolean }): void {
    const target: QrPlacement = has ? 'corner' : 'center';
    if (target === this.placement) return;

    const prev = this.placement;
    this.placement = target;
    this.el.classList.toggle('qr-center', target === 'center');
    this.el.classList.toggle('qr-corner', target === 'corner');

    const animate = opts?.animate !== false;
    this.el.classList.toggle('qr-animate', animate);
    if (!animate) {
      this.el.classList.remove('qr-animate');
    }

    this.syncFrameSize();
    if (prev !== target && this.joinUrl) {
      void this.setJoinUrl(this.joinUrl);
    }
  }

  setVisible(v: boolean): void {
    this.el.style.display = v && displayConfig.showQr ? '' : 'none';
  }

  fadeOut(): void {
    if (!displayConfig.qrFadeOutOnCompleted) return;
    this.el.style.opacity = '0';
    setTimeout(() => this.setVisible(false), 1200);
  }

  show(): void {
    this.el.style.opacity = '1';
    this.setVisible(true);
  }
}
