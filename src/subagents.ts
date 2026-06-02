import { createAgentSession, SessionManager } from "@oh-my-pi/pi-coding-agent";
import type {
  AuthStorage,
  ModelRegistry,
  SessionEntry,
  SessionMessageEntry,
} from "@oh-my-pi/pi-coding-agent";
import type { AssistantMessage, Model } from "@oh-my-pi/pi-ai";
import { extractAssistantText } from "./text.js";

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
): Promise<RoundResult[]> {
  if (signal?.aborted) {
    throw new Error("Aborted");
  }

  const promises = participants.map(async (p): Promise<RoundResult> => {
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
        const userPrompt = p.prompt ?? roundPrompt;
        const fullPrompt = `You are an isolated participant in a multi-model ${mode} session. You have no tools, no file access, and no external capabilities. Answer the prompt below directly and concisely. Do not ask clarifying questions. Do not mention that you are an AI.\n\nRole: ${p.role}\n\n${userPrompt}`;
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
          result.text = extractAssistantText(msg);
        }
      } finally {
        await session.dispose();
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }
    return result;
  });

  return Promise.all(promises);
}

function parseSelector(selector: string): [string, string] {
  const slashIdx = selector.indexOf("/");
  if (slashIdx === -1) throw new Error(`Invalid model selector: ${selector}`);
  return [selector.slice(0, slashIdx), selector.slice(slashIdx + 1)];
}
