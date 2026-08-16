const path = require('node:path');

// The one description of how the Electron main and preload sources are bundled, shared by the one-shot build in "build-electron.js" and
// the watching development loop in "dev.js", so a development run never runs through a different bundle than the built one

const projectRoot = path.join(__dirname, '..');
const electronOutputDirectory = path.join(projectRoot, 'dist', 'electron');

const electronBundleOptions = {
	bundle: true,
	entryPoints: {
		main: path.join(projectRoot, 'src', 'main', 'Main.ts'),
		preload: path.join(projectRoot, 'src', 'main', 'preload', 'Preload.ts')
	},
	external: [
		'electron',
		'electron/main',
		'electron-log'
	],
	format: 'cjs',
	logLevel: 'info',
	outdir: electronOutputDirectory,
	platform: 'node',
	sourcemap: true,
	sourcesContent: false,
	target: 'node20',
	tsconfig: path.join(projectRoot, 'tsconfig.json')
};

module.exports = {
	projectRoot,
	electronOutputDirectory,
	electronBundleOptions
};
