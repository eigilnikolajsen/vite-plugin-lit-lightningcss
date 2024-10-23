import fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { describe, expect, it } from "vitest";
import litLightningcssPlugin from "../src";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Vite Integration", () => {
	it("should work in a Vite dev server", async () => {
		// Create a temporary test file
		const testDir = join(__dirname, "temp");
		const testFile = join(testDir, "test.ts");

		await fs.mkdir(testDir, { recursive: true });
		await fs.writeFile(
			testFile,
			`const styles = css\`
				.test {
					display: flex;
					padding: 1rem;
					background-color: #ffffff;
				}
			\``
		);

		// Create Vite server
		const server = await createServer({
			configFile: false,
			root: testDir,
			plugins: [litLightningcssPlugin()],
		});

		try {
			// Transform the file
			const result = await server.transformRequest(testFile);

			expect(result).not.toBeNull();
			expect(result?.code).toContain(".test");
			expect(result?.code).toContain("display:flex");
			// CSS should be minified
			expect(result?.code).toContain("padding:1rem");
		} finally {
			await server.close();
			await fs.rm(testDir, { recursive: true, force: true });
		}
	});

	it("should handle errors gracefully", async () => {
		const testDir = join(__dirname, "temp");
		const testFile = join(testDir, "invalid.ts");

		await fs.mkdir(testDir, { recursive: true });
		await fs.writeFile(
			testFile,
			`const styles = css\`
				.test {
					display: invalid-value;
				}
			\``
		);

		const server = await createServer({
			configFile: false,
			root: testDir,
			plugins: [litLightningcssPlugin()],
		});

		try {
			const result = await server.transformRequest(testFile);
			// Should not throw but should maintain original content
			expect(result).not.toBeNull();
			expect(result?.code).toContain("invalid-value");
		} finally {
			await server.close();
			await fs.rm(testDir, { recursive: true, force: true });
		}
	});
});
