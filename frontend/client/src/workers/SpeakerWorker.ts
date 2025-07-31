import { ConverterType, create } from "@alexanderolsen/libsamplerate-js";

function base64Decode(base64: string): Uint8Array {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(base64);
  }

  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function convertPCM16ToFloat32(pcm: Uint8Array): Float32Array {
  const length = pcm.length / 2; // 16-bit audio, so 2 bytes per sample
  const float32AudioData = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    // Combine two bytes into one 16-bit signed integer (little-endian)
    let sample = pcm[i * 2] | (pcm[i * 2 + 1] << 8);
    // Convert from 16-bit PCM to Float32 (range -1 to 1)
    if (sample >= 32768) sample -= 65536;
    float32AudioData[i] = sample / 32768;
  }
  return float32AudioData;
}

type InitEvent = {
  type: "init";
  sampleRate: number;
  chatPort: MessagePort;
  speakerPort: MessagePort;
};

async function init(request: InitEvent) {
  const resampler = await create(1, 24_000, request.sampleRate, {
    converterType: ConverterType.SRC_SINC_BEST_QUALITY,
  });
  const speakerPort = request.speakerPort;

  request.chatPort.onmessage = (event: MessageEvent<string>) => {
    const data = event.data;
    const audioData = convertPCM16ToFloat32(base64Decode(data));
    const resampled = resampler.full(audioData);
    speakerPort.postMessage(resampled.buffer, [resampled.buffer]);
  };
}

self.onmessage = (event: MessageEvent<InitEvent>) => {
  init(event.data);
};
