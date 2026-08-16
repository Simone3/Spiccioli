// What Spiccioli can say about the build it is running as. The main process is the only side that knows it, so the renderer asks for it.
export interface SpiccioliAppInfo {

	// The version Electron reports for the running application, which is the "version" field of "package.json"
	version: string;

	// The operating system family the build is running on, as Node names it
	platform: string;
}

export interface SpiccioliAppInfoApi {
	getAppInfo: () => Promise<SpiccioliAppInfo>;
}
