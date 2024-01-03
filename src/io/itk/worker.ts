import { readDicomTags } from '@itk-wasm/dicom';
import { createWorkerProxy, readImageBlob } from 'itk-wasm';

let webWorker: Worker | null = null;
let webWorkerPromise: Promise<void> | null = null;

export async function ensureWorker() {
  if (webWorker) return;
  if (!webWorkerPromise) {
    webWorkerPromise = new Promise((resolve) => {
      createWorkerProxy(null).then(({ worker }) => {
        webWorker = worker;
        resolve();
      });
    });
  }
  await webWorkerPromise;
}

export function getWorker() {
  return webWorker;
}

export async function initWorker() {
  await ensureWorker();
  try {
    await readDicomTags(webWorker, new File([], 'a.dcm'));
  } catch (err) {
    // ignore
  }
  try {
    await readImageBlob(webWorker, new Blob([]), 'a.dcm');
  } catch (err) {
    // ignore
  }
}
