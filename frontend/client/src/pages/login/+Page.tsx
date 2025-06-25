import { Button } from "@heroui/button";
import { getApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useCallback } from "react";
import { navigate } from "vike/client/router";

export default function Page() {
  const onLoginClick = useCallback(async () => {
    const auth = getAuth(getApp());
    const provider = new GoogleAuthProvider();
    if (import.meta.env.PROD) {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          navigate("/");
          return;
        }
      } catch (error) {
        console.error("Error during sign-in redirect:", error);
        return;
      }
      await signInWithRedirect(auth, provider);
    } else {
      await signInWithPopup(auth, provider);
      navigate("/");
    }
  }, []);

  return (
    <Button className="mx-4 mt-4" onPress={onLoginClick} color="primary">
      Login with Google
    </Button>
  );
}
