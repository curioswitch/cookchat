import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import { FirebaseProvider, useFirebase } from "../hooks/firebase";
import { FrontendServiceProvider } from "../hooks/rpc";

function Authorizer({ children }: { children: React.ReactNode }) {
  const firebase = useFirebase();
  const location = useRouterState({
    select: (state) => state.location,
  });

  useEffect(() => {
    if (!firebase?.userResolved) {
      return;
    }

    const isLogin =
      location.pathname === "/login" || location.pathname === "/login/";
    // Hosting serves /login without COOP/COEP so Firebase's auth iframe can
    // load. Crossing that boundary requires a new document to change policy.
    if (isLogin) {
      if (firebase.user) {
        const next = new URLSearchParams(location.searchStr).get("next");
        if (next) {
          const nextDecoded = decodeURIComponent(next);
          if (nextDecoded.startsWith("/")) {
            window.location.replace(nextDecoded);
            return;
          }
        }
        window.location.replace("/");
        return;
      }
    } else if (!firebase.user) {
      const loginUrl = `/login?next=${encodeURIComponent(location.pathname)}`;
      window.location.replace(loginUrl);
      return;
    }
  }, [firebase, location.pathname, location.searchStr]);

  return <div>{children}</div>;
}

export default function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseProvider>
      <Authorizer>
        <FrontendServiceProvider>{children}</FrontendServiceProvider>
      </Authorizer>
    </FirebaseProvider>
  );
}
