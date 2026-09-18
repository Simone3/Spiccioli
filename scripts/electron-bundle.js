const fs = require('node:fs');
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

// The PDF library reads a document in a worker of its own, which it loads by importing a file it expects to find beside the bundle that
// pulled it in. esbuild bundles the library itself and knows nothing about that import, so the worker is copied next to the main bundle —
// without it, the first payslip anybody tried to import would fail on a file that was never there.
const PDF_WORKER_SOURCE = path.join(projectRoot, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');

const PDF_WORKER_FILE_NAME = 'pdf.worker.mjs';

const copyPdfWorker = () => {
	fs.mkdirSync(electronOutputDirectory, { recursive: true });
	fs.copyFileSync(PDF_WORKER_SOURCE, path.join(electronOutputDirectory, PDF_WORKER_FILE_NAME));
};

module.exports = {
	projectRoot,
	electronOutputDirectory,
	electronBundleOptions,
	copyPdfWorker
};
