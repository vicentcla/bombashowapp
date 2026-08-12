import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ajustes")({
  beforeLoad: () => {
    throw redirect({
      to: "/centro",
      search: { tab: "perfil" },
      replace: true,
    });
  },
});
