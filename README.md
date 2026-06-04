# octo-pi

A Bun/TypeScript extension for Oh My Pi that adds multi-model debate and brainstorm workflows.

## What it does

`octo-pi` lets the orchestrator ask multiple selected models to answer the same prompt from different roles, then synthesize the result. It provides two commands:

- `/debate` — run a structured multi-model debate with opposing or complementary viewpoints.
- `/brainstorm` — run a structured multi-model ideation round with varied perspectives.

The extension also registers the tools used by the orchestrator during those workflows:

- `octopus_multi_model_round` — dispatches a prompt to participant models in parallel.
- `octopus_next_step` — asks whether to run another round or continue with the orchestrator's final answer.

## Usage

Run a debate:

```text
/debate Should we use Redis for session storage?
```

Run a brainstorm:

```text
/brainstorm How can we reduce support ticket volume?
```

Select models explicitly with `--models`:

```text
/debate --models openai/gpt-5,anthropic/claude-sonnet Should we use Redis?
```

If no `--models` flag is provided and the UI is available, the extension opens an interactive multi-select model picker. At least two models are required.

## Development

Install dependencies with Bun:

```sh
bun install
```

Run tests:

```sh
bun test
```

Run TypeScript checks:

```sh
bun run typecheck
```

## Project structure

```text
src/
  arguments.ts        Command argument and --models parsing
  main.ts             Extension registration, commands, and tools
  model-selection.ts  Interactive model multi-select UI
  prompts.ts          Orchestrator kickoff prompt contract
  subagents.ts        Participant model session execution
  text.ts             Text extraction and formatting helpers

tests/
  argument-parsing.test.ts
  model-selection.test.ts
  prompt-contract.test.ts
  text.test.ts
```

## Requirements

- Bun
- Oh My Pi coding agent packages compatible with `@oh-my-pi/pi-coding-agent` and `@oh-my-pi/pi-tui` `^15.8.0`

## Extension entrypoint

`package.json` exposes the extension through:

```json
{
  "omp": {
    "extensions": ["./src/main.ts"]
  }
}
```
