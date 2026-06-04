import { HttpException, HttpStatus } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RateLimitService } from "./rate-limit.service";

const rule = {
  name: "test",
  limit: 2,
  windowMs: 1_000
};

describe("RateLimitService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the configured limit", () => {
    const service = new RateLimitService();

    expect(() => service.assertAllowed("u1", rule)).not.toThrow();
    expect(() => service.assertAllowed("u1", rule)).not.toThrow();
  });

  it("rejects requests over the configured limit", () => {
    const service = new RateLimitService();

    service.assertAllowed("u1", rule);
    service.assertAllowed("u1", rule);

    expect(() => service.assertAllowed("u1", rule)).toThrow(HttpException);
    try {
      service.assertAllowed("u1", rule);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  });

  it("tracks separate keys independently", () => {
    const service = new RateLimitService();

    service.assertAllowed("u1", rule);
    service.assertAllowed("u1", rule);

    expect(() => service.assertAllowed("u2", rule)).not.toThrow();
  });

  it("resets buckets after the configured window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T00:00:00.000Z"));
    const service = new RateLimitService();

    service.assertAllowed("u1", rule);
    service.assertAllowed("u1", rule);
    expect(() => service.assertAllowed("u1", rule)).toThrow(HttpException);

    vi.setSystemTime(new Date("2026-06-04T00:00:01.001Z"));

    expect(() => service.assertAllowed("u1", rule)).not.toThrow();
  });
});
