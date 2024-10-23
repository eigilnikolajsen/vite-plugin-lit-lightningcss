import { describe, it, expect } from "vitest";
import { isValidCSS } from "../src/index";

describe("Utility Functions", () => {
	describe("isValidCSS", () => {
		it("should return true for valid CSS", () => {
			const validCases = [
				"css`.class { color: red; }`",
				"css` #id { margin: 0; }`",
				"css`.multiple { color: red; } .classes { margin: 0; }`",
				"css`element { padding: 10px; }`",
			];

			for (const css of validCases) {
				expect(isValidCSS(css)).toBe(true);
			}
		});

		it("should return false for invalid CSS", () => {
			const invalidCases = [
				"css``",
				"css` `",
				"css`not css at all`",
				"css`{ invalid: true }`",
				"css`class without dot { color: red; }`",
			];

			for (const css of invalidCases) {
				expect(isValidCSS(css)).toBe(false);
			}
		});
	});
});
