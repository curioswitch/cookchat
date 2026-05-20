import { createFileRoute } from "@tanstack/react-router";

import { m } from "../paraglide/messages";

export const Route = createFileRoute("/_shell")({
  component: Shell,
});

function Shell() {
  return <div>{m.common_loading()}</div>;
}
