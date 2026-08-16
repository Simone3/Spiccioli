/**
 * Types for "electron-squirrel-startup", which ships none of its own.
 *
 * The package is a single side-effecting check: importing it handles the Squirrel install step named on the command line, if there
 * is one, and the value it exports says whether it did. Declared here rather than pulled in as another dependency, because a
 * dependency for one boolean is more to keep up to date than the boolean is worth.
 */
declare module 'electron-squirrel-startup' {

	// True when this run was started by the Windows installer to do one of its steps, which the import has now done. False otherwise,
	// including on every platform that has no Squirrel installer.
	const handledSquirrelStartupEvent: boolean;

	// The package assigns its whole export, so this is the shape of it rather than a named or default export of its own
	export = handledSquirrelStartupEvent;
}
