import type { ExtensionContext, Theme } from "@oh-my-pi/pi-coding-agent";
import type { Model } from "@oh-my-pi/pi-ai";
import { matchesKey } from "@oh-my-pi/pi-tui";
import type { KeybindingsManager } from "@oh-my-pi/pi-tui";

export interface ModelItem {
  value: string;
  label: string;
  description?: string;
}

export function buildModelItems(models: Model[], currentModel?: Model): ModelItem[] {
  return models.map((m) => {
    const selector = `${m.provider}/${m.id}`;
    const isCurrent = currentModel && `${currentModel.provider}/${currentModel.id}` === selector;
    return {
      value: selector,
      label: `${m.name}${isCurrent ? " (orchestrator)" : ""}`,
      description: `${m.provider} — ctx ${m.contextWindow}`,
    };
  });
}

export async function multiSelectModels(
  items: ModelItem[],
  preselected: Set<string>,
  ctx: ExtensionContext,
): Promise<string[] | null> {
  if (!ctx.hasUI) {
    return null;
  }

  const selectedIndices = new Set<number>();
  items.forEach((item, i) => {
    if (preselected.has(item.value)) selectedIndices.add(i);
  });

  try {
    return await ctx.ui.custom<string[] | null>(
      (_tui, theme, _keybindings, done) => {
        let cursor = 0;
        const maxVisible = Math.min(items.length, 10);
        const selected = new Set<number>(selectedIndices);

        return {
          render(_width: number): string[] {
            const lines: string[] = [];
            lines.push(theme.bold("Select participant models (Space toggles, Enter confirms, Esc cancels)"));
            lines.push(theme.fg("dim", "  Orchestrator: current model (not auto-selected)"));
            lines.push("");

            const start = Math.max(0, Math.min(cursor - maxVisible + 1, items.length - maxVisible));
            const end = Math.min(items.length, start + maxVisible);
            for (let i = start; i < end; i++) {
              const item = items[i];
              const isCursor = i === cursor;
              const isSelected = selected.has(i);
              const prefix = isSelected ? "[x]" : "[ ]";
              const cursorMarker = isCursor ? ">" : " ";
              const label = `${cursorMarker} ${prefix} ${item.label}`;
              const desc = item.description ? theme.fg("dim", ` — ${item.description}`) : "";
              lines.push(label + desc);
            }
            if (items.length > maxVisible) {
              lines.push(theme.fg("dim", `  (${start + 1}-${end} of ${items.length})`));
            }
            if (selected.size < 2) {
              lines.push("");
              lines.push(theme.fg("warning", "Select at least 2 models to proceed."));
            }
            return lines;
          },
          handleInput(key: string) {
            if (matchesKey(key, "up")) {
              cursor = cursor > 0 ? cursor - 1 : items.length - 1;
            } else if (matchesKey(key, "down")) {
              cursor = cursor < items.length - 1 ? cursor + 1 : 0;
            } else if (matchesKey(key, "space")) {
              if (selected.has(cursor)) selected.delete(cursor);
              else selected.add(cursor);
            } else if (matchesKey(key, "enter") || matchesKey(key, "return") || key === "\n") {
              if (selected.size >= 2) {
                done(Array.from(selected).map((i) => items[i].value));
              }
            } else if (matchesKey(key, "escape") || matchesKey(key, "ctrl+c")) {
              done(null);
            }
          },
          invalidate() {},
        };
      },
    );
  } catch {
    return null;
  }
}
