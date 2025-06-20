import { useEffect } from "react";
import { navigate } from "vike/client/router";
import { usePageContext } from "vike-react/usePageContext";

export default function Page() {
  const pageContext = usePageContext();
  useEffect(() => {
    navigate(pageContext.urlOriginal);
  }, [pageContext]);
  return undefined;
}
