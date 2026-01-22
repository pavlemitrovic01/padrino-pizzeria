import { MenuItem as MenuItemType } from "../types/menu";
import { useCart } from "../context/CartContext";

type Props = {
  item: MenuItemType;
};

export default function MenuItem({ item }: Props) {
  const { addToCart } = useCart();

  return (
    <div className="bg-zinc-900 rounded-xl p-6 flex gap-6">
      <img
        src={item.image}
        alt={item.name}
        className="w-28 h-28 object-cover rounded-lg"
      />

      <div className="flex-1">
        <div className="flex justify-between">
          <h3 className="font-serif text-xl">{item.name}</h3>
          <span className="text-amber-500">{item.price} RSD</span>
        </div>

        <p className="text-zinc-400 text-sm mt-2">
          {item.description}
        </p>

        <button
          onClick={() => addToCart(item)}
          className="mt-4 text-amber-500 text-xs uppercase"
        >
          Dodaj u korpu →
        </button>
      </div>
    </div>
  );
}

