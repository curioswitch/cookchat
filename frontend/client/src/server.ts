import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

function withCrossOriginIsolation(response: Response) {
  const headers = new Headers(response.headers);
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
    return withCrossOriginIsolation(response);
  },
});
