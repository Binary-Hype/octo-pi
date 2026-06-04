export interface ParsedCommandArgs {
  topic: string | undefined;
  modelsFlag: string | undefined;
  maxRounds: number;
}

const DEFAULT_MAX_ROUNDS = 3;
const MIN_MAX_ROUNDS = 1;
const MAX_MAX_ROUNDS = 10;

export function parseCommandArgs(args: string): ParsedCommandArgs {
  let remaining = args.trim();
  let modelsFlag: string | undefined;
  let maxRounds = DEFAULT_MAX_ROUNDS;

  const modelsMatch = remaining.match(/--models\s+(\S+)/);
  if (modelsMatch) {
    modelsFlag = modelsMatch[1];
    remaining = remaining.replace(modelsMatch[0], "").trim();
  }

  const maxRoundsMatch = remaining.match(/--max-rounds\s+(\S+)/);
  if (maxRoundsMatch) {
    maxRounds = parseMaxRounds(maxRoundsMatch[1]);
    remaining = remaining.replace(maxRoundsMatch[0], "").trim();
  }

  const topic = remaining || undefined;
  return { topic, modelsFlag, maxRounds };
}

export function parseModelsFlag(flag: string): string[] {
  const seen = new Set<string>();
  const selectors: string[] = [];
  for (const selector of flag.split(",")) {
    const trimmed = selector.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    selectors.push(trimmed);
  }
  return selectors;
}

function parseMaxRounds(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error("--max-rounds must be an integer from 1 to 10");
  }
  const value = Number(raw);
  if (value < MIN_MAX_ROUNDS || value > MAX_MAX_ROUNDS) {
    throw new Error("--max-rounds must be an integer from 1 to 10");
  }
  return value;
}
