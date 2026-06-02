import * as Linking from "expo-linking";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { launchProvider } from "./provider-launch";

vi.mock("expo-linking", () => ({
  canOpenURL: vi.fn(),
  openURL: vi.fn()
}));

describe("launchProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the provider app URL when it is available", async () => {
    vi.mocked(Linking.canOpenURL).mockResolvedValue(true);
    vi.mocked(Linking.openURL).mockResolvedValue(true);

    await launchProvider(createTarget());

    expect(Linking.canOpenURL).toHaveBeenCalledWith("discord://channel");
    expect(Linking.openURL).toHaveBeenCalledWith("discord://channel");
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
  });

  it("falls back to the web URL when the app URL cannot open", async () => {
    vi.mocked(Linking.canOpenURL).mockResolvedValue(false);
    vi.mocked(Linking.openURL).mockResolvedValue(true);

    await launchProvider(createTarget());

    expect(Linking.openURL).toHaveBeenCalledWith("https://discord.gg/syncthia");
  });

  it("falls back to the web URL when opening the app URL fails", async () => {
    vi.mocked(Linking.canOpenURL).mockResolvedValue(true);
    vi.mocked(Linking.openURL)
      .mockRejectedValueOnce(new Error("Native launch failed."))
      .mockResolvedValueOnce(true);

    await launchProvider(createTarget());

    expect(Linking.openURL).toHaveBeenNthCalledWith(1, "discord://channel");
    expect(Linking.openURL).toHaveBeenNthCalledWith(
      2,
      "https://discord.gg/syncthia"
    );
  });

  it("throws provider instructions when no launch URL opens", async () => {
    vi.mocked(Linking.canOpenURL).mockResolvedValue(false);
    vi.mocked(Linking.openURL).mockRejectedValue(new Error("No browser."));

    await expect(launchProvider(createTarget())).rejects.toThrow(
      "Could not open Discord. Open Discord and join the agreed invite."
    );
  });
});

function createTarget() {
  return {
    provider: "discord" as const,
    label: "Discord",
    appUrl: "discord://channel",
    webUrl: "https://discord.gg/syncthia",
    instructions: "Open Discord and join the agreed invite."
  };
}
