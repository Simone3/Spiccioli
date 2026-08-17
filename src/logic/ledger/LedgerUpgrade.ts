import { LEDGER_SCHEMA_VERSION } from 'src/logic/ledger/LedgerDocument';
import { validateLedgerDocument } from 'src/logic/ledger/LedgerReader';
import { isLedgerRefusalError, type LedgerRefusal } from 'src/logic/ledger/LedgerRefusal';
import type { LedgerDocument } from 'src/types/LedgerTypes';

/**
 * Taking a file written by an older version up to this one.
 *
 * **The path is built and there is nothing to upgrade yet.** This build writes schema version 1, so no file can be at an
 * earlier one and no step is registered below. The machinery is here rather than deferred because the shape of an upgrade
 * decides what a step is allowed to do, and that is easier to fix now than after the first file exists.
 *
 * Three rules hold whatever a step does, and they are the reason an upgrade is a piece of code rather than a conversion script.
 *
 * **It is never silent and never automatic.** The user is asked, having been told which version wrote the file and which it will
 * become, and a pre-upgrade copy is written first — a copy that cannot be written stops the upgrade entirely.
 *
 * **It may not leave a dangling reference.** A transaction pointing at a category the upgrade retired, or a rule pointing at
 * one, would make the very next open refuse the file the upgrade had just written. That is why the result is validated here
 * before it is offered back: an upgrade that produced an unreadable document fails as an upgrade, not as the next open.
 *
 * **It re-applies the rule list as part of itself.** Retired categories are settled first, so the pass runs over the rules the
 * file is going to keep; the pass itself arrives with the categorisation engine, and until a step retires something there is
 * nothing for it to do.
 */

export interface LedgerUpgradeCounts {

	// The four figures the upgrade dialog shows and the log records
	transactionsRecategorised: number;
	rulesRepointed: number;
	rulesDeleted: number;
	categoriesRetired: number;
}

export interface LedgerUpgradeStep {
	fromSchemaVersion: number;
	toSchemaVersion: number;

	// Takes the file as the older version wrote it and hands back the shape the next version reads, plus what it had to move
	upgrade: (rawDocument: unknown) => { rawDocument: unknown; counts: Partial<LedgerUpgradeCounts> };
}

/**
 * Every step, in order, each taking a file one version further.
 * A new schema version adds exactly one entry here and nothing else about this module changes.
 */
export const LEDGER_UPGRADE_STEPS: readonly LedgerUpgradeStep[] = [];

export type LedgerUpgradeResult = {
	outcome: 'upgraded';
	document: LedgerDocument;
	fromSchemaVersion: number;
	toSchemaVersion: number;
	counts: LedgerUpgradeCounts;
} | {
	outcome: 'refused';
	refusal: LedgerRefusal;
};

const EMPTY_COUNTS: LedgerUpgradeCounts = {
	transactionsRecategorised: 0,
	rulesRepointed: 0,
	rulesDeleted: 0,
	categoriesRetired: 0
};

export interface UpgradeLedgerDocumentOptions {
	rawDocument: unknown;
	fromSchemaVersion: number;
	steps?: readonly LedgerUpgradeStep[];
	toSchemaVersion?: number;
}

/**
 * Runs every step between the version that wrote the file and the one this build reads, and validates what comes out.
 * @param options The parsed file, the version it is at, and the steps to run.
 * @param options.rawDocument The parsed file, in the shape the older version wrote it.
 * @param options.fromSchemaVersion The version that wrote it.
 * @param options.steps The steps to run, in order.
 * @param options.toSchemaVersion The version to land on.
 * @returns The upgraded document with what the upgrade had to move, or what made the result unreadable.
 */
export const upgradeLedgerDocument = ({
	rawDocument,
	fromSchemaVersion,
	steps = LEDGER_UPGRADE_STEPS,
	toSchemaVersion = LEDGER_SCHEMA_VERSION
}: UpgradeLedgerDocumentOptions): LedgerUpgradeResult => {
	let upgraded = rawDocument;
	let version = fromSchemaVersion;
	const counts: LedgerUpgradeCounts = { ...EMPTY_COUNTS };

	while(version < toSchemaVersion) {
		const versionToLeave = version;
		const step = steps.find((candidate) => {
			return candidate.fromSchemaVersion === versionToLeave;
		});

		// No step from the version the file is at is the same situation as a version this build has never heard of: there is no
		// route from that shape to this one, so the file is not opened
		if(!step) {
			return {
				outcome: 'refused',
				refusal: {
					reason: 'unsupported-schema-version',
					foundSchemaVersion: versionToLeave,
					supportedSchemaVersion: toSchemaVersion
				}
			};
		}

		const result = step.upgrade(upgraded);

		upgraded = result.rawDocument;
		version = step.toSchemaVersion;
		counts.transactionsRecategorised += result.counts.transactionsRecategorised ?? 0;
		counts.rulesRepointed += result.counts.rulesRepointed ?? 0;
		counts.rulesDeleted += result.counts.rulesDeleted ?? 0;
		counts.categoriesRetired += result.counts.categoriesRetired ?? 0;
	}

	try {
		return {
			outcome: 'upgraded',
			document: validateLedgerDocument(upgraded),
			fromSchemaVersion,
			toSchemaVersion,
			counts
		};
	}
	catch(error) {
		if(isLedgerRefusalError(error)) {
			return {
				outcome: 'refused',
				refusal: error.refusal
			};
		}

		throw error;
	}
};
