import React from "react";
import ReactDOM from "react-dom/client";
import PizzaBudvaPage from "./seo/PizzaBudvaPage";
import { trackPageView } from "./lib/analytics";
import "./index.css";

/**
 * Dedicated entry point za /pizza-budva
 * Ne koristi App, ne koristi admin guard.
 * Čista SEO landing stranica.
 */

// GA: pizza-budva ima send_page_view:false u HTML, pa šaljemo jedan page_view ručno
trackPageView("/pizza-budva");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PizzaBudvaPage />
  </React.StrictMode>
);