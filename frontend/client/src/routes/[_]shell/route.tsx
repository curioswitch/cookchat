import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell")({
  component: Shell,
});

function Shell() {
  return <div>Loading...</div>;
}
