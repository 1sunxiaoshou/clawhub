import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/settings/security/password" as never)({
  component: LegacySettingsSecurityPasswordRoute,
});

function LegacySettingsSecurityPasswordRoute() {
  useEffect(() => {
    window.location.replace("/settings/password");
  }, []);

  return null;
}
