const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const projectRoot = path.join(__dirname, '..');
const assetsDirectory = path.join(projectRoot, 'assets');
const masterIconFile = path.join(assetsDirectory, 'icon.svg');

// macOS renders the .icns artwork exactly as it is, so its tile follows Apple's grid: an 824x824 body centered on a 1024x1024 canvas.
// Windows and Linux scale and mask the artwork themselves and expect it to fill the canvas instead.
const macOsBodyRatio = 824 / 1024;

const renderCanvasSize = 1024;

// The names and sizes "iconutil" expects inside an .iconset folder
const iconSetEntries = [
	{ fileName: 'icon_16x16.png', size: 16 },
	{ fileName: 'icon_16x16@2x.png', size: 32 },
	{ fileName: 'icon_32x32.png', size: 32 },
	{ fileName: 'icon_32x32@2x.png', size: 64 },
	{ fileName: 'icon_128x128.png', size: 128 },
	{ fileName: 'icon_128x128@2x.png', size: 256 },
	{ fileName: 'icon_256x256.png', size: 256 },
	{ fileName: 'icon_256x256@2x.png', size: 512 },
	{ fileName: 'icon_512x512.png', size: 512 },
	{ fileName: 'icon_512x512@2x.png', size: 1024 }
];

const icoSizes = [ 16, 24, 32, 48, 64, 128, 256 ];
const linuxPngSize = 512;

const resizeTile = (tile, size) => {
	return tile.resize({
		width: size,
		height: size,
		quality: 'best'
	}).toPNG();
};

// Rasterizes the master SVG into the two tile variants. Both are laid out side by side and taken in one capture on purpose: a window
// serves exactly one load and one capture reliably, and a second window fails outright once the first has been used.
const renderTiles = async () => {
	const inset = Math.round((renderCanvasSize * (1 - macOsBodyRatio)) / 2);
	const bodySize = renderCanvasSize - (inset * 2);

	// The master is inlined rather than referenced, because a page loaded from a temporary folder should not depend on a sibling file
	const master = fs.readFileSync(masterIconFile, 'utf8');
	const markup = `<!doctype html>
		<html>
			<head>
				<meta charset="utf-8">
				<style>
					html, body { margin: 0; padding: 0; width: ${renderCanvasSize * 2}px; height: ${renderCanvasSize}px; background: transparent; overflow: hidden; }
					body { display: flex; }
					.tile { position: relative; width: ${renderCanvasSize}px; height: ${renderCanvasSize}px; flex: none; }
					.tile > * { position: absolute; display: block; }
					.full-bleed > * { left: 0; top: 0; width: ${renderCanvasSize}px; height: ${renderCanvasSize}px; }
					.mac-os > * { left: ${inset}px; top: ${inset}px; width: ${bodySize}px; height: ${bodySize}px; }
				</style>
			</head>
			<body>
				<div class="tile full-bleed">${master}</div>
				<div class="tile mac-os">${master}</div>
			</body>
		</html>`;

	// A fully transparent "backgroundColor" is what puts alpha in the capture. A "transparent" window would do it too, but it needs a
	// real display and fails when the build runs headless. Offscreen rendering keeps the canvas independent of the display size.
	const window = new BrowserWindow({
		width: renderCanvasSize * 2,
		height: renderCanvasSize,
		useContentSize: true,
		show: false,
		backgroundColor: '#00000000',
		webPreferences: {
			offscreen: true
		}
	});

	// Chromium refuses a top level navigation to a "data:" URL, so the page is written out and loaded from disk
	const pageDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'spiccioli-icon-page-'));
	const pageFile = path.join(pageDirectory, 'icon.html');
	fs.writeFileSync(pageFile, markup);

	try {
		await window.loadFile(pageFile);

		const capture = await window.webContents.capturePage();
		const captureSize = capture.getSize();

		// A capture comes back at the device scale factor, so a high density display renders larger than the canvas. Anything smaller
		// than the canvas, or off ratio, means the render was clamped and every size derived from it would be soft.
		if(captureSize.width !== captureSize.height * 2 || captureSize.height < renderCanvasSize) {
			throw new Error(`Expected a render of at least ${renderCanvasSize * 2}x${renderCanvasSize} at a 2:1 ratio but got ${captureSize.width}x${captureSize.height}`);
		}

		const tileSize = captureSize.width / 2;

		return {
			fullBleedTile: capture.crop({
				x: 0,
				y: 0,
				width: tileSize,
				height: captureSize.height
			}),
			macOsTile: capture.crop({
				x: tileSize,
				y: 0,
				width: tileSize,
				height: captureSize.height
			})
		};
	}
	finally {
		window.destroy();
		fs.rmSync(pageDirectory, {
			force: true,
			recursive: true
		});
	}
};

// Packs PNG payloads into an .ico container: a 6 byte header, one 16 byte directory entry per image, then the images themselves
const packIcoFile = (images) => {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);

	const directory = Buffer.alloc(16 * images.length);
	let imageOffset = header.length + directory.length;

	images.forEach(({ size, data }, index) => {
		const entry = index * 16;

		// A 256 pixel entry is written as 0, which is how the format encodes its largest size
		directory.writeUInt8(size >= 256 ? 0 : size, entry);
		directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
		directory.writeUInt8(0, entry + 2);
		directory.writeUInt8(0, entry + 3);
		directory.writeUInt16LE(1, entry + 4);
		directory.writeUInt16LE(32, entry + 6);
		directory.writeUInt32LE(data.length, entry + 8);
		directory.writeUInt32LE(imageOffset, entry + 12);

		imageOffset += data.length;
	});

	return Buffer.concat([ header, directory, ...images.map((image) => image.data) ]);
};

const writeIcnsFile = (macOsTile) => {
	if(process.platform !== 'darwin') {
		console.warn('Skipping icon.icns: "iconutil" only exists on macOS');
		return;
	}

	const iconSetParent = fs.mkdtempSync(path.join(os.tmpdir(), 'spiccioli-iconset-'));

	try {
		const iconSetDirectory = path.join(iconSetParent, 'icon.iconset');
		fs.mkdirSync(iconSetDirectory);

		for(const { fileName, size } of iconSetEntries) {
			fs.writeFileSync(path.join(iconSetDirectory, fileName), resizeTile(macOsTile, size));
		}

		execFileSync('iconutil', [ '--convert', 'icns', '--output', path.join(assetsDirectory, 'icon.icns'), iconSetDirectory ]);
	}
	finally {
		fs.rmSync(iconSetParent, {
			force: true,
			recursive: true
		});
	}
};

const buildIcons = async () => {
	const { fullBleedTile, macOsTile } = await renderTiles();

	writeIcnsFile(macOsTile);

	fs.writeFileSync(path.join(assetsDirectory, 'icon.ico'), packIcoFile(icoSizes.map((size) => ({
		size,
		data: resizeTile(fullBleedTile, size)
	}))));

	fs.writeFileSync(path.join(assetsDirectory, 'icon.png'), resizeTile(fullBleedTile, linuxPngSize));

	console.log(`Wrote icon.icns, icon.ico and icon.png to ${assetsDirectory}`);
};

app.whenReady().then(buildIcons).then(() => {
	app.exit(0);
}).catch((error) => {
	console.error(error);
	app.exit(1);
});
