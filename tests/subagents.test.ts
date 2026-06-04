import { describe, expect, it } from "bun:test";
import {
  buildParticipantPrompt,
  deduplicateParticipants,
  sanitizeErrorMessage,
  validateModelSelector,
} from "../src/subagents";

describe("buildParticipantPrompt", () => {
  it("includes role, prompt, isolation instructions, and prior summary", () => {
    const prompt = buildParticipantPrompt(
      { model: "openai/gpt-4", role: "Skeptic", prompt: "Find risks" },
      "Shared prompt",
      "debate",
      "Round 1 found deployment risk.",
    );

    expect(prompt).toContain("Role: Skeptic");
    expect(prompt).toContain("Find risks");
    expect(prompt).toContain("Prior round synthesis");
    expect(prompt).toContain("Round 1 found deployment risk.");
    expect(prompt).toContain("no tools");
    expect(prompt).toContain("no file access");
    expect(prompt).toContain("no skills");
    expect(prompt).toContain("no external lookups");
    expect(prompt).toContain("Do not ask clarifying questions");
  });

  it("uses the shared prompt when no participant prompt is provided", () => {
    const prompt = buildParticipantPrompt(
      { model: "openai/gpt-4", role: "Implementer" },
      "Shared prompt",
      "brainstorm",
    );

    expect(prompt).toContain("Role: Implementer");
    expect(prompt).toContain("Shared prompt");
  });
});

describe("sanitizeErrorMessage", () => {
  it("redacts key-like secrets", () => {
    const result = sanitizeErrorMessage(
      "Provider failed: api_key=sk-1234567890abcdef token: abcdefghijklmnopqrstuvwxyz",
    );

    expect(result).toContain("api_key= [REDACTED]");
    expect(result).toContain("token: [REDACTED]");
    expect(result).not.toContain("sk-1234567890abcdef");
    expect(result).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });
});

describe("deduplicateParticipants", () => {
  it("preserves the first occurrence for each model selector", () => {
    const result = deduplicateParticipants([
      { model: "a/b", role: "First", prompt: "one" },
      { model: "c/d", role: "Second" },
      { model: "a/b", role: "Duplicate", prompt: "two" },
    ]);

    expect(result).toEqual([
      { model: "a/b", role: "First", prompt: "one" },
      { model: "c/d", role: "Second" },
    ]);
  });
});

describe("validateModelSelector", () => {
  it("accepts provider/model selectors", () => {
    expect(() => validateModelSelector("openai/gpt-4")).not.toThrow();
  });

  it("rejects malformed selectors", () => {
    expect(() => validateModelSelector("openai")).toThrow("Invalid model selector");
    expect(() => validateModelSelector("openai/")).toThrow("Invalid model selector");
    expect(() => validateModelSelector("/gpt-4")).toThrow("Invalid model selector");
    expect(() => validateModelSelector("openai/gpt 4")).toThrow("Invalid model selector");
  });
});
