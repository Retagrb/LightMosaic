import { Application, Container } from 'pixi.js';
import { displayConfig, triggerCount } from '../config/displayConfig';
import { sampleMask } from '../mask/maskSampler';
import type { CeremonySnapshot, CeremonyStage, GraduateJoinedPayload, LitSlot, SlotAssignment, SlotPoint } from '../types/ceremony';
import { buildTopology, type MaskTopology } from './slotAssigner';
import { replayGraduates, replayOne } from './syncReplay';
import {
  buildPreservedSymbolTargets,
  rightEdgeCenter,
  splitFinalMask,
} from './finalComposition';
import { pickColor } from './colorPalette';
import { CeremonyClient } from '../signalr/ceremonyClient';
import { fitMaskLayout } from '../layout/stageLayout';
import { Starfield } from '../scene/starfield';
import { GlyphLights } from '../scene/glyphLights';
import { CometName, pickCometTarget, randomEdgeSpawn } from '../scene/cometName';
import { MorphAnimator } from '../scene/scatterGather';
import { OrbitLights } from '../scene/orbitLights';
import { GraduateQueue } from './graduateQueue';
import { cometPipelineTiming, type PipelineLoad } from './pipelineTiming';
import { QrOverlay } from '../ui/qrOverlay';
import { StatsHud } from '../ui/statsHud';
import { FinalSubtitle } from '../ui/finalSubtitle';

export class CeremonyController {
  private app!: Application;
  private world = new Container();
  private cometTrailLayer = new Container();
  private cometLabelHost!: HTMLDivElement;
  private starfield = new Starfield();
  private glyph = new GlyphLights();
  private finalExtras = new GlyphLights();
  private orbits = new OrbitLights();
  private morph = new MorphAnimator();
  private queue!: GraduateQueue;
  private client!: CeremonyClient;

  private stage: CeremonyStage = 'Idle';
  private ceremonySeed = '';
  private usedSlotIds = new Set<number>();
  private symbolSample!: Awaited<ReturnType<typeof sampleMask>>;
  private finalSample!: Awaited<ReturnType<typeof sampleMask>>;
  private topology!: MaskTopology;
  private finalFirstCharacterPoints: SlotPoint[] = [];
  private finalExtraPoints: SlotPoint[] = [];
  private finalSymbolTargets = new Map<number, { x: number; y: number }>();
  private symbolLayout = { x: 0, y: 0, width: 100, height: 100 };
  private finalLayout = { x: 0, y: 0, width: 100, height: 100 };
  private comets: CometName[] = [];
  private enterFinalPending = false;
  private morphing = false;
  private litCount = 0;
  private sessionId = 0;
  private graduateIds = new Set<string>();
  private embedTimers = new Set<ReturnType<typeof setTimeout>>();
  private embedsInFlight = 0;
  private cometStartQueue: Array<{ payload: GraduateJoinedPayload; releaseQueue: () => void }> = [];
  private cometLaunchTimer: number | null = null;
  private lastCometLaunchAt = 0;

  readonly qr = new QrOverlay();
  readonly stats = new StatsHud();
  readonly finalSubtitle = new FinalSubtitle();

  async init(host: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      resizeTo: host,
      background: '#7b18f0',
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    host.appendChild(this.app.canvas);

    this.cometLabelHost = document.createElement('div');
    this.cometLabelHost.className = 'comet-labels';
    host.appendChild(this.cometLabelHost);

    this.world.addChild(this.starfield.view);
    this.world.addChild(this.glyph.view);
    this.world.addChild(this.finalExtras.view);
    this.world.addChild(this.orbits.view);
    this.world.addChild(this.cometTrailLayer);
    this.app.stage.addChild(this.world);

    document.body.appendChild(this.qr.el);
    document.body.appendChild(this.stats.el);
    document.body.appendChild(this.finalSubtitle.el);

    this.queue = new GraduateQueue(
      displayConfig.nameMaxConcurrent,
      () => displayConfig.pauseNameQueue,
    );

    await this.loadMasks('init');

    this.client = new CeremonyClient({
      onGraduateJoined: (p) => this.onGraduateJoined(p),
      onStageChanged: (s) => this.onStageChanged(s as CeremonyStage),
      onJoinUrlChanged: (url) => void this.qr.setJoinUrl(url),
      onReset: () => void this.onReset(),
      onGraduatesCleared: () => void this.sync(),
      onEnterFinal: () => void this.startMorph(),
      onForceComplete: () => void this.startMorph(),
      onReconnected: () => void this.sync(),
    });

    this.orbits.setAnchorResolver((slotId) => this.glyph.getScreenPos(slotId));

    await this.client.start();
    await this.sync();

    this.app.ticker.add((t) => this.tick(t.deltaMS));
    const ro = new ResizeObserver(() => this.onResize());
    ro.observe(host);
    this.app.renderer.on('resize', () => this.onResize());
    this.onResize();
  }

