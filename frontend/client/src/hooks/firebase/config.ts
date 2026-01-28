export function getFirebaseConfig() {
  // Note, switch statement does not seem to allow optimizing away the unused
  // config so we use if statements.

  if (import.meta.env.PUBLIC_ENV__FIREBASE_APP === "cookchat-dev") {
    return {
      apiKey: "AIzaSyAtNbka56GMp9Hoa62EdUIeOjHgqwqZYCw",
      authDomain: "alpha.coopii.app",
      projectId: "cookchat-dev",
      storageBucket: "cookchat-dev.firebasestorage.app",
      messagingSenderId: "408496405753",
      appId: "1:408496405753:web:2c885676454a27ba4af628",
    };
  }

  if (import.meta.env.PUBLIC_ENV__FIREBASE_APP === "cookchat-prod") {
    throw new Error("cookchat-prod not provisioned yet");
  }

  throw new Error("PUBLIC_ENV__FIREBASE_APP must be configured");
}
