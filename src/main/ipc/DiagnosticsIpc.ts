import type { IpcMain } from 'electron';
import { DIAGNOSTICS_CONFIG } from 'src/config/AppConfig';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { SPICCIOLI_DIAGNOSTICS_IPC_CHANNELS } from 'src/types/LedgerIpcChannels';
import type { RenderErrorReport } from 'src/types/LedgerIpcTypes';

/**
 * The renderer's way into the operational log.
 *
 * A render failure used to go to the renderer console, which an installed Spiccioli cannot open and which outlives nothing. It
 * is written here instead, by the process that owns the log file.
 *
 * **The renderer chooses neither the message nor the level.** It sends three texts and this handler decides what they are called
 * and how long they are allowed to be, so nothing the renderer sends can grow a log line without limit.
 */

type DiagnosticsIpcMain = Pick<IpcMain, 'handle'>;

export interface RegisterDiagnosticsIpcHandlersOptions {
	ipcMain: DiagnosticsIpcMain;
}

const truncate = (value: unknown, maximumLength: number): string | undefined => {
	if(typeof value !== 'string' || !value) {
		return undefined;
	}

	return value.length <= maximumLength ? value : `${value.slice(0, maximumLength)}…`;
};

export const registerDiagnosticsIpcHandlers = ({ ipcMain }: RegisterDiagnosticsIpcHandlersOptions): void => {
	ipcMain.handle(SPICCIOLI_DIAGNOSTICS_IPC_CHANNELS.reportRenderError, (_event, report: RenderErrorReport) => {
		appLogger.error(truncate(report.message, DIAGNOSTICS_CONFIG.maximumRenderErrorMessageLength) ?? 'A render error was reported with no message', {
			type: 'renderer.error',
			stack: truncate(report.stack, DIAGNOSTICS_CONFIG.maximumRenderErrorStackLength),
			componentStack: truncate(report.componentStack, DIAGNOSTICS_CONFIG.maximumRenderErrorComponentStackLength)
		});
	});
};
