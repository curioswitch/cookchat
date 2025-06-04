import "./styles.css";

import { HeroUIProvider } from "@heroui/system";
import { I18nextProvider } from "react-i18next";
import { usePageContext } from "vike-react/usePageContext";
import { navigate } from "vike/client/router";

import { FirebaseProvider, useFirebase } from "../hooks/firebase";
import { FrontendServiceProvider } from "../hooks/rpc";

import i18n from "./i18n";

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