  private async loadMasks(seed: string): Promise<void> {
    const s = hashSeed(seed);
    this.finalSample = await sampleMask(
      displayConfig.finalMaskUrl,
      s + 1,
      true,
      displayConfig.finalMaskSampleTarget,
    );
    const finalParts = splitFinalMask(
      this.finalSample.points,
      displayConfig.finalCharacterCutoffs,
    );
    this.finalFirstCharacterPoints = finalParts.firstCharacter;
    this.finalExtraPoints = finalParts.extraCharacters;
    this.symbolSample = await sampleMask(
      displayConfig.symbolMaskUrl,
      s,
      false,
      Math.max(1, this.finalFirstCharacterPoints.length),
    );
    this.topology = buildTopology(this.symbolSample.points, seed);
    this.topology.finalSlots = this.finalSample.points;
  }

  private async sync(): Promise<void> {
    const snap = await this.client.requestSync();
    await this.applySnapshot(snap, true);
  }

  private async applySnapshot(snap: CeremonySnapshot, full: boolean): Promise<void> {
    this.sessionId++;
    this.stage = snap.stage;
    if (snap.stage === 'Completed') this.finalSubtitle.show(false);
    else this.finalSubtitle.hide();
    this.ceremonySeed = snap.ceremonySeed;
    this.litCount = snap.litCount;
    this.usedSlotIds.clear();
    this.graduateIds.clear();
    this.cancelPendingEmbeds();
    this.glyph.clear();
    this.finalExtras.clear();
    this.orbits.clear();
    this.queue.clear();
    this.comets.forEach((c) => c.destroy());
    this.comets = [];
    this.morph.phase = 'idle';
    this.morphing = false;
    this.enterFinalPending = false;
    this.embedsInFlight = 0;
    this.clearCometStartQueue();

    if (full) {
      await this.loadMasks(snap.ceremonySeed);
    }

    this.topology = buildTopology(this.symbolSample.points, snap.ceremonySeed);
    this.topology.finalSlots = this.finalSample.points;
    this.onResize();

    await this.qr.setJoinUrl(snap.joinUrl);
    if (snap.stage === 'Completed') this.qr.fadeOut();
    else this.qr.show();
    this.litCount = snap.litCount;
    this.stats.update(snap.litCount, displayConfig.expectedCount);

    const replay = replayGraduates(snap, this.topology);
    this.usedSlotIds = replay.usedSlotIds;
    for (const g of snap.recentGraduates) this.graduateIds.add(g.id);

    const hasCheckIns = this.graduateIds.size > 0 || snap.litCount > 0;
    this.qr.setHasCheckIns(hasCheckIns, { animate: false });

    if (snap.stage === 'FinalTransform' || snap.stage === 'Completed') {
      this.glyph.clearMorphMappings();
      this.glyph.setMask(this.symbolSample.points, this.symbolLayout);
      this.glyph.setPositionOverrides(this.finalSymbolTargets, false);
      this.glyph.hideDim();
      this.glyph.setLitImmediate(replay.litSlots);
      this.finalExtras.setMask(this.finalExtraPoints, this.finalLayout);
      this.finalExtras.hideDim();
      this.finalExtras.setLitImmediate(this.buildFinalExtraSlots());
      if (snap.stage === 'Completed') {
        this.spawnOrbitsForCompleted(snap.recentGraduates, replay.assignments);
      }
    } else {
      this.glyph.clearMorphMappings();
      this.glyph.clearPositionOverrides();
      this.glyph.setMask(this.symbolSample.points, this.symbolLayout);
      this.glyph.setLitImmediate(replay.litSlots);
    }
  }

