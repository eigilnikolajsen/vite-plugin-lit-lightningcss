# vite-plugin-css-literals-lightningcss

Vite plugin that transforms CSS template literals using Lightning CSS.

## Install

```bash
npm install --save-dev vite-plugin-css-literals-lightningcss
```

## Usage

In your vite.config.ts:

```typescript
import { defineConfig } from "vite";
import cssLiteralsLightningcss from "vite-plugin-css-literals-lightningcss";

export default defineConfig({
	plugins: [cssLiteralsLightningcss()],
});
```

In your components:

```typescript
const styles = css`
	.button {
		padding: 10px;
		background: ${props.color};
	}
`;
```

## Configuration

```typescript
cssLiteralsLightningcss({
	// Files to process (default: /src\/components\/.*\.(js|ts)$/)
	include: /src\/.*\.ts$/,

	// Files to ignore (default: undefined)
	exclude: /node_modules/,

	// Underlying Lightning CSS options (default: { minify: true })
	// See https://github.com/parcel-bundler/lightningcss#options
	lightningcss: {
		minify: true,
	},
});
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

This is free software under the GPL-3.0 license. See LICENSE file for details.

The code is copyleft - you can freely use and modify it, but any modifications must also be free software under the same terms.
