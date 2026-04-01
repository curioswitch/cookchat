declare global {
  interface Uint8ArrayConstructor {
    fromBase64?: (base64: string) => Uint8Array;
  }

  interface Uint8Array {
    toBase64?: () => string;
  }

  namespace Vike {
    interface PageContext {
      titleKey: string;
    }
  }
}

export {};
