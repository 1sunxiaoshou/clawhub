import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/settings/security" as never)({
  component: SettingsSecurityRoute,
});

function SettingsSecurityRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (pathname === "/settings/security") {
      window.history.replaceState(null, "", "/settings");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [pathname]);

  if (pathname !== "/settings/security") {
    return <Outlet />;
  }

  return null;
}
