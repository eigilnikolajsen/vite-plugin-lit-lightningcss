import { type FilterPattern, createFilter } from "@rollup/pluginutils";
import {
	type CustomAtRules,
	type TransformOptions,
	transform,
} from "lightningcss";
import MagicString from "magic-string";
import type { Plugin, TransformResult } from "vite";
import { Buffer } from "node:buffer";

/**
 * Options for the LitCSS Plugin.
 * @interface LitCSSPluginOptions
 * @property {FilterPattern} [include] - Glob pattern(s) to include files for processing.
 * @property {FilterPattern} [exclude] - Glob pattern(s) to exclude files from processing.
 * @property {Partial<TransformOptions<CustomAtRules>>} [lightningcss] - Options for Lightning CSS transformation.
 */
interface LitCSSPluginOptions {
	include?: FilterPattern;
	exclude?: FilterPattern;
	lightningcss?: Partial<TransformOptions<CustomAtRules>>;
}

const defaultOptions: LitCSSPluginOptions = {
	lightningcss: {
		minify: true,
	},
};

// Updated regex to be more precise about matching CSS template literals
// It looks for css` that's either at the start of a line or after typical separators
const CSS_LITERAL_REGEX = /(?:^|[(\s=:,])css`([^`]*(?:\${[^}]*}[^`]*)*)`/g;

// Regex to split CSS content into static and dynamic parts
const INTERPOLATION_REGEX = /(\${[^}]*})/g;

/**
 * Represents a processed part of a CSS literal.
 * @interface ProcessedPart
 * @property {'static' | 'dynamic'} type - The type of the processed part.
 * @property {string} content - The content of the processed part.
 * @property {number} start - The starting index of the part in the original string.
 * @property {number} end - The ending index of the part in the original string.
 */
interface ProcessedPart {
	type: "static" | "dynamic";
	content: string;
	start: number;
	end: number;
}

/**
 * Processes a CSS literal string and splits it into static and dynamic parts.
 * @param {string} literal - The full CSS literal match.
 * @param {string} fullMatch - The full match including any preceding characters.
 * @param {number} matchIndex - The index where the full match starts in the original input.
 * @returns {ProcessedPart[]} An array of processed parts.
 */
function processCSSLiteral(
	literal: string,
	fullMatch: string,
	matchIndex: number
): ProcessedPart[] {
	const parts: ProcessedPart[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null = null;

	// Find where the actual css` part starts within the full match
	const cssStart = fullMatch.indexOf("css`");
	// Remove the css` prefix and trailing `
	const content = fullMatch.slice(cssStart + 4, -1);
	// Adjust offset to account for the actual start of the css` part
	const offset = matchIndex + cssStart + 4;

	while (true) {
		match = INTERPOLATION_REGEX.exec(content);
		if (!match) break;

		if (match.index > lastIndex) {
			// Add static content before interpolation
			parts.push({
				type: "static",
				content: content.slice(lastIndex, match.index),
				start: offset + lastIndex,
				end: offset + match.index,
			});
		}

		// Add interpolated content
		parts.push({
			type: "dynamic",
			content: match[0],
			start: offset + match.index,
			end: offset + match.index + match[0].length,
		});

		lastIndex = match.index + match[0].length;
	}

	// Add remaining static content after last interpolation
	if (lastIndex < content.length) {
		parts.push({
			type: "static",
			content: content.slice(lastIndex),
			start: offset + lastIndex,
			end: offset + content.length,
		});
	}

	return parts;
}

/**
 * Checks if a given string is likely to be valid CSS.
 * @param {string} css - The CSS string to validate.
 * @returns {boolean} True if the string appears to be valid CSS, false otherwise.
 */
export function isValidCSS(css: string): boolean {
	// Simple validation to check if the content looks like CSS
	// This helps prevent processing of non-CSS template literals
	const trimmed = css.trim();
	if (!trimmed) return false;

	// Check if it contains common CSS patterns
	// This is a basic check - you might want to make it more sophisticated
	return (
		trimmed.includes("{") &&
		trimmed.includes("}") &&
		/[.#]?\w+\s*{/.test(trimmed)
	);
}

/**
 * Creates a Vite plugin that transforms CSS literals using Lightning CSS.
 * @param {LitCSSPluginOptions} [options=defaultOptions] - Plugin options.
 * @returns {Plugin} A Vite plugin object.
 */
export default function litLightningcss(
	options: LitCSSPluginOptions = defaultOptions
): Plugin {
	const filter = createFilter(options.include, options.exclude);

	return {
		name: "vite-plugin-lit-lightningcss",
		transform(input: string, filename: string): TransformResult | null {
			if (!filter(filename)) return null;

			const ms = new MagicString(input);
			let hasChanges = false;
			let match: RegExpExecArray | null = null;

			// Reset regex state
			CSS_LITERAL_REGEX.lastIndex = 0;

			while (true) {
				match = CSS_LITERAL_REGEX.exec(input);
				if (!match) break;

				const [fullMatch] = match;
				const parts = processCSSLiteral(fullMatch, fullMatch, match.index);

				let processedCSS = "css`";
				for (const part of parts) {
					if (part.type === "static" && part.content.trim()) {
						if (!isValidCSS(part.content)) {
							processedCSS += part.content;
							continue;
						}

						const lightningcssOptions = {
							filename,
							code: Buffer.from(part.content) as unknown as Uint8Array,
							sourceMap: false,
							...options.lightningcss,
						} satisfies TransformOptions<CustomAtRules>;

						try {
							const result = transform(lightningcssOptions);
							processedCSS += result.code.toString();
							hasChanges = true;
						} catch (error) {
							console.warn(
								`Warning: Failed to transform CSS at ${filename}:${part.start}-${part.end}`,
								`Content: "${part.content.slice(0, 50)}${
									part.content.length > 50 ? "..." : ""
								}"`,
								error
							);
							return null;
						}
					} else {
						processedCSS += part.content;
					}
				}
				processedCSS += "`";

				ms.overwrite(match.index, match.index + fullMatch.length, processedCSS);
			}

			if (!hasChanges) return null;

			return {
				code: ms.toString(),
				map: ms.generateMap({ hires: true }),
			};
		},
	};
}
