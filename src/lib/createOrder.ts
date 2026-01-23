import { supabase } from "./supabaseClient";
import type { CartItem } from "../types/menu";

interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CartItem[];
  totalPrice: number;
}

export async function createOrder(data: CreateOrderInput) {
  const { error } = await supabase.from("orders").insert([
    {
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      customer_address: data.customerAddress,
      items: data.items,
      total_price: data.totalPrice,
      status: "pending"
    }
  ]);

  if (error) {
    console.error("Create order error:", error);
    throw new Error("Failed to create order");
  }
}
