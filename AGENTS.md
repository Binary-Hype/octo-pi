# AGENTS.md

## Project overview

`octo-pi` is a Bun/TypeScript Oh My Pi extension that adds multi-model debate, brainstorm, and sourced research workflows.

The extension registers:
- `/debate`, `/brainstorm`, and `/research` commands in `src/main.ts`
- `octopus_multi_model_round`, `octopus_research_round`, and `octopus_next_step` tools in `src/main.ts`

Core modules:
- `src/arguments.ts` parses command arguments, `--models` selectors, and research breadth/intensity flags.
- `src/model-selection.ts` builds and renders the interactive model multi-select UI.
- `src/prompts.ts` builds the orchestrator prompt contracts.
- `src/subagents.ts` runs participant model sessions concurrently and returns per-model results, including read-only sourced research sessions.
- `src/text.ts` contains small formatting and text extraction helpers.

## Tooling

Use Bun for all project commands:

```sh
bun test
bun run typecheck
```

The project is strict TypeScript, ESM (`"type": "module"`), and uses bundler module resolution. Source imports include `.js` extensions for local runtime imports from `src/`.

## Development rules

- Keep behavior covered by tests in `tests/` when changing parsing, prompts, model selection, or text formatting.
- Prefer small, direct functions over new abstractions; this extension is compact and should stay easy to audit.
- Preserve the orchestrator/tool contract in `src/prompts.ts` and `src/main.ts` together. If a tool schema changes, update the prompt contract and tests in the same change.
- Do not add fallback/mock participant behavior. `runMultiModelRound` and `runResearchRound` should report real model errors in `RoundResult.error`.
- Avoid unnecessary allocations in hot/simple helpers; return existing strings or arrays where practical.
- Do not reorder or restyle files by hand. Let the existing formatting style stand unless a formatter is deliberately introduced.

## Verification expectations

Before yielding after code changes, run the narrowest relevant checks:

- Argument parsing changes: `bun test tests/argument-parsing.test.ts`
- Prompt contract changes: `bun test tests/prompt-contract.test.ts`
- Model selector UI changes: `bun test tests/model-selection.test.ts`
- Text helper changes: `bun test tests/text.test.ts`
- Cross-cutting TypeScript/API changes: `bun run typecheck` plus relevant tests

Run `bun test` when a change crosses module boundaries or affects command/tool behavior end-to-end.