  private spawnOrbitsForCompleted(
    grads: GraduateJoinedPayload[],
    assignments: Map<string, SlotAssignment>,
  ): void {
    const trigger = triggerCount();
    for (const g of grads) {
      if (g.index <= trigger) continue;
      const assignment = assignments.get(g.id);
      if (!assignment) continue;
      this.orbits.add(g.id, assignment.mainSlotId, assignment.lightColor);
    }
  }

  private onGraduateJoined(p: GraduateJoinedPayload): void {
    if (this.graduateIds.has(p.id)) return;
    const firstCheckIn = this.graduateIds.size === 0 && this.litCount === 0;
    this.litCount = p.index;
    this.stats.update(this.litCount, displayConfig.expectedCount);
    if (firstCheckIn) this.qr.setHasCheckIns(true, { animate: true });

    const postFinal = this.stage === 'FinalTransform' || this.stage === 'Completed';
    const skipComet = postFinal && p.source === 'Mobile';

    if (skipComet) {
      const calm = cometPipelineTiming(this.pipelineLoad()).embedFlyDurationMs;
      this.applyGraduateSlots(p, null, calm, () => this.afterGraduateApplied());
      return;
    }

    if (postFinal) {
      this.enqueueCometStart(p, () => {});
      return;
    }

    this.queue.enqueue(p, (payload, done) => {
      this.enqueueCometStart(payload, done);
    });
  }

  private enqueueCometStart(p: GraduateJoinedPayload, releaseQueue: () => void): void {
    this.cometStartQueue.push({ payload: p, releaseQueue });
    this.drainCometStarts();
  }

  /** Launch comets with a real inter-start gap; cap in-flight count for readability. */
  private drainCometStarts(): void {
    if (this.cometLaunchTimer !== null) return;
    if (this.cometStartQueue.length === 0) return;
    if (this.comets.length >= displayConfig.cometMaxInFlight) return;

    const timing = cometPipelineTiming(this.pipelineLoad());
    const now = performance.now();
    const wait = Math.max(0, this.lastCometLaunchAt + timing.launchGapMs - now);

    this.cometLaunchTimer = window.setTimeout(() => {
      this.cometLaunchTimer = null;
      if (this.cometStartQueue.length === 0) return;
      if (this.comets.length >= displayConfig.cometMaxInFlight) {
        this.drainCometStarts();
        return;
      }

      const item = this.cometStartQueue.shift()!;
      this.lastCometLaunchAt = performance.now();
      item.releaseQueue();

      const flight = cometPipelineTiming(this.pipelineLoad());
      this.runComet(item.payload, flight.cometDurationMs, (x, y) => {
        this.applyGraduateSlots(item.payload, { x, y }, flight.embedFlyDurationMs, () => {
          this.afterGraduateApplied();
        });
      });

      this.drainCometStarts();
    }, wait);
  }

  private pipelineLoad(): PipelineLoad {
    return {
      queuePending: this.queue.pendingCount,
      cometsWaiting: this.cometStartQueue.length,
      cometsInFlight: this.comets.length,
      embedsInFlight: this.embedsInFlight,
    };
  }

  private clearCometStartQueue(): void {
    if (this.cometLaunchTimer !== null) {
      clearTimeout(this.cometLaunchTimer);
      this.cometLaunchTimer = null;
    }
    this.cometStartQueue = [];
    this.lastCometLaunchAt = 0;
  }

