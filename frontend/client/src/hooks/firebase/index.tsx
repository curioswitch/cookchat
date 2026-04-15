import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";

import { getFirebaseConfig } from "./config";

interface FirebaseState {
  user?: User;
  userResolved?: boolean;
}

const FirebaseContext = createContext<FirebaseState | undefined>(undefined);

export function useFirebase(): FirebaseState | undefined {
  return useContext(FirebaseContext);
}

export function useFirebaseUser(): User | undefined {
  return useContext(FirebaseContext)?.user;
}

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FirebaseState | undefined>(undefined);

  useEffect(() => {
    const app = getApps()[0] ?? initializeApp(getFirebaseConfig());
    const auth = getAuth(app);

    return onAuthStateChanged(auth, (u) => {
      const user = u ?? undefined;
      setState({ user, userResolved: true });
    });
  }, []);

  return (
    <FirebaseContext.Provider value={state}>
      {children}
    </FirebaseContext.Provider>
  );
}
