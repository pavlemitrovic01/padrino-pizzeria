import Menu from "./sections/Menu";
import Checkout from "./components/Checkout";
import CartDrawer from "./components/CartDrawer";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <>
      <Navbar />

      <main className="bg-black">
        <Menu />
        <Checkout />
      </main>

      <CartDrawer />
    </>
  );
}
