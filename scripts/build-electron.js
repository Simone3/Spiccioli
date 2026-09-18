const esbuild = require('esbuild');
const fs = require('node:fs');
const { copyPdfWorker, electronBundleOptions, electronOutputDirectory } = require('./electron-bundle');

fs.rmSync(electronOutputDirectory, {
	force: true,
	recursive: true
});

esbuild.build(electronBundleOptions).then(copyPdfWorker).catch((error) => {
	console.error(error);
	process.exit(1);
});
