export interface OrderCustomer {
  name: string;
  avatar: string;
}

export interface Product {
  image: string;
  name: string;
  quantity: number;
  price: number;
  sku: number;
}

export interface OrderType {
  id: string;
  customer: OrderCustomer;
  products: Product[];
  status: "Pending" | "Completed" | "Shipped" | "Cancelled" | "Processing";
  date: string;
  time: string;
  amount: number;
  address: string;
}
