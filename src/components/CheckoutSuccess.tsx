import { useCart } from "../context/useCart";

interface Props {
  onClose: () => void;
}

export default function CheckoutSuccess({ onClose }: Props) {
  const { resetCart } = useCart();

  const handleClose = () => {
    resetCart();
    onClose();
  };

  return (
    <div className="text-center space-y-6">
      <p className="text-amber-500 text-lg">
        Porudžbina uspešno poslata 🎉
      </p>

      <button
        onClick={handleClose}
        className="w-full bg-amber-500 text-black py-3 rounded-lg font-semibold"
      >
        Nazad na meni
      </button>
    </div>
  );
}



