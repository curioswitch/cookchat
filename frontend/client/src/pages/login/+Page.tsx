import { getApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useEffect, useRef } from "react";
import { navigate } from "vike/client/router";

export default function Page() {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) {
      return;
    }
    initialized.current = true;
    const signin = async () => {
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
    };
    signin();
  }, []);

  return <>Authenticating...</>;
}
