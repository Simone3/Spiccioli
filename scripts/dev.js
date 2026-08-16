const { spawn } = require('node:child_process');
const { once } = require('node:events');
const esbuild = require('esbuild');
const electronExecutablePath = require('electron');
const { electronBundleOptions, projectRoot } = require('./electron-bundle');

// The development loop: the renderer is served by a Vite development server, so editing a component hot-reloads it in place, and the
// Electron main and preload sources are rebuilt by a watching esbuild that relaunches Electron whenever they change. This is what
// "npm start" runs, while "npm run start-packaged" builds everything once and starts the application the way a packaged one starts.

// Must match WINDOW_CONFIG.developmentServerUrlVariable in "src/config/AppConfig.ts", which is TypeScript this plain Node script cannot read
const DEVELOPMENT_SERVER_URL_VARIABLE = 'SPICCIOLI_DEVELOPMENT_SERVER_URL';

// How long a relaunch waits for the running Electron process to go away before it stops being polite about it
const ELECTRON_EXIT_TIMEOUT_MS = 5000;

let developmentServerUrl;
let viteServer;
let esbuildContext;

// Undefined while no Electron process is running, which is also how the exit handler tells a relaunch from the user closing the application
let electronProcess;

// Rebuilds can arrive while a relaunch is still stopping the previous process, and two of them must never spawn Electron at the same time:
// the second process would fail the single instance lock and quit immediately
let relaunchChain = Promise.resolve();

let isShuttingDown = false;

const startElectron = () => {
	const child = spawn(electronExecutablePath, [ projectRoot ], {
		stdio: 'inherit',
		env: {
			...process.env,
			[DEVELOPMENT_SERVER_URL_VARIABLE]: developmentServerUrl
		}
	});

	electronProcess = child;

	child.on('exit', (code) => {
		// A relaunch clears the reference before killing the process, so this is the application going away on its own
		if(electronProcess === child) {
			electronProcess = undefined;
			void shutDown(code ?? 0);
		}
	});
};

const stopElectron = async () => {
	const child = electronProcess;

	if(!child) {
		return;
	}

	electronProcess = undefined;
	child.kill();

	const exited = once(child, 'exit');
	const timeout = new Promise((resolve) => {
		setTimeout(resolve, ELECTRON_EXIT_TIMEOUT_MS).unref();
	});

	await Promise.race([ exited, timeout ]);

	// The single instance lock makes a process that will not go away a hard stop for the next launch, so it is killed outright
	if(child.exitCode === null && child.signalCode === null) {
		child.kill('SIGKILL');
		await exited;
	}
};

const relaunchElectron = () => {
	relaunchChain = relaunchChain.then(async() => {
		if(isShuttingDown) {
			return;
		}

		await stopElectron();

		if(!isShuttingDown) {
			startElectron();
		}
	}).catch((error) => {
		console.error(error);
	});

	return relaunchChain;
};

// Relaunches Electron after every rebuild of the main or preload bundle, including the first one that starts it. A build that failed keeps
// the running process alive: relaunching into a bundle that does not exist would only replace the error with a second one.
const relaunchOnRebuild = {
	name: 'spiccioli-relaunch-electron',
	setup: (build) => {
		build.onEnd((result) => {
			if(result.errors.length > 0) {
				console.error('The Electron bundle failed to build, so the running application was left alone');
				return;
			}

			void relaunchElectron();
		});
	}
};

const shutDown = async(exitCode) => {
	if(isShuttingDown) {
		return;
	}

	isShuttingDown = true;

	await stopElectron();
	await esbuildContext?.dispose();
	await viteServer?.close();

	process.exit(exitCode);
};

const startDevelopmentLoop = async() => {
	// Vite is an ES module and this script is CommonJS, like the other build scripts
	const { createServer } = await import('vite');

	viteServer = await createServer({ mode: 'development' });
	await viteServer.listen();
	viteServer.printUrls();

	developmentServerUrl = viteServer.resolvedUrls?.local[0];

	if(!developmentServerUrl) {
		throw new Error('The Vite development server reported no local URL to load the renderer from');
	}

	// Watching triggers the first build itself, and that build is what starts Electron
	esbuildContext = await esbuild.context({
		...electronBundleOptions,
		plugins: [ relaunchOnRebuild ]
	});

	await esbuildContext.watch();
};

for(const signal of [ 'SIGINT', 'SIGTERM' ]) {
	process.on(signal, () => {
		void shutDown(0);
	});
}

startDevelopmentLoop().catch((error) => {
	console.error(error);
	void shutDown(1);
});
