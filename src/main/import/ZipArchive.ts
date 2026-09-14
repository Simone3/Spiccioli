import { inflateRawSync } from 'node:zlib';

/**
 * As much of the zip container as reading a workbook takes, and no more.
 *
 * An `.xlsx` is a zip of XML documents, so opening one is opening a zip. **The whole of what this does is find the entries by
 * name and hand back their bytes**: there is no directory tree, no streaming, no writing and no zip64 — a bank export is a
 * handful of small documents, and anything larger than [`IMPORT_FILE_CONFIG`](../../config/AppConfig.ts) admits is refused
 * before it reaches here.
 *
 * **The central directory is what is walked and never the local headers.** A local header may state a size of zero and put the
 * real one in a descriptor *after* the data, which is a shape a writer is free to use and a reader cannot recover from without
 * the directory; the directory always carries both sizes.
 */

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

const CENTRAL_DIRECTORY_ENTRY_SIGNATURE = 0x02014b50;

const LOCAL_HEADER_SIGNATURE = 0x04034b50;

// The end record is the last thing in the file, followed only by a comment nothing here reads. It is found by scanning back
// from the end over the longest comment a zip may carry, plus the record itself.
const END_OF_CENTRAL_DIRECTORY_MINIMUM_LENGTH = 22;

const MAXIMUM_COMMENT_LENGTH = 0xffff;

// Where each field sits in the end-of-central-directory record
const END_RECORD_OFFSETS = {
	entryCount: 10,
	directoryOffset: 16
} as const;

// Where each field sits in a central directory entry, and how long the fixed part of one is
const DIRECTORY_ENTRY_OFFSETS = {
	compressionMethod: 10,
	compressedSize: 20,
	uncompressedSize: 24,
	nameLength: 28,
	extraLength: 30,
	commentLength: 32,
	localHeaderOffset: 42,
	name: 46
} as const;

// Where each field sits in a local file header, and how long the fixed part of one is
const LOCAL_HEADER_OFFSETS = {
	nameLength: 26,
	extraLength: 28,
	fixedLength: 30
} as const;

// The two storage methods a spreadsheet writer uses. Anything else — and there are a dozen — is not one this reads.
const STORED = 0;

const DEFLATED = 8;

// The marker a zip64 record puts where a 32-bit figure would go. A workbook that needs one is far past what an export is.
const ZIP64_MARKER = 0xffffffff;

/**
 * Finds the end-of-central-directory record, which is where reading a zip starts.
 * @param bytes The whole file.
 * @returns Where the record begins, or undefined when there is no zip here.
 */
const findEndRecord = (bytes: Buffer): number | undefined => {
	const earliest = Math.max(0, bytes.length - END_OF_CENTRAL_DIRECTORY_MINIMUM_LENGTH - MAXIMUM_COMMENT_LENGTH);

	for(let offset = bytes.length - END_OF_CENTRAL_DIRECTORY_MINIMUM_LENGTH; offset >= earliest; offset--) {
		if(bytes.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
			return offset;
		}
	}

	return undefined;
};

// One entry as the central directory states it, which is everything needed to reach its bytes
interface DirectoryEntry {
	name: string;
	compressionMethod: number;
	compressedSize: number;
	uncompressedSize: number;
	localHeaderOffset: number;
}

/**
 * Reads the central directory, which is the list of what the archive holds.
 * @param bytes The whole file.
 * @returns One entry per member, or undefined when the archive cannot be walked.
 */
