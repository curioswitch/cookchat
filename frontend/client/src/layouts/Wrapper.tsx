import "./styles.css";

import { useEffect } from "react";
import { navigate } from "vike/client/router";
import { usePageContext } from "vike-react/usePageContext";

import { FirebaseProvider, useFirebase } from "../hooks/firebase";
import { FrontendServiceProvider } from "../hooks/rpc";

function Authorizer({ children }: { children: React.ReactNode }) {
  const firebase = useFirebase();
  const pageCtx = usePageContext();

  useEffect(() => {
    if (!firebase) {
      return;
    }

    if (pageCtx.urlPathname === "/login") {
      if (firebase.user) {
        const next = pageCtx.urlParsed.search.next;
        if (next) {
          const nextDecoded = decodeURIComponent(next);
          if (nextDecoded.startsWith("/")) {
            navigate(nextDecoded);
            return;
          }
        }
        navigate("/");
        return;
      }
    } else if (!firebase.user) {
      navigate(`/login?next=${encodeURIComponent(pageCtx.urlPathname)}`);
      return;
    }
  }, [firebase, pageCtx]);

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
