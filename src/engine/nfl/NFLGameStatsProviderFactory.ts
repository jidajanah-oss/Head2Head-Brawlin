import { ESPNNFLGameStatsProvider } from "./ESPNNFLGameStatsProvider";
import type { NFLGameStatsProvider } from "./NFLGameStatsTypes";

function createDefaultProvider(): NFLGameStatsProvider {
  return new ESPNNFLGameStatsProvider();
}

export class NFLGameStatsProviderFactory {
  private static provider: NFLGameStatsProvider =
    createDefaultProvider();

  static getProvider(): NFLGameStatsProvider {
    return this.provider;
  }

  static setProvider(
    provider: NFLGameStatsProvider,
  ): void {
    this.provider = provider;
  }

  static reset(): void {
    this.provider = createDefaultProvider();
  }
}