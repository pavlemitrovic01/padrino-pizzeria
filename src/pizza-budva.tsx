import React from "react";
import ReactDOM from "react-dom/client";
import PizzaBudvaPage from "./seo/PizzaBudvaPage";
import "./index.css";

/**
 * Dedicated entry point za /pizza-budva
 * Ne koristi App, ne koristi admin guard.
 * Čista SEO landing stranica.
 */

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PizzaBudvaPage />
  </React.StrictMode>
);