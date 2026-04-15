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

    if (location.pathname === "/login") {
      if (firebase.user) {
        const next = new URLSearchParams(location.searchStr).get("next");
        if (next) {
          const nextDecoded = decodeURIComponent(next);
          if (nextDecoded.startsWith("/")) {
            void navigate({ href: nextDecoded, replace: true });
            return;
          }
        }
        void navigate({ to: "/", replace: true });
        return;
      }
    } else if (!firebase.user) {
      void navigate({
        href: `/login?next=${encodeURIComponent(location.pathname)}`,
        replace: true,
      });
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
