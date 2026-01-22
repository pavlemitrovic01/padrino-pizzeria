// src/types/menu-db.ts

export type MenuCategory = "PIZZA" | "PASTA";

export interface MenuItemDB {
  id: string;          // uuid iz Supabase
  name: string;
  description: string;
  price: number;       // int4
  image: string;       // path iz baze
  category: MenuCategory;
}
