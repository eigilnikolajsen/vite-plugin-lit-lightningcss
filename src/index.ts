import { type FilterPattern, createFilter } from "@rollup/pluginutils";
import {
	type CustomAtRules,
	type TransformOptions,
	transform,
} from "lightningcss";
import MagicString from "magic-string";
import type { Plugin, TransformResult } from "vite";

interface LitCSSPluginOptions {
	include?: FilterPattern;
	exclude?: FilterPattern;
	lightningcss?: Partial<TransformOptions<CustomAtRules>>;
}

const defaultOptions: LitCSSPluginOptions = {
	include: /src\/components\/.*\.(js|ts)$/,
	lightningcss: {
		minify: true,
	},
};

// Updated regex to be more precise about matching CSS template literals
// It looks for css` that's either at the start of a line or after typical separators
const CSS_LITERAL_REGEX = /(?:^|[(\s=:,])css`([^`]*(?:\${[^}]*}[^`]*)*)`/g;

// Regex to split CSS content into static and dynamic parts
const INTERPOLATION_REGEX = /(\${[^}]*})/g;

interface ProcessedPart {
	type: "static" | "dynamic";
	content: string;
	start: number;
	end: number;
}

function processCSSLiteral(
	literal: string,
	fullMatch: string,
	matchIndex: number,
): ProcessedPart[] {
	const parts: ProcessedPart[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null = null;

	// Find where the actual css` part starts within the full match
	const cssStart = literal.indexOf("css`");
	// Remove the css` prefix and trailing `
	const content = literal.slice(cssStart + 4, -1);
	// Adjust offset to account for the actual start of the css` part
	const offset = matchIndex + cssStart + 4;

	while (true) {
		match = INTERPOLATION_REGEX.exec(content);
		if (match === null) break;

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

export default function cssLiteralsLightningcssPlugin(
	options = defaultOptions,
) {
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
				if (match === null) break;

				const [fullMatch, content] = match;
				const parts = processCSSLiteral(fullMatch, fullMatch, match.index);

				// Transform static parts with Lightning CSS
				for (const part of parts) {
					if (part.type === "static" && part.content.trim()) {
						// Only process content that looks like valid CSS
						if (!isValidCSS(part.content)) {
							continue;
						}

						const lightningcssOptions = {
							filename,
							code: Buffer.from(part.content),
							sourceMap: false,
							...options.lightningcss,
						} satisfies TransformOptions<CustomAtRules>;

						try {
							const result = transform(lightningcssOptions);

							ms.overwrite(part.start, part.end, result.code.toString());
							hasChanges = true;
						} catch (error) {
							// More graceful error handling - log but don't throw
							console.warn(
								`Warning: Failed to transform CSS at ${filename}:${part.start}-${part.end}`,
								`Content: "${part.content.slice(0, 50)}${
									part.content.length > 50 ? "..." : ""
								}"`,
								error,
							);
						}
					}
				}
			}

			if (!hasChanges) return null;

			return {
				code: ms.toString(),
				map: ms.generateMap({ hires: true }),
			};
		},
	} satisfies Plugin;
}
