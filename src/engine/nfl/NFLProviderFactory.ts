import type { NFLDataProvider } from "./NFLDataProvider";
import { MockNFLDataProvider } from "./MockNFLDataProvider";

export const NFLProviderType = {
  Mock: "mock",
  ESPN: "espn",
  NFL: "nfl",
} as const;

export type NFLProviderType =
  (typeof NFLProviderType)[keyof typeof NFLProviderType];

export class NFLProviderFactory {
  private static provider: NFLDataProvider = new MockNFLDataProvider();

  static getProvider(): NFLDataProvider {
    return this.provider;
  }

  static setProvider(provider: NFLDataProvider): void {
    this.provider = provider;
  }

  static reset(): void {
    this.provider = new MockNFLDataProvider();
  }
}