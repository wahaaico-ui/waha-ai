/** Validate serialization before sending headers. Pull-based delivery avoids a
 * buffered function response, while preserving Unicode across chunk boundaries. */
export function jsonDownloadStream(value: unknown) {
  let json = JSON.stringify(value, null, 2);
  if (typeof json !== 'string') throw new Error('JSON_DOWNLOAD_INVALID');
  let offset = 0;
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      let end = Math.min(offset + 32_768, json.length);
      if (end < json.length && /[\uD800-\uDBFF]/u.test(json[end - 1])) end -= 1;
      controller.enqueue(encoder.encode(json.slice(offset, end)));
      offset = end;
      if (offset === json.length) { json = ''; controller.close(); }
    },
    cancel() { json = ''; },
  });
}
