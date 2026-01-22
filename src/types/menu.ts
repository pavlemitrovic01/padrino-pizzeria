// src/types/menu.ts

import { MenuCategory } from "./menu-db";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: MenuCategory;
}

export interface CartItem extends MenuItem {
  quantity: number;
}
