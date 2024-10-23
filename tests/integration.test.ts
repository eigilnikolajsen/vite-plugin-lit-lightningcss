import { describe, expect, it } from "vitest";
import litLightningcssPlugin from "../src";
import type { Plugin } from "vite";

describe("litLightningcssPlugin", () => {
	const plugin: Plugin = litLightningcssPlugin();
	const getResult = (input: string, id: string) =>
		typeof plugin.transform === "function"
			? plugin.transform.call(plugin, input, id)
			: null;

	it("should return null for non-matching files", () => {
		const result = getResult("const x = 1;", "file.js");
		expect(result).toBeNull();
	});

	it("should transform CSS literals in matching files", () => {
		const input = `
			const styles = css\`
				.container {
					display: flex;
					padding: 20px;
					background-color: #ffffff;
				}
			\`
		`;
		const result = getResult(input, "src/components/Button.ts");
		expect(result).not.toBeNull();
		expect(result?.code).toContain(".container");
		expect(result?.code).toContain("display:flex");
		// CSS should be minified
		expect(result?.code.length).toBeLessThan(input.length);
	});

	it("should handle multiple CSS literals in the same file", () => {
		const input = `
			const buttonStyles = css\`
				.button {
					padding: 10px;
					border: none;
				}
			\`
			
			const containerStyles = css\`
				.container {
					display: grid;
					gap: 20px;
				}
			\`
		`;
		const result = getResult(input, "src/components/Button.ts");
		expect(result).not.toBeNull();
		expect(result?.code).toContain(".button");
		expect(result?.code).toContain(".container");
	});

	it("should handle dynamic interpolations", () => {
		const input = `
			const color = 'blue';
			const styles = css\`
				\${injected}
				.button {
					color: blue;
					padding: 10px;
				}
			\`
		`;
		const result = getResult(input, "src/components/Button.ts");
		expect(result).not.toBeNull();
		expect(result?.code).toContain("${injected}");
		expect(result?.code).toContain("padding:10px");
	});

	it("should handle multiple dynamic interpolations", () => {
		const input = `
			const color = 'blue';
			const styles = css\`
				\${injected}
				.button {
					color: blue;
					padding: 10px;
				}
				\${injected2}
			\`
		`;
		const result = getResult(input, "src/components/Button.ts");
		expect(result).not.toBeNull();
		expect(result?.code).toContain("${injected}");
		expect(result?.code).toContain("${injected2}");
		expect(result?.code).toContain("padding:10px");
	});

	it("should skip invalid CSS content", () => {
		const input = `
			const notCss = css\`
				This is not valid CSS!
			\`
		`;
		const result = getResult(input, "src/components/Button.ts");
		expect(result).toBeNull();
	});

	it("should skip invalid dynamic interpolations", () => {
		const input = `
			const color = 'blue';
			const styles = css\`
				.button {
					color: \${color};
					padding: 10px;
				}
			\`
		`;
		const result = getResult(input, "src/components/Button.ts");
		expect(result).toBeNull();
	});
});
