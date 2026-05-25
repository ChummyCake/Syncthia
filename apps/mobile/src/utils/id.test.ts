import { describe, expect, it } from "vitest";
import { createLocalId } from "./id";

describe("createLocalId", () => {
  it("prefixes generated local ids", () => {
    expect(createLocalId("user")).toMatch(/^user-/);
  });
});
