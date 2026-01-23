import { HashRouter, Routes, Route } from "react-router-dom";

import AdminOrders from "./components/AdminOrders";
import AdminLogin from "./pages/admin/AdminLogin";
import RequireAdmin from "./auth/RequireAdmin";

import Navbar from "./components/Navbar";
import Hero from "./sections/Hero";
import Menu from "./sections/Menu";
import About from "./sections/About";
import Delivery from "./sections/Delivery";
import Contact from "./sections/Contact";
import Footer from "./sections/Footer";

function PublicApp() {
  return (
    <>
      <Navbar />
      <Hero />
      <Menu />
      <About />
      <Delivery />
      <Contact />
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* ✅ ADMIN LOGIN – BEZ ZAŠTITE */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* 🔒 ADMIN PANEL – ZAŠTIĆEN */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminOrders />
            </RequireAdmin>
          }
        />

        {/* 🌍 PUBLIC SITE */}
        <Route path="*" element={<PublicApp />} />
      </Routes>
    </HashRouter>
  );
}

