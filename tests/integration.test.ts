import { describe, expect, it } from "vitest";
import cssLiteralsLightningcssPlugin from "../src";

describe("cssLiteralsLightningcssPlugin", () => {
	const plugin = cssLiteralsLightningcssPlugin();
	it("should return null for non-matching files", () => {
		const result = plugin.transform?.call(plugin, "const x = 1;", "file.js");
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
		const result = plugin.transform?.call(
			plugin,
			input,
			"src/components/Button.ts",
		);
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
		const result = plugin.transform?.call(
			plugin,
			input,
			"src/components/Button.ts",
		);
		expect(result).not.toBeNull();
		expect(result?.code).toContain(".button");
		expect(result?.code).toContain(".container");
	});

	it("should handle dynamic interpolations", () => {
		const input = `
      const color = 'blue';
      const styles = css\`
        .button {
          color: \${color};
          padding: 10px;
        }
      \`
    `;
		const result = plugin.transform?.call(
			plugin,
			input,
			"src/components/Button.ts",
		);
		expect(result).not.toBeNull();
		expect(result?.code).toContain("${color}");
		expect(result?.code).toContain("padding:10px");
	});

	it("should skip invalid CSS content", () => {
		const input = `
      const notCss = css\`
        This is not valid CSS!
      \`
    `;
		const result = plugin.transform?.call(
			plugin,
			input,
			"src/components/Button.ts",
		);
		expect(result).toBeNull();
	});
});
