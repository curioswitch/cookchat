import { AudioReader, RingBuffer } from "ringbuf.js";

class SpeakerWorklet extends AudioWorkletProcessor {
  private readonly buffer: AudioReader;
  private readonly minBufferFrames: number;

  private isPlaying = false;

  constructor(options: AudioWorkletNodeOptions) {
    super();

    this.minBufferFrames = Math.floor((sampleRate * 50) / 1000); // 50ms
    this.buffer = new AudioReader(
      new RingBuffer(options.processorOptions.outputBuffer, Float32Array),
    );
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    const outputChannel = outputs[0][0];
    const bufferSize = outputChannel.length;
    const available = this.buffer.availableRead();
    if (!this.isPlaying) {
      if (available >= this.minBufferFrames) {
        this.isPlaying = true;
      }
    } else {
      if (available < bufferSize) {
        this.isPlaying = false;
      }
    }

    if (this.isPlaying) {
      this.buffer.dequeue(outputChannel);
    }

    return true;
  }
}

registerProcessor("speaker-worklet", SpeakerWorklet);
