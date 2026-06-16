import { describe, expect, it } from "bun:test";

import extension from "../extensions/index";

describe("extension entrypoint", () => {
  it("exports the Octo-Pi extension factory", () => {
    expect(extension).toBeFunction();
  });

  it("uses the new OMP extensions package field", async () => {
    const packageJson = await Bun.file("package.json").json();
    expect(packageJson.omp?.extensions).toEqual(["./extensions/index.ts"]);
  });
});
