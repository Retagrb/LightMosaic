import * as signalR from '@microsoft/signalr';
import type { CeremonySnapshot, GraduateJoinedPayload } from '../types/ceremony';

export interface CeremonyHandlers {
  onGraduateJoined: (p: GraduateJoinedPayload) => void;
  onStageChanged: (stage: string) => void;
  onJoinUrlChanged: (joinUrl: string) => void;
  onReset: () => void;
  onGraduatesCleared: () => void;
  onEnterFinal: () => void;
  onForceComplete: () => void;
  onReconnected: () => void;
}

export class CeremonyClient {
  private connection: signalR.HubConnection;

  constructor(private readonly handlers: CeremonyHandlers) {
    const base = import.meta.env.DEV ? '' : '';
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${base}/hubs/ceremony?display=1`)
      .withAutomaticReconnect()
      .build();

    this.connection.on('graduateJoined', (p: GraduateJoinedPayload) => handlers.onGraduateJoined(p));
    this.connection.on('stageChanged', (data: { stage: string }) => handlers.onStageChanged(data.stage));
    this.connection.on('joinUrlChanged', (data: { joinUrl: string }) => handlers.onJoinUrlChanged(data.joinUrl));
    this.connection.on('reset', () => handlers.onReset());
    this.connection.on('graduatesCleared', () => handlers.onGraduatesCleared());
    this.connection.on('enterFinal', () => handlers.onEnterFinal());
    this.connection.on('forceComplete', () => handlers.onForceComplete());
    this.connection.onreconnected(() => handlers.onReconnected());
  }

  async start(): Promise<void> {
    await this.connection.start();
  }

  async requestSync(): Promise<CeremonySnapshot> {
    return this.connection.invoke<CeremonySnapshot>('RequestSync');
  }

  async enterFinal(): Promise<void> {
    await this.connection.invoke('EnterFinal');
  }

  async notifyFinalTransformFinished(): Promise<void> {
    await this.connection.invoke('NotifyFinalTransformFinished');
  }
}
