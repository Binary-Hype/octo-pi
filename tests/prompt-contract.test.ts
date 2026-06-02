import { describe, expect, it } from "bun:test";
import { orchestratorKickoffPrompt } from "../src/prompts";

describe("orchestratorKickoffPrompt", () => {
  it("contains mode and topic", () => {
    const prompt = orchestratorKickoffPrompt({
      mode: "debate",
      topic: "Should we use Redis?",
      selectedModels: ["openai/gpt-4", "anthropic/claude-sonnet"],
    });
    expect(prompt).toContain("debate");
    expect(prompt).toContain("Should we use Redis?");
    expect(prompt).toContain("openai/gpt-4");
    expect(prompt).toContain("anthropic/claude-sonnet");
  });

  it("contains role palette for debate", () => {
    const prompt = orchestratorKickoffPrompt({
      mode: "debate",
      topic: "X",
      selectedModels: ["a/b"],
    });
    expect(prompt).toContain("Proponent / steelman");
    expect(prompt).toContain("Skeptic / red-team");
  });

  it("contains role palette for brainstorm", () => {
    const prompt = orchestratorKickoffPrompt({
      mode: "brainstorm",
      topic: "X",
      selectedModels: ["a/b"],
    });
    expect(prompt).toContain("Technical feasibility analyst");
    expect(prompt).toContain("Lateral thinker");
  });

  it("instructs to call octopus_multi_model_round", () => {
    const prompt = orchestratorKickoffPrompt({
      mode: "debate",
      topic: "X",
      selectedModels: ["a/b"],
    });
    expect(prompt).toContain("octopus_multi_model_round");
    expect(prompt).toContain("octopus_next_step");
  });

  it("contains synthesis instructions for debate", () => {
    const prompt = orchestratorKickoffPrompt({
      mode: "debate",
      topic: "X",
      selectedModels: ["a/b"],
    });
    expect(prompt).toContain("AGREEMENT");
    expect(prompt).toContain("DISAGREEMENT");
  });

  it("contains synthesis instructions for brainstorm", () => {
    const prompt = orchestratorKickoffPrompt({
      mode: "brainstorm",
      topic: "X",
      selectedModels: ["a/b"],
    });
    expect(prompt).toContain("CONVERGENCE");
    expect(prompt).toContain("DIVERGENCE");
  });
});
