import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getSerwist } from "virtual:serwist";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import { RouteErrorPanel } from "./components/RouteErrorPanel";
import { ThemeProvider, THEME_STORAGE_KEY } from "./components/theme-provider";
import { TooltipProvider } from "./components/ui/tooltip";
import { I18nProvider } from "./i18n";
import { initAppUpdates } from "./lib/appUpdate";
import { routeTree } from "./routeTree.gen";
import "./global.css";

void initAppUpdates(getSerwist);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
});

const router = createRouter({
  routeTree,
  defaultErrorComponent: ({ error }) => <RouteErrorPanel error={error} />,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey={THEME_STORAGE_KEY}>
        <I18nProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
