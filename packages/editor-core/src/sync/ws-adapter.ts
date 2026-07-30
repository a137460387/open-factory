/**
 * WebSocket adapters for multi-device sync
 */

import type { WSAdapter } from './types';

/**
 * Browser WebSocket adapter
 */
export class BrowserWSAdapter implements WSAdapter {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<(message: { type: string; payload: unknown }) => void> = new Set();
  private openHandlers: Set<() => void> = new Set();
  private closeHandlers: Set<() => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();

  constructor(private url: string) {}

  async send(message: { type: string; payload: unknown }): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.openHandlers.forEach((handler) => handler());
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.messageHandlers.forEach((handler) => handler(message));
      } catch (error) {
        this.errorHandlers.forEach((handler) =>
          handler(error instanceof Error ? error : new Error('Failed to parse message')),
        );
      }
    };

    this.ws.onclose = () => {
      this.closeHandlers.forEach((handler) => handler());
    };

    this.ws.onerror = (event) => {
      this.errorHandlers.forEach((handler) => handler(new Error(`WebSocket error: ${event}`)));
    };
  }

  onMessage(handler: (message: { type: string; payload: unknown }) => void): void {
    this.messageHandlers.add(handler);
  }

  onOpen(handler: () => void): void {
    this.openHandlers.add(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.add(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.add(handler);
  }
}

/**
 * Mock WebSocket adapter (for testing)
 */
export class MockWSAdapter implements WSAdapter {
  private messageHandlers: Set<(message: { type: string; payload: unknown }) => void> = new Set();
  private openHandlers: Set<() => void> = new Set();
  private closeHandlers: Set<() => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();
  private sentMessages: Array<{ type: string; payload: unknown }> = [];
  private connected = false;

  async send(message: { type: string; payload: unknown }): Promise<void> {
    if (!this.connected) {
      throw new Error('WebSocket is not connected');
    }
    this.sentMessages.push(message);
  }

  close(): void {
    this.connected = false;
    this.closeHandlers.forEach((handler) => handler());
  }

  connect(): void {
    this.connected = true;
    this.openHandlers.forEach((handler) => handler());
  }

  simulateIncoming(message: { type: string; payload: unknown }): void {
    this.messageHandlers.forEach((handler) => handler(message));
  }

  simulateError(error: Error): void {
    this.errorHandlers.forEach((handler) => handler(error));
  }

  getSentMessages(): Array<{ type: string; payload: unknown }> {
    return [...this.sentMessages];
  }

  isConnected(): boolean {
    return this.connected;
  }

  onMessage(handler: (message: { type: string; payload: unknown }) => void): void {
    this.messageHandlers.add(handler);
  }

  onOpen(handler: () => void): void {
    this.openHandlers.add(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.add(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.add(handler);
  }
}
