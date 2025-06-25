import "./styles.css";

import { HeroUIProvider } from "@heroui/system";
import { I18nextProvider } from "react-i18next";
import { navigate } from "vike/client/router";
import { usePageContext } from "vike-react/usePageContext";

import { FirebaseProvider, useFirebase } from "../hooks/firebase";
import { FrontendServiceProvider } from "../hooks/rpc";

import i18n from "./i18n";

function Authorizer({ children }: { children: React.ReactNode }) {
  const firebase = useFirebase();
  const pageCtx = usePageContext();

  if (import.meta.env.SSR) {
    return <div>{children}</div>;
  }

  if (!firebase?.userResolved) {
    return <div />;
  }

  if (pageCtx.urlPathname === "/login") {
    if (firebase.user) {
      const next = pageCtx.urlParsed.search.next;
      if (next) {
        const nextDecoded = decodeURIComponent(next);
        if (nextDecoded.startsWith("/")) {
          navigate(nextDecoded);
          return <div />;
        }
      }
      navigate("/");
      return <div />;
    }
  } else if (!firebase.user) {
    navigate(`/login?next=${encodeURIComponent(pageCtx.urlPathname)}`);
    return <div />;
  }

  return <div>{children}</div>;
}

export default function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <FirebaseProvider>
        <Authorizer>
          <FrontendServiceProvider>
            <HeroUIProvider navigate={navigate}>{children}</HeroUIProvider>
          </FrontendServiceProvider>
        </Authorizer>
      </FirebaseProvider>
    </I18nextProvider>
  );
}
