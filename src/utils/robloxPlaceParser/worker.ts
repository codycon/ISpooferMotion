import { parseRbxl } from './parseRbxl';
import { parseRbxlx } from './parseRbxlx';
import type { ParseProgress } from './types';

self.onmessage = async (e: MessageEvent) => {
  try {
    const { bytes, fileUrl, fileName, format } = e.data;

    let activeBytes = bytes;
    if (fileUrl) {
      self.postMessage({
        type: 'progress',
        payload: { phase: 'Reading file', current: 0, total: 1 },
      });
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Failed to load file: ${res.statusText}`);

      const contentLengthStr = res.headers.get('content-length');
      const totalSize = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;

      const reader = res.body?.getReader();
      if (!reader) {
        // Fallback if streams aren't supported
        const buffer = await res.arrayBuffer();
        activeBytes = new Uint8Array(buffer);
      } else {
        const chunks: Uint8Array[] = [];
        let loaded = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loaded += value.length;
            // Report progress every 5MB or so to avoid spamming the UI thread,
            // or if it's the final chunk
            if (loaded % (1024 * 1024 * 5) < value.length || loaded === totalSize) {
              self.postMessage({
                type: 'progress',
                payload: {
                  phase: 'Reading file',
                  current: loaded,
                  total: Math.max(loaded, totalSize),
                },
              });
            }
          }
        }

        const buffer = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.length;
        }
        activeBytes = buffer;
      }
    }

    if (!activeBytes) throw new Error('No bytes or fileUrl provided to worker');

    let result;
    if (format === 'rbxlx') {
      result = await parseRbxlx(activeBytes, fileName, (progress: ParseProgress) => {
        self.postMessage({ type: 'progress', payload: progress });
      });
    } else {
      // parseRbxl expects an ArrayBuffer.
      const buffer = activeBytes.buffer.slice(
        activeBytes.byteOffset,
        activeBytes.byteOffset + activeBytes.byteLength,
      ) as ArrayBuffer;
      result = await parseRbxl(buffer, fileName);
    }

    // Post final result back
    self.postMessage({ type: 'success', payload: result });
  } catch (err) {
    self.postMessage({ type: 'error', payload: String(err) });
  }
};
