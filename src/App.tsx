import Navbar from "./components/Navbar";
import CartDrawer from "./components/CartDrawer";

import Hero from "./sections/Hero";
import Menu from "./sections/Menu";
import About from "./sections/About";
import Delivery from "./sections/Delivery";
import Contact from "./sections/Contact";
import Footer from "./sections/Footer";

export default function App() {
  return (
    <>
      <Navbar />
      <CartDrawer />

      <main>
        <Hero />
        <Menu />
        <About />
        <Delivery />
        <Contact />
      </main>

      <Footer />
    </>
  );
}