  private applyGraduateSlots(
    p: GraduateJoinedPayload,
    origin: { x: number; y: number } | null,
    embedFlyDurationMs: number,
    onDone: () => void,
  ): void {
    const session = this.sessionId;
    if (this.graduateIds.has(p.id)) {
      onDone();
      return;
    }

    const { assignment, newLit } = replayOne(
      p,
      this.ceremonySeed,
      this.stage,
      this.topology,
      this.usedSlotIds,
    );
    this.graduateIds.add(p.id);

    const spawn = origin ?? {
      x: this.app.screen.width / 2,
      y: this.app.screen.height / 2 - 40,
    };
    if (this.stage === 'FinalTransform' || this.stage === 'Completed') {
      this.orbits.add(p.id, assignment.mainSlotId, assignment.lightColor);
      onDone();
      return;
    }

    if (newLit.length === 0) {
      onDone();
      return;
    }

    this.embedsInFlight++;

    const embedMs = this.glyph.flyInFrom(
      newLit,
      spawn.x,
      spawn.y,
      displayConfig.embedStaggerMs,
      embedFlyDurationMs,
    );
    const slotIds = newLit.map((s) => s.slotId);

    // Release queue / trigger final as soon as lights leave the name — fly-in continues on ticker.
    onDone();

    const timer = setTimeout(() => {
      this.embedTimers.delete(timer);
      this.embedsInFlight = Math.max(0, this.embedsInFlight - 1);
      if (session === this.sessionId) {
        this.glyph.snapSlots(slotIds);
      }
    }, embedMs + 40);
    this.embedTimers.add(timer);
  }

  private cancelPendingEmbeds(): void {
    for (const t of this.embedTimers) clearTimeout(t);
    this.embedTimers.clear();
    this.embedsInFlight = 0;
  }