const readDirectory = (bytes: Buffer): DirectoryEntry[] | undefined => {
	const endOffset = findEndRecord(bytes);

	if(endOffset === undefined) {
		return undefined;
	}

	const entryCount = bytes.readUInt16LE(endOffset + END_RECORD_OFFSETS.entryCount);
	let offset = bytes.readUInt32LE(endOffset + END_RECORD_OFFSETS.directoryOffset);

	if(offset === ZIP64_MARKER) {
		return undefined;
	}

	const entries: DirectoryEntry[] = [];

	for(let index = 0; index < entryCount; index++) {
		if(offset + DIRECTORY_ENTRY_OFFSETS.name > bytes.length || bytes.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY_SIGNATURE) {
			return undefined;
		}

		const nameLength = bytes.readUInt16LE(offset + DIRECTORY_ENTRY_OFFSETS.nameLength);
		const extraLength = bytes.readUInt16LE(offset + DIRECTORY_ENTRY_OFFSETS.extraLength);
		const commentLength = bytes.readUInt16LE(offset + DIRECTORY_ENTRY_OFFSETS.commentLength);

		entries.push({
			name: bytes.toString('utf8', offset + DIRECTORY_ENTRY_OFFSETS.name, offset + DIRECTORY_ENTRY_OFFSETS.name + nameLength),
			compressionMethod: bytes.readUInt16LE(offset + DIRECTORY_ENTRY_OFFSETS.compressionMethod),
			compressedSize: bytes.readUInt32LE(offset + DIRECTORY_ENTRY_OFFSETS.compressedSize),
			uncompressedSize: bytes.readUInt32LE(offset + DIRECTORY_ENTRY_OFFSETS.uncompressedSize),
			localHeaderOffset: bytes.readUInt32LE(offset + DIRECTORY_ENTRY_OFFSETS.localHeaderOffset)
		});

		offset += DIRECTORY_ENTRY_OFFSETS.name + nameLength + extraLength + commentLength;
	}

	return entries;
};

/**
 * Takes one entry's bytes out of the archive.
 * @param bytes The whole file.
 * @param entry The entry, as the central directory states it.
 * @returns What it holds, or undefined when it is stored in a way this does not read.
 */
const readEntry = (bytes: Buffer, entry: DirectoryEntry): Buffer | undefined => {
	const headerOffset = entry.localHeaderOffset;

	if(headerOffset + LOCAL_HEADER_OFFSETS.fixedLength > bytes.length || bytes.readUInt32LE(headerOffset) !== LOCAL_HEADER_SIGNATURE) {
		return undefined;
	}

	// The local header states its own name and extra lengths, and a writer is free to make them differ from the directory's
	const nameLength = bytes.readUInt16LE(headerOffset + LOCAL_HEADER_OFFSETS.nameLength);
	const extraLength = bytes.readUInt16LE(headerOffset + LOCAL_HEADER_OFFSETS.extraLength);
	const dataOffset = headerOffset + LOCAL_HEADER_OFFSETS.fixedLength + nameLength + extraLength;

	if(entry.compressionMethod === STORED) {
		return bytes.subarray(dataOffset, dataOffset + entry.uncompressedSize);
	}

	if(entry.compressionMethod !== DEFLATED) {
		return undefined;
	}

	try {
		return inflateRawSync(bytes.subarray(dataOffset, dataOffset + entry.compressedSize));
	}
	catch {
		return undefined;
	}
};

// What an opened archive offers, which is one thing: the text of a member, by name
export interface ZipArchive {

	// The member's contents as UTF-8, which is what every document inside a workbook is. Undefined where there is no such member.
	readText: (name: string) => string | undefined;

	// Every member's name, so that a document whose exact path is not known can be looked for
	names: () => string[];
}

/**
 * Opens a zip archive held in memory.
 * @param bytes The whole file.
 * @returns The archive, or undefined when these bytes are not one.
 */
export const openZipArchive = (bytes: Buffer): ZipArchive | undefined => {
	const entries = readDirectory(bytes);

	if(!entries) {
		return undefined;
	}

	const byName = new Map(entries.map((entry) => {
		return [ entry.name, entry ];
	}));

	return {
		readText: (name) => {
			const entry = byName.get(name);

			if(!entry) {
				return undefined;
			}

			return readEntry(bytes, entry)?.toString('utf8');
		},
		names: () => {
			return [ ...byName.keys() ];
		}
	};
};
