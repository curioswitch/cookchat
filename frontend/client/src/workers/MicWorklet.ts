/// <reference types="./AudioWorklet.d.ts" />

class MicWorklet
  extends AudioWorkletProcessor
  implements AudioWorkletProcessorImpl
{
  process(inputs: Float32Array[][]): boolean {
    if (inputs[0].length > 0) {
      const channel0 = inputs[0][0];
      this.port.postMessage(channel0);
    }
    return true;
  }
}

registerProcessor("mic-worklet", MicWorklet);
