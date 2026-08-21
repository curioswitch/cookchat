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

import logoSVG from "../../assets/logo.svg";
import { getFirebaseConfig } from "../../hooks/firebase/config";

export const Route = createFileRoute("/login/")({
  component: Page,
});

function getApp() {
  return getApps()[0] ?? initializeApp(getFirebaseConfig());
}

function Page() {
  useEffect(() => {
    if (!import.meta.env.PROD) {
      return;
    }

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
    <div className="flex w-full flex-col items-center justify-center gap-8">
      <img className="w-56" src={logoSVG} alt="COOPii" />
      <Button
        className="h-14 w-[70%] max-w-[360px] rounded-lg bg-yellow-400 text-lg font-semibold text-white hover:bg-yellow-500"
        onPress={onLoginClick}
      >
        Login with Google
      </Button>
    </div>
  );
}
