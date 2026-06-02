import { describe, expect, it } from "bun:test";
import { parseCommandArgs, parseModelsFlag } from "../src/arguments";

describe("parseCommandArgs", () => {
  it("parses topic only", () => {
    const result = parseCommandArgs("Should we use Redis?");
    expect(result.topic).toBe("Should we use Redis?");
    expect(result.modelsFlag).toBeUndefined();
  });

  it("parses --models flag and topic", () => {
    const result = parseCommandArgs(
      "--models openai/gpt-5,anthropic/claude-sonnet Should we use Redis?",
    );
    expect(result.topic).toBe("Should we use Redis?");
    expect(result.modelsFlag).toBe("openai/gpt-5,anthropic/claude-sonnet");
  });

  it("parses --models flag with no topic", () => {
    const result = parseCommandArgs("--models openai/gpt-5");
    expect(result.topic).toBeUndefined();
    expect(result.modelsFlag).toBe("openai/gpt-5");
  });

  it("returns undefined for empty args", () => {
    const result = parseCommandArgs("");
    expect(result.topic).toBeUndefined();
    expect(result.modelsFlag).toBeUndefined();
  });
});

describe("parseModelsFlag", () => {
  it("splits comma-separated selectors", () => {
    expect(parseModelsFlag("a/b,c/d")).toEqual(["a/b", "c/d"]);
  });

  it("trims whitespace", () => {
    expect(parseModelsFlag(" a/b , c/d ")).toEqual(["a/b", "c/d"]);
  });

  it("filters empty strings", () => {
    expect(parseModelsFlag("a/b,,c/d")).toEqual(["a/b", "c/d"]);
  });
});
