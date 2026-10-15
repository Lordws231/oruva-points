import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

(window as any).oruvaCookieGate = new Promise((res) => { (window as any).__oruvaCookieResolve = res; });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
