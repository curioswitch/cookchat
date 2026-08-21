import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import { FirebaseProvider, useFirebase } from "../hooks/firebase";
import { FrontendServiceProvider } from "../hooks/rpc";

function Authorizer({ children }: { children: React.ReactNode }) {
  const firebase = useFirebase();
  const navigate = useNavigate();
  const location = useRouterState({
    select: (state) => state.location,
  });

  useEffect(() => {
    if (!firebase?.userResolved) {
      return;
    }

    const isLogin =
      location.pathname === "/login" || location.pathname === "/login/";
    if (isLogin) {
      if (firebase.user) {
        const next = new URLSearchParams(location.searchStr).get("next");
        if (next) {
          const nextDecoded = decodeURIComponent(next);
          if (nextDecoded.startsWith("/")) {
            if (!import.meta.env.PROD) {
              window.location.replace(nextDecoded);
              return;
            }
            void navigate({ href: nextDecoded, replace: true });
            return;
          }
        }
        if (!import.meta.env.PROD) {
          window.location.replace("/");
          return;
        }
        void navigate({ to: "/", replace: true });
        return;
      }
    } else if (!firebase.user) {
      const loginUrl = `/login?next=${encodeURIComponent(location.pathname)}`;
      if (!import.meta.env.PROD) {
        window.location.replace(loginUrl);
        return;
      }
      void navigate({ href: loginUrl, replace: true });
      return;
    }
  }, [firebase, location.pathname, location.searchStr, navigate]);

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
