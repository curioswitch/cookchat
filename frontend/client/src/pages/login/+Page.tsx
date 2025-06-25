import { Button } from "@heroui/button";
import { getApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useCallback, useEffect } from "react";
import { navigate } from "vike/client/router";

export default function Page() {
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
    <Button className="mx-4 mt-4" onPress={onLoginClick} color="primary">
      Login with Google
    </Button>
  );
}
