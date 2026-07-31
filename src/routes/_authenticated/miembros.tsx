import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/miembros")({
  head: () => ({
    meta: [
      { title: "Ajustes — La Bomba Show" },
    ],
  }),
  component: MiembrosRedirect,
});

function MiembrosRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/ajustes", replace: true });
  }, [navigate]);

  return null;
}
