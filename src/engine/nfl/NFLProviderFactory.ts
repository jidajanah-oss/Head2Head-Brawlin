import { ESPNNFLDataProvider } from "./ESPNNFLDataProvider";
import { MockNFLDataProvider } from "./MockNFLDataProvider";
import type { NFLDataProvider } from "./NFLDataProvider";

export const NFLProviderType = {
  Mock: "mock",
  ESPN: "espn",
  NFL: "nfl",
} as const;

export type NFLProviderType =
  (typeof NFLProviderType)[keyof typeof NFLProviderType];

type NFLProviderEnvironment = {
  readonly VITE_NFL_PROVIDER?: string;
};

function getConfiguredProviderType(): NFLProviderType {
  const environment = (
    import.meta as ImportMeta & {
      readonly env?: NFLProviderEnvironment;
    }
  ).env;

  const configuredProvider =
    environment?.VITE_NFL_PROVIDER
      ?.trim()
      .toLowerCase();

  if (configuredProvider === NFLProviderType.Mock) {
    return NFLProviderType.Mock;
  }

  if (configuredProvider === NFLProviderType.NFL) {
    return NFLProviderType.NFL;
  }

  return NFLProviderType.ESPN;
}

function createProvider(
  providerType: NFLProviderType,
): NFLDataProvider {
  switch (providerType) {
    case NFLProviderType.Mock:
      return new MockNFLDataProvider();

    case NFLProviderType.ESPN:
    case NFLProviderType.NFL:
      return new ESPNNFLDataProvider();

    default:
      return new ESPNNFLDataProvider();
  }
}

function createConfiguredProvider(): NFLDataProvider {
  return createProvider(getConfiguredProviderType());
}

export class NFLProviderFactory {
  private static provider: NFLDataProvider =
    createConfiguredProvider();

  static getProvider(): NFLDataProvider {
    return this.provider;
  }

  static setProvider(
    provider: NFLDataProvider,
  ): void {
    this.provider = provider;
  }

  static reset(): void {
    this.provider = createConfiguredProvider();
  }
}