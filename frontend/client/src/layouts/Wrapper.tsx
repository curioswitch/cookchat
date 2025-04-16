import { usePageContext } from "vike-react/usePageContext";
import { navigate } from "vike/client/router";

import { FirebaseProvider, useFirebase } from "../hooks/firebase";

function Authorizer({ children }: { children: React.ReactNode }) {
  const firebase = useFirebase();
  const pageCtx = usePageContext();

  if (!firebase?.userResolved) {
    return;
  }

  if (pageCtx.urlPathname === "/login") {
    if (firebase.user) {
      navigate("/");
      return;
    }
  } else if (!firebase.user) {
    navigate("/login");
    return;
  }

  return <>{children}</>;
}

export default function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseProvider>
      <Authorizer>{children}</Authorizer>
    </FirebaseProvider>
  );
}