  private runComet(
    p: GraduateJoinedPayload,
    durationMs: number,
    onEmbedStart: (x: number, y: number) => void,
  ): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const from = randomEdgeSpawn(w, h);
    const to = pickCometTarget(w, h, p.id);
    const comet = new CometName(
      {
        name: p.name,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        durationMs,
        embedStartFraction: displayConfig.cometEmbedStartFraction,
        onEmbedStart: (x, y) => onEmbedStart(x, y),
      },
      this.cometTrailLayer,
      this.cometLabelHost,
    );
    this.comets.push(comet);
  }

  private afterGraduateApplied(): void {
    if (this.stage !== 'Collecting') return;
    if (this.litCount < triggerCount()) return;
    if (this.enterFinalPending) return;
    this.enterFinalPending = true;
    void this.triggerEnterFinal();
  }

  private async triggerEnterFinal(): Promise<void> {
    await this.waitPipelineIdle();
    await waitMs(400);
    await this.client.enterFinal();
  }

  /** Queue empty and all fly-in tweens finished (used before morph / enter final). */
  private async waitPipelineIdle(): Promise<void> {
    await this.queue.waitIdle();
    await waitUntil(
      () =>
        this.embedsInFlight === 0 &&
        this.comets.length === 0 &&
        this.cometStartQueue.length === 0 &&
        this.cometLaunchTimer === null,
    );
  }

  private onStageChanged(s: CeremonyStage): void {
    const prev = this.stage;
    this.setStage(s);
    if (s === 'Idle' && prev !== 'Idle') void this.sync();
    if (
      s === 'FinalTransform' &&
      prev === 'Collecting' &&
      !this.morphing &&
      this.morph.phase === 'idle'
    ) {
      void this.startMorph();
    }
  }

  private setStage(s: CeremonyStage): void {
    this.stage = s;
    if (s === 'Completed') this.finalSubtitle.show();
    else this.finalSubtitle.hide();
    if (s === 'Completed') this.qr.fadeOut();
  }

  private async onReset(): Promise<void> {
    const snap = await this.client.requestSync();
    await this.applySnapshot(snap, true);
  }

  private async startMorph(): Promise<void> {
    if (this.morphing) return;
    if (this.morph.phase !== 'idle' && this.morph.phase !== 'done') return;
    this.morphing = true;
    this.stage = 'FinalTransform';
    this.finalSubtitle.hide();

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.symbolLayout = this.layoutZhuoMask(w, h);
    this.finalLayout = this.layoutFinalMask(w, h);
    this.updateFinalCompositionLayout(false);
    this.finalSubtitle.setLayout(this.finalLayout);

    await this.waitPipelineIdle();
    this.comets.forEach((c) => c.destroy());
    this.comets = [];

    this.finalExtras.clear();
    this.finalExtras.setMask(this.finalExtraPoints, this.finalLayout);
    this.finalExtras.hideDim();

    this.morph.start(
      this.finalSymbolTargets,
      this.buildFinalExtraSlots(),
      rightEdgeCenter(this.finalSymbolTargets),
      this.glyph,
      displayConfig.finalSymbolMoveMs,
    );

    await waitUntil(() => this.morph.phase === 'done');

    this.glyph.setPositionOverrides(this.finalSymbolTargets);
    this.finalExtras.snapSlots(this.finalExtraPoints.map((point) => point.id));
    this.finalSubtitle.show();
    await this.client.notifyFinalTransformFinished();
    this.stage = 'Completed';
    this.morphing = false;
    this.qr.fadeOut();
  }

  private tick(dtMs: number): void {
    if (this.morph.phase === 'idle' || this.morph.phase === 'done') {
      this.glyph.update(dtMs);
      this.finalExtras.update(dtMs);
    }
    this.orbits.update(dtMs);
    const prevCometCount = this.comets.length;
    this.comets = this.comets.filter((c) => {
      const alive = c.update(dtMs);
      if (!alive) c.destroy();
      return alive;
    });
    if (this.comets.length < prevCometCount) this.drainCometStarts();
    if (this.morph.phase !== 'idle' && this.morph.phase !== 'done') {
      this.morph.update(
        dtMs,
        this.glyph,
        this.finalExtras,
        displayConfig.finalSymbolMoveMs,
        displayConfig.finalExtraStaggerMs,
        displayConfig.finalExtraRevealMs,
      );
    }
  }

  private onResize(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.starfield.resize(w, h);
    this.symbolLayout = this.layoutZhuoMask(w, h);
    this.finalLayout = this.layoutFinalMask(w, h);
    this.finalSubtitle.setLayout(this.finalLayout);

    const useFinal = this.stage === 'FinalTransform' || this.stage === 'Completed';
    if (useFinal) {
      this.updateFinalCompositionLayout(true);
    } else {
      this.glyph.clearPositionOverrides();
      this.glyph.setLayout(this.symbolLayout);
    }
  }

  private updateFinalCompositionLayout(remapPositions: boolean): void {
    this.finalSymbolTargets = buildPreservedSymbolTargets(
      this.symbolSample.points,
      this.symbolLayout,
      this.finalFirstCharacterPoints,
      this.finalLayout,
    );
    this.glyph.setLayout(this.symbolLayout, false);
    this.glyph.setPositionOverrides(this.finalSymbolTargets, remapPositions);
    this.finalExtras.setLayout(this.finalLayout, remapPositions);
  }

  private buildFinalExtraSlots(): LitSlot[] {
    return this.finalExtraPoints.map((point) => ({
      slotId: point.id,
      color: pickColor(this.ceremonySeed, `final-extra:${point.id}`),
      graduateId: `final-extra:${point.id}`,
      graduateName: '',
    }));
  }

  private layoutZhuoMask(w: number, h: number) {
    const c = displayConfig;
    return fitMaskLayout(
      w,
      h,
      c.symbolMaskMaxHeightFraction,
      this.symbolSample.pixelWidth,
      this.symbolSample.pixelHeight,
      c.maskMaxWidthFraction,
      c.maskVerticalOffsetFraction,
    );
  }

  private layoutFinalMask(w: number, h: number) {
    const c = displayConfig;
    return fitMaskLayout(
      w,
      h,
      c.finalMaskMaxHeightFraction,
      this.finalSample.pixelWidth,
      this.finalSample.pixelHeight,
      c.maskMaxWidthFraction,
      c.maskVerticalOffsetFraction,
    );
  }
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitUntil(done: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (done()) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}
