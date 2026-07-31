import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/calle")({
  beforeLoad: () => {
    throw redirect({
      to: "/contadores",
      search: { tab: "calle" },
      replace: true,
    });
  },
});
