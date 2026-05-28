import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpoNotificationSender } from "./expo-notification-sender";
import type { NotificationDelivery } from "./notification-sender";

describe("ExpoNotificationSender", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts one Expo push message per registered device", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      okResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const sender = new ExpoNotificationSender(
      configService({
        EXPO_ACCESS_TOKEN: "expo-token",
        EXPO_PUSH_URL: "https://push.example.test/send"
      })
    );

    await sender.send(createDelivery());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://push.example.test/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer expo-token",
          "Content-Type": "application/json"
        })
      })
    );

    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(String(request.body))).toEqual([
      expect.objectContaining({
        to: "ExponentPushToken[one]",
        title: "Switch proposed",
        body: "Switch to Discord: streaming",
        data: expect.objectContaining({
          type: "switch.proposed",
          proposalId: "proposal-1",
          sessionId: "session-1",
          fromProvider: "messenger",
          toProvider: "discord",
          status: "proposed"
        })
      }),
      expect.objectContaining({
        to: "ExponentPushToken[two]"
      })
    ]);
  });

  it("does not call Expo when a delivery has no devices", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      okResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const sender = new ExpoNotificationSender(configService());

    await sender.send({ ...createDelivery(), devices: [] });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when Expo returns an unsuccessful HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => "Expo is unavailable."
      }))
    );

    const sender = new ExpoNotificationSender(configService());

    await expect(sender.send(createDelivery())).rejects.toThrow(
      "Expo is unavailable."
    );
  });

  it("throws when Expo returns an error ticket", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        okResponse({
          data: [
            {
              status: "error",
              message: "DeviceNotRegistered",
              details: { error: "DeviceNotRegistered" }
            }
          ]
        })
      )
    );

    const sender = new ExpoNotificationSender(configService());

    await expect(sender.send(createDelivery())).rejects.toThrow(
      "DeviceNotRegistered (DeviceNotRegistered)"
    );
  });
});

function configService(values: Record<string, string> = {}): ConfigService {
  return {
    get: vi.fn((key: string) => values[key])
  } as unknown as ConfigService;
}

function okResponse(body: unknown = { data: [{ status: "ok", id: "ticket-1" }] }) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => ""
  };
}

function createDelivery(): NotificationDelivery {
  const now = "2026-05-28T00:00:00.000Z";

  return {
    job: {
      id: "job-1",
      recipientId: "u2",
      type: "switch.proposed",
      proposalId: "proposal-1",
      deviceCount: 2,
      payload: {
        id: "proposal-1",
        sessionId: "session-1",
        fromProvider: "messenger",
        toProvider: "discord",
        reason: "streaming",
        status: "proposed"
      },
      status: "queued",
      attempts: 0,
      createdAt: now,
      updatedAt: now
    },
    devices: [
      {
        id: "device-1",
        userId: "u2",
        pushToken: "ExponentPushToken[one]",
        platform: "ios",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "device-2",
        userId: "u2",
        pushToken: "ExponentPushToken[two]",
        platform: "android",
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}
