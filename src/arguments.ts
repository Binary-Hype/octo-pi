export function parseCommandArgs(args: string): { topic: string | undefined; modelsFlag: string | undefined } {
  let remaining = args.trim();
  let modelsFlag: string | undefined;
  const modelsMatch = remaining.match(/--models\s+(\S+)/);
  if (modelsMatch) {
    modelsFlag = modelsMatch[1];
    remaining = remaining.replace(modelsMatch[0], "").trim();
  }
  const topic = remaining || undefined;
  return { topic, modelsFlag };
}

export function parseModelsFlag(flag: string): string[] {
  return flag.split(",").map((s) => s.trim()).filter(Boolean);
}
