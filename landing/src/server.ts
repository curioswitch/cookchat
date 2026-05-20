import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "./paraglide/server";

export default createServerEntry({
  fetch(req) {
    return paraglideMiddleware(req, () => handler.fetch(req));
  },
});
