import { describe, expect, it } from "bun:test";
import { loadExtensions } from "@oh-my-pi/pi-coding-agent/extensibility/extensions";

import extension from "../extensions/index";

describe("extension entrypoint", () => {
  it("exports the Octo-Pi extension factory", () => {
    expect(extension).toBeFunction();
  });

  it("uses the new OMP extensions package field", async () => {
    const packageJson = await Bun.file("package.json").json();
    expect(packageJson.omp?.extensions).toEqual(["./extensions/index.ts"]);
  });

  it("loads and registers slash commands with the current OMP API", async () => {
    const result = await loadExtensions(["./extensions/index.ts"], process.cwd());

    expect(result.errors).toEqual([]);
    expect(result.extensions).toHaveLength(1);
    expect([...result.extensions[0].commands.keys()]).toEqual(["debate", "brainstorm", "research"]);
    expect([...result.extensions[0].tools.keys()]).toEqual([
      "octopus_multi_model_round",
      "octopus_research_round",
      "octopus_next_step",
    ]);
  });
});
