import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	target: 'es2022',
	platform: 'node',
	tsconfig: 'tsconfig.build.json',
	dts: true,
	minify: false,
	sourcemap: true,
	clean: true,
});
