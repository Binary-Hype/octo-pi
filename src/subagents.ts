import { createAgentSession, SessionManager } from "@oh-my-pi/pi-coding-agent";
import type {
  AuthStorage,
  ModelRegistry,
  SessionEntry,
  SessionMessageEntry,
} from "@oh-my-pi/pi-coding-agent";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { extractAssistantText, truncateOutput } from "./text.js";

export interface Participant {
  model: string;
  role: string;
  prompt?: string;
}

export interface RoundResult {
  model: string;
  role: string;
  text: string;
  error?: string;
}

export interface RoundOptions {
  priorSummary?: string;
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 4000;
const SECRET_REPLACEMENT = "[REDACTED]";

function isMessageEntry(entry: SessionEntry): entry is SessionMessageEntry {
  return entry.type === "message";
}

export async function runMultiModelRound(
  participants: Participant[],
  roundPrompt: string,
  mode: "debate" | "brainstorm",
  modelRegistry: ModelRegistry,
  authStorage: AuthStorage,
  signal: AbortSignal | undefined,
  options: RoundOptions = {},
): Promise<RoundResult[]> {
  if (signal?.aborted) {
    throw new Error("Aborted");
  }

  const uniqueParticipants = deduplicateParticipants(participants);
  for (const participant of uniqueParticipants) {
    validateModelSelector(participant.model);
  }

  const promises = uniqueParticipants.map(async (p): Promise<RoundResult> => {
    const result: RoundResult = { model: p.model, role: p.role, text: "" };
    try {
      const model = modelRegistry.find(...parseSelector(p.model));
      if (!model) {
        throw new Error(`Model not found: ${p.model}`);
      }

      const { session } = await createAgentSession({
        sessionManager: SessionManager.inMemory(),
        modelRegistry,
        authStorage,
        disableExtensionDiscovery: true,
        enableMCP: false,
        enableLsp: false,
        toolNames: [],
        skills: [],
        rules: [],
        contextFiles: [],
        promptTemplates: [],
        slashCommands: [],
        hasUI: false,
        autoApprove: false,
      });

      try {
        await session.setModel(model);
        const fullPrompt = buildParticipantPrompt(p, roundPrompt, mode, options.priorSummary);
        await session.prompt(fullPrompt, { expandPromptTemplates: false });

        if (signal?.aborted) {
          throw new Error("Aborted");
        }

        const entries = session.sessionManager.getEntries();
        let lastAssistant: AssistantMessage | undefined;
        for (let i = entries.length - 1; i >= 0; i--) {
          const entry = entries[i];
          if (isMessageEntry(entry) && entry.message.role === "assistant") {
            lastAssistant = entry.message as AssistantMessage;
            break;
          }
        }

        if (lastAssistant) {
          const msg = lastAssistant;
          if (msg.stopReason === "error" && msg.errorMessage) {
            throw new Error(msg.errorMessage);
          }
          result.text = truncateOutput(extractAssistantText(msg), options.maxChars ?? DEFAULT_MAX_CHARS);
        }
      } finally {
        await session.dispose();
      }
    } catch (err) {
      result.error = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
    }
    return result;
  });

  return Promise.all(promises);
}

export function buildParticipantPrompt(
  participant: Participant,
  roundPrompt: string,
  mode: "debate" | "brainstorm",
  priorSummary?: string,
): string {
  const userPrompt = participant.prompt ?? roundPrompt;
  const prior = priorSummary ? `\n\nPrior round synthesis:\n${priorSummary}` : "";
  return `You are an isolated participant in a multi-model ${mode} session. You have no tools, no file access, no skills, no external lookups, and no external capabilities. Answer the prompt below directly and concisely. Do not ask clarifying questions. Do not mention that you are an AI.\n\nRole: ${participant.role}${prior}\n\nPrompt:\n${userPrompt}`;
}

export function deduplicateParticipants(participants: Participant[]): Participant[] {
  const seen = new Set<string>();
  const deduped: Participant[] = [];
  for (const participant of participants) {
    if (seen.has(participant.model)) continue;
    seen.add(participant.model);
    deduped.push(participant);
  }
  return deduped;
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\b([A-Za-z0-9_]*key|token|secret|password|credential)(=|:)\s*([^\s"'`,;]+)/gi, `$1$2 ${SECRET_REPLACEMENT}`)
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|[A-Za-z0-9_-]{24,})\b/g, SECRET_REPLACEMENT);
}

export function validateModelSelector(selector: string): void {
  if (!/^[^\s/]+\/[^\s/]+$/.test(selector)) {
    throw new Error(`Invalid model selector: ${selector}`);
  }
}

function parseSelector(selector: string): [string, string] {
  validateModelSelector(selector);
  const slashIdx = selector.indexOf("/");
  return [selector.slice(0, slashIdx), selector.slice(slashIdx + 1)];
}
