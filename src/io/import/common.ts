import { FetchCache } from '@/src/utils/fetch';
import { DataSource, FileSource } from '@/src/io/import/dataSource';
import { Handler } from '@/src/core/pipeline';
import { ARCHIVE_FILE_TYPES } from '@/src/io/mimeTypes';
import { Awaitable } from '@vueuse/core';
import { Config } from '@/src/io/import/configSchema';

interface DataResult {
  dataSource: DataSource;
}

export interface LoadableResult extends DataResult {
  type: 'LoadableResult';
  dataID: string;
  dataType: 'image' | 'dicom' | 'model';
}

export interface ConfigResult extends DataResult {
  type: 'ConfigResult';
  config: Config;
}

export type ImportResult = LoadableResult | ConfigResult | DataResult;

export type ArchiveContents = Record<string, File>;
export type ArchiveCache = Map<File, Awaitable<ArchiveContents>>;

export interface ImportContext {
  // Caches URL responses
  fetchFileCache?: FetchCache<File>;
  // Caches archives. ArchiveFile -> { [archivePath]: File }
  archiveCache?: ArchiveCache;
}

export type ImportHandler = Handler<DataSource, ImportResult, ImportContext>;

export function isArchive(
  ds: DataSource
): ds is DataSource & { fileSrc: FileSource } {
  return !!ds.fileSrc && ARCHIVE_FILE_TYPES.has(ds.fileSrc.fileType);
}

export function isLoadableResult(
  importResult: ImportResult
): importResult is LoadableResult {
  return 'dataID' in importResult && 'dataType' in importResult;
}

export function isConfigResult(
  importResult: ImportResult
): importResult is ConfigResult {
  return 'config' in importResult;
}
