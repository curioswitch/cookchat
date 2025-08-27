declare interface AudioContext {
  setSinkId?: (sinkId: string) => Promise<void>;
}

declare interface Uint8ArrayConstructor {
  fromBase64?: (base64: string) => Uint8Array;
}

declare interface Uint8Array {
  toBase64?: () => string;
}

declare global {
  namespace Vike {
    interface PageContext {
      titleKey: string;
    }
  }
}

export {};
