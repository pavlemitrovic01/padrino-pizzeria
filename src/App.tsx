import Navbar from "./components/Navbar";
import CartDrawer from "./components/CartDrawer";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Menu from "./sections/Menu";
import Delivery from "./sections/Delivery";
import Contact from "./sections/Contact";
import Footer from "./sections/Footer";

function App() {
  console.log("App rendering");
  return (
    <>
      <Navbar />
      <Hero />
      <About />
      <Menu />
      <Delivery />
      <Contact />
      <Footer />
      <CartDrawer />
    </>
  );
}

export default App;









