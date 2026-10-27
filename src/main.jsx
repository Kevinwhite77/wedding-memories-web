import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App.jsx";
import "../styles.css";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

function MissingConfig() {
  return (
    <div style={{ maxWidth: 600, margin: "80px auto", fontFamily: "sans-serif", textAlign: "center" }}>
      <h2>Falta configurar VITE_CONVEX_URL</h2>
      <p>Copia <code>.env.example</code> a <code>.env.local</code> y pon tu URL de Convex.</p>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));

if (!CONVEX_URL) {
  root.render(<MissingConfig />);
} else {
  const convex = new ConvexReactClient(CONVEX_URL);
  root.render(
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  );
}
