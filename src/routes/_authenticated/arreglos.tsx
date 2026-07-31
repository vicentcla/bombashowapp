import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/arreglos")({
  beforeLoad: () => {
    throw redirect({
      to: "/contadores",
      search: { tab: "arreglos" },
      replace: true,
    });
  },
});
