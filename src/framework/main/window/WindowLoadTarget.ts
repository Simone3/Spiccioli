import path from 'node:path';

// The renderer either comes from the built file on disk, which is what a packaged run always does, or from a development server that
// serves it over HTTP and hot-reloads it while the sources change
export type WindowLoadTarget = {
	type: 'file';
	value: string;
} | {
	type: 'url';
	value: string;
};

export interface ResolveWindowLoadTargetOptions {
	appRootDirectory: string;

	// Where the built renderer entry file sits inside the application root, as path segments
	rendererIndexPathSegments: readonly string[];

	// The development server serving the renderer, when one is running. Anything else, including an empty string, loads the built file.
	developmentServerUrl?: string | undefined;
}

export const resolveWindowLoadTarget = ({
	appRootDirectory,
	rendererIndexPathSegments,
	developmentServerUrl
}: ResolveWindowLoadTargetOptions): WindowLoadTarget => {
	if(developmentServerUrl) {
		return {
			type: 'url',
			value: developmentServerUrl
		};
	}

	return {
		type: 'file',
		value: path.join(appRootDirectory, ...rendererIndexPathSegments)
	};
};
