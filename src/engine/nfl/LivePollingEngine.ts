export type LivePollingHandler<T> = (data: T) => void | Promise<void>;

export interface LivePollingOptions<T> {
  intervalMs?: number;
  fetcher: () => Promise<T>;
  onData: LivePollingHandler<T>;
  onError?: (error: unknown) => void;
  immediate?: boolean;
}

export class LivePollingEngine<T> {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly options: LivePollingOptions<T>;

  constructor(options: LivePollingOptions<T>) {
    this.options = options;
  }

  start(): void {
    if (this.running) return;

    this.running = true;

    if (this.options.immediate ?? true) {
      void this.tick();
    }

    this.timerId = setInterval(() => {
      void this.tick();
    }, this.options.intervalMs ?? 30_000);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private async tick(): Promise<void> {
    try {
      const data = await this.options.fetcher();
      await this.options.onData(data);
    } catch (error) {
      this.options.onError?.(error);
    }
  }
}