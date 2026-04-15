import { Button } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useCallback, useEffect } from "react";

import { getFirebaseConfig } from "../../hooks/firebase/config";

export const Route = createFileRoute("/login/")({
  component: Page,
});

function getApp() {
  return getApps()[0] ?? initializeApp(getFirebaseConfig());
}

function Page() {
  useEffect(() => {
    async function checkRedirectResult() {
      const auth = getAuth(getApp());
      try {
        await getRedirectResult(auth);
      } catch {
        console.error("Error logging in");
      }
    }
    checkRedirectResult();
  }, []);

  const onLoginClick = useCallback(async () => {
    const auth = getAuth(getApp());
    const provider = new GoogleAuthProvider();
    if (import.meta.env.PROD) {
      await signInWithRedirect(auth, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
  }, []);

  return (
    <Button
      className="mx-4 mt-4 bg-yellow-400 text-white roundex-lg"
      onPress={onLoginClick}
    >
      Login with Google
    </Button>
  );
}
