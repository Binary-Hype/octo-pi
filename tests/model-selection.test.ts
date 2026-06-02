import { describe, expect, it } from "bun:test";
import { multiSelectModels, type ModelItem } from "../src/model-selection";
import type { ExtensionContext, Theme } from "@oh-my-pi/pi-coding-agent";
import { KeybindingsManager } from "@oh-my-pi/pi-tui";
import type { Component } from "@oh-my-pi/pi-tui";

interface MinimalTheme {
	bold(text: string): string;
	fg(color: string, text: string): string;
}

function createStubTheme(): Theme {
	const stub: MinimalTheme = {
		bold: (text: string) => text,
		fg: (_color: string, text: string) => text,
	};
	// Library boundary: we only need the two methods the selector calls.
	return stub as unknown as Theme;
}

interface Capture {
	component: Component | null;
	resolve: ((value: string[] | null) => void) | null;
}

function createStubContext(capture: Capture): ExtensionContext {
	const theme = createStubTheme();
	const keybindings = new KeybindingsManager({});

	return {
		hasUI: true,
		ui: {
			custom: async <T>(
				factory: (
					tui: unknown,
					theme: Theme,
					keybindings: KeybindingsManager,
					done: (result: T) => void,
				) => unknown,
			) => {
				const { promise, resolve } = Promise.withResolvers<T>();
				capture.resolve = (value) => {
					resolve(value as T);
				};
				const component = factory(null as unknown, theme, keybindings, (result) => {
					resolve(result);
				});
				capture.component = component as unknown as Component;
				return promise;
			},
		},
	} as unknown as ExtensionContext;
}

describe("multiSelectModels", () => {
	const items: ModelItem[] = [
		{ value: "a/b", label: "Model A" },
		{ value: "c/d", label: "Model B" },
		{ value: "e/f", label: "Model C" },
	];

	it("toggles models with space and confirms with enter", async () => {
		const capture: Capture = { component: null, resolve: null };
		const ctx = createStubContext(capture);
		const promise = multiSelectModels(items, new Set(), ctx);

		expect(capture.component).not.toBeNull();
		capture.component!.handleInput!(" ");
		capture.component!.handleInput!("\x1b[B");
		capture.component!.handleInput!(" ");
		capture.component!.handleInput!("\r");

		const result = await promise;
		expect(result).toEqual(["a/b", "c/d"]);
	});

	it("moves cursor with arrow down before toggling", async () => {
		const capture: Capture = { component: null, resolve: null };
		const ctx = createStubContext(capture);
		const promise = multiSelectModels(items, new Set(), ctx);

		capture.component!.handleInput!("\x1b[B");
		capture.component!.handleInput!("\x1b[B");
		capture.component!.handleInput!(" ");
		capture.component!.handleInput!("\x1b[A");
		capture.component!.handleInput!(" ");
		capture.component!.handleInput!("\n");

		const result = await promise;
		expect(result).toEqual(["e/f", "c/d"]);
	});

	it("cancels with escape and resolves null", async () => {
		const capture: Capture = { component: null, resolve: null };
		const ctx = createStubContext(capture);
		const promise = multiSelectModels(items, new Set(), ctx);

		capture.component!.handleInput!("\x1b");
		const result = await promise;
		expect(result).toBeNull();
	});

	it("cancels with ctrl+c and resolves null", async () => {
		const capture: Capture = { component: null, resolve: null };
		const ctx = createStubContext(capture);
		const promise = multiSelectModels(items, new Set(), ctx);

		capture.component!.handleInput!("\x03");
		const result = await promise;
		expect(result).toBeNull();
	});

	it("does not resolve on enter with fewer than two selected models", async () => {
		const capture: Capture = { component: null, resolve: null };
		const ctx = createStubContext(capture);
		const promise = multiSelectModels(items, new Set(), ctx);

		capture.component!.handleInput!(" ");
		capture.component!.handleInput!("\r");

		const { promise: timeout, resolve } = Promise.withResolvers<string[] | null | "timeout">();
		setTimeout(() => resolve("timeout"), 50);
		const result = await Promise.race([promise, timeout]);
		expect(result).toBe("timeout");

		// Clean up the dangling promise.
		capture.component!.handleInput!("\x03");
		await promise;
	});
});
