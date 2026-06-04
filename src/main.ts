import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import type { ExtensionCommandContext } from "@oh-my-pi/pi-coding-agent";
import { parseCommandArgs } from "./arguments.js";
import { buildModelItems, multiSelectModels } from "./model-selection.js";
import { parseModelsFlag } from "./arguments.js";
import { orchestratorKickoffPrompt } from "./prompts.js";
import { runMultiModelRound } from "./subagents.js";

interface SessionMetadata {
  selectedModels: string[];
  maxRounds: number;
  lastRound: number;
}

const sessionMetadata = new Map<string, SessionMetadata>();

export default function (pi: ExtensionAPI) {
  const { z } = pi.zod;

  pi.registerCommand("debate", {
    description: "Run a multi-model debate",
    handler: async (args, ctx: ExtensionCommandContext) => {
      await ctx.waitForIdle();
      await handleCommand("debate", args, ctx, pi);
    },
  });

  pi.registerCommand("brainstorm", {
    description: "Run a multi-model brainstorm",
    handler: async (args, ctx: ExtensionCommandContext) => {
      await ctx.waitForIdle();
      await handleCommand("brainstorm", args, ctx, pi);
    },
  });

  pi.registerTool({
    name: "octopus_multi_model_round",
    label: "Octopus Multi-Model Round",
    description:
      "Dispatch a round prompt to selected participant models in parallel and collect their responses. Each participant receives the shared roundPrompt plus an optional individual prompt override. Use this to run a multi-model debate or brainstorm round.",
    parameters: z.object({
      mode: z.enum(["debate", "brainstorm"] as const),
      topic: z.string(),
      round: z.number().int().min(1),
      participants: z.array(
        z.object({
          model: z.string(),
          role: z.string(),
          prompt: z.string().optional(),
        }),
      ),
      roundPrompt: z.string(),
      priorSummary: z.string().optional(),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      onUpdate?.({ content: [{ type: "text", text: "Dispatching to participant models..." }] });

      const sessionId = ctx.sessionManager.getSessionId();
      const stored = sessionMetadata.get(sessionId);
      const selectors = params.participants.map((p) => p.model);
      if (stored) {
        if (params.round > stored.maxRounds) {
          throw new Error(
            `Round ${params.round} exceeds the configured limit of ${stored.maxRounds}. Continue with the orchestrator.`,
          );
        }
        for (const sel of selectors) {
          if (!stored.selectedModels.includes(sel)) {
            throw new Error(
              `Model ${sel} was not selected for this session. Available: ${stored.selectedModels.join(", ")}`,
            );
          }
        }
        stored.lastRound = Math.max(stored.lastRound, params.round);
      }

      const results = await runMultiModelRound(
        params.participants,
        params.roundPrompt,
        params.mode,
        ctx.modelRegistry,
        ctx.modelRegistry.authStorage,
        signal,
        { priorSummary: params.priorSummary },
      );

      const lines: string[] = [];
      for (const r of results) {
        lines.push(`### ${r.model} — ${r.role}`);
        if (r.error) {
          lines.push(`Error: ${r.error}`);
        } else {
          lines.push(r.text);
        }
        lines.push("");
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { results },
      };
    },
  });

  pi.registerTool({
    name: "octopus_next_step",
    label: "Octopus Next Step",
    description:
      'After synthesizing a multi-model round, ask the user whether to run another round or continue with the orchestrator. Returns either the selected models for the next round or "continue_orchestrator".',
    parameters: z.object({
      mode: z.enum(["debate", "brainstorm"] as const),
      summary: z.string(),
      recommendedNextPrompt: z.string().optional(),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        const sessionId = ctx.sessionManager.getSessionId();
        sessionMetadata.delete(sessionId);
        return {
          content: [{ type: "text", text: "continue_orchestrator" }],
          details: { action: "continue_orchestrator" },
        };
      }

      const prompt = params.recommendedNextPrompt
        ? `Run another multi-model round?\n\nRecommended next prompt:\n${params.recommendedNextPrompt}`
        : "Run another multi-model round?";
      const choice = await ctx.ui.select(prompt, [
        "Another round with multiple models",
        "Continue only with orchestrator",
      ]);

      if (choice === "Another round with multiple models") {
        const sessionId = ctx.sessionManager.getSessionId();
        const stored = sessionMetadata.get(sessionId);
        if (stored && stored.lastRound >= stored.maxRounds) {
          sessionMetadata.delete(sessionId);
          return {
            content: [{ type: "text", text: "continue_orchestrator" }],
            details: { action: "continue_orchestrator" },
          };
        }
        const available = ctx.modelRegistry.getAvailable();
        const items = buildModelItems(available, ctx.model);
        const selected = await multiSelectModels(items, new Set(stored?.selectedModels ?? []), ctx);
        if (!selected || selected.length < 2) {
          sessionMetadata.delete(sessionId);
          return {
            content: [{ type: "text", text: "continue_orchestrator" }],
            details: { action: "continue_orchestrator" },
          };
        }
        sessionMetadata.set(sessionId, {
          selectedModels: selected,
          maxRounds: stored?.maxRounds ?? 3,
          lastRound: stored?.lastRound ?? 0,
        });
        return {
          content: [
            { type: "text", text: `Selected models for next round: ${selected.join(", ")}` },
          ],
          details: { action: "another_round", selectedModels: selected },
        };
      }

      const sessionId = ctx.sessionManager.getSessionId();
      sessionMetadata.delete(sessionId);
      return {
        content: [{ type: "text", text: "continue_orchestrator" }],
        details: { action: "continue_orchestrator" },
      };
    },
  });
}

async function handleCommand(
  mode: "debate" | "brainstorm",
  args: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
) {
  const { topic, modelsFlag, maxRounds } = parseCommandArgs(args);

  let actualTopic = topic;
  if (!actualTopic) {
    if (ctx.hasUI) {
      actualTopic = await ctx.ui.input(
        `${mode === "debate" ? "Debate" : "Brainstorm"} topic:`,
        "Enter topic",
      );
    }
    if (!actualTopic) {
      ctx.ui.notify(`Usage: /${mode} [--models provider/model,provider/model] <topic>`, "warning");
      return;
    }
  }

  const available = ctx.modelRegistry.getAvailable();
  if (available.length < 2) {
    ctx.ui.notify("Need at least 2 available models.", "error");
    return;
  }

  let selected: string[] | null;
  if (modelsFlag) {
    selected = parseModelsFlag(modelsFlag);
  } else if (ctx.hasUI) {
    const items = buildModelItems(available, ctx.model);
    selected = await multiSelectModels(items, new Set(), ctx);
  } else {
    ctx.ui.notify(`Usage: /${mode} [--models provider/model,provider/model] <topic>`, "warning");
    return;
  }

  if (!selected || selected.length < 2) {
    ctx.ui.notify("Need at least 2 participant models.", "warning");
    return;
  }

  const sessionId = ctx.sessionManager.getSessionId();
  sessionMetadata.set(sessionId, { selectedModels: selected, maxRounds, lastRound: 0 });

  const prompt = orchestratorKickoffPrompt({
    mode,
    topic: actualTopic,
    selectedModels: selected,
    maxRounds,
  });
  pi.sendUserMessage(prompt);
}
