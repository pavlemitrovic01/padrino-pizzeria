import { supabase } from "./supabaseClient";

export type CreateOrderPayload = {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items: any[];
  total_price: number;
};

export async function createOrder(payload: CreateOrderPayload) {
  const { data, error } = await supabase
    .from("orders")
    .insert([
      {
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
        customer_address: payload.customer_address,
        items: payload.items,
        total_price: payload.total_price,
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

