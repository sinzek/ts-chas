import { defineConfig } from 'tsup';

export default defineConfig({
	entry: [
		'src/index.ts',
		'src/result.ts',
		'src/option.ts',
		'src/task.ts',
		'src/tagged-errs.ts',
		'src/guard.ts',
		'src/pipe.ts',
	],
	format: ['esm', 'cjs'],
	target: 'es2022',
	platform: 'node',
	tsconfig: 'tsconfig.build.json',
	dts: true,
	minify: false,
	sourcemap: true,
	clean: true,
});
