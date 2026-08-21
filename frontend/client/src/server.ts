import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

function withCrossOriginIsolation(req: Request, response: Response) {
  const headers = new Headers(response.headers);
  const pathname = new URL(req.url).pathname;
  const isLogin = pathname === "/login" || pathname === "/login/";
  if (isLogin) {
    // Firebase popup auth must retain an ordinary opener relationship across
    // the provider's cross-origin navigations. The app performs a full reload
    // after login to restore cross-origin isolation.
    headers.delete("Cross-Origin-Opener-Policy");
    headers.delete("Cross-Origin-Embedder-Policy");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "credentialless");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default createServerEntry({
  async fetch(req) {
    const response = await handler.fetch(req);
    return withCrossOriginIsolation(req, response);
  },
});
