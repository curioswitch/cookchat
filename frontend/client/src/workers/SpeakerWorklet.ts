class SpeakerWorklet
  extends AudioWorkletProcessor
  implements AudioWorkletProcessorImpl
{
  buffer: Float32Array[];

  constructor(options: any) {
    super();

    this.buffer = [];

    this.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      this.buffer.push(new Float32Array(event.data));
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    const outputChannel = outputs[0][0];
    const bufferSize = outputChannel.length;

    let framesWritten = 0;

    while (this.buffer.length > 0 && framesWritten < bufferSize) {
      const audioChunk = this.buffer[0];
      const framesToCopy = Math.min(
        audioChunk.length,
        bufferSize - framesWritten,
      );

      outputChannel.set(audioChunk.subarray(0, framesToCopy), framesWritten);

      if (framesToCopy === audioChunk.length) {
        this.buffer.shift();
      } else {
        this.buffer[0] = audioChunk.subarray(framesToCopy);
      }

      framesWritten += framesToCopy;
    }

    // If the buffer ran dry, fill the rest with silence
    if (framesWritten < bufferSize) {
      outputChannel.fill(0, framesWritten, bufferSize);
    }

    return true;
  }
}

registerProcessor("speaker-worklet", SpeakerWorklet);
