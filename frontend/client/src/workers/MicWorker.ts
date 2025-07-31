import { ConverterType, create } from "@alexanderolsen/libsamplerate-js";

type InitEvent = {
  type: "init";
  sampleRate: number;
  micPort: MessagePort;
  chatPort: MessagePort;
};

function b64Encode(data: Int16Array): string {
  const byteArray = new Uint8Array(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  );
  if (byteArray.toBase64) {
    return byteArray.toBase64();
  }
  return btoa(String.fromCharCode(...byteArray));
}

async function init(request: InitEvent) {
  const resampler = await create(1, request.sampleRate, 16_000, {
    converterType: ConverterType.SRC_SINC_BEST_QUALITY,
  });
  const chatPort = request.chatPort;

  const buffer = new Int16Array(1024);

  request.micPort.onmessage = (event: MessageEvent<Float32Array>) => {
    const data = event.data;
    const resampled = resampler.full(data);
    const length = resampled.length;

    let bufferWriteIndex = 0;

    for (let i = 0; i < length; i++) {
      // convert float32 -1 to 1 to int16 -32768 to 32767
      buffer[bufferWriteIndex++] = resampled[i] * 32768;
      if (bufferWriteIndex === buffer.length) {
        const str = b64Encode(buffer);
        chatPort.postMessage({ data: str });
        bufferWriteIndex = 0;
      }
    }
    if (bufferWriteIndex > 0) {
      const str = b64Encode(buffer.subarray(0, bufferWriteIndex));
      chatPort.postMessage({ data: str });
    }
  };
}

self.onmessage = (event: MessageEvent<InitEvent>) => {
  init(event.data);
};
