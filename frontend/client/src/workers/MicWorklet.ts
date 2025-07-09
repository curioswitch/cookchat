/// <reference types="./AudioWorklet.d.ts" />

import type { create } from "@alexanderolsen/libsamplerate-js";

class MicWorklet
  extends AudioWorkletProcessor
  implements AudioWorkletProcessorImpl
{
  private readonly buffer = new Int16Array(1024);

  private bufferWriteIndex = 0;
  resampler: Awaited<ReturnType<typeof create>> | undefined;

  constructor() {
    super();
    this.init();
  }

  async init() {
    const { create, ConverterType } = globalThis.LibSampleRate;
    const resampler = await create(1, sampleRate, 16_000, {
      converterType: ConverterType.SRC_SINC_BEST_QUALITY,
    });
    this.resampler = resampler;
  }

  process(inputs: Float32Array[][]): boolean {
    if (inputs[0].length > 0) {
      const channel0 = inputs[0][0];
      this.processChunk(channel0);
    }
    return true;
  }

  private processChunk(chunk: Float32Array) {
    if (!this.resampler) {
      return;
    }
    const resampled = this.resampler.full(chunk);
    const length = resampled.length;
    for (let i = 0; i < length; i++) {
      // convert float32 -1 to 1 to int16 -32768 to 32767
      const int16Value = resampled[i] * 32768;
      this.buffer[this.bufferWriteIndex++] = int16Value;
      this.maybeSendBuffer();
    }
    this.maybeSendBuffer();
  }

  private maybeSendBuffer() {
    if (this.bufferWriteIndex >= this.buffer.length) {
      const data = new Uint8Array(
        this.buffer.buffer,
        this.buffer.byteOffset,
        this.buffer.byteLength,
      );
      const str = String.fromCharCode(...data);
      this.port.postMessage({
        event: "chunk",
        data: {
          str,
        },
      });
      this.bufferWriteIndex = 0;
    }
  }
}

registerProcessor("mic-worklet", MicWorklet);
