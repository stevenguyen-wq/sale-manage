export type Role = 'staff' | 'manager' | 'admin';
export type Branch = 'Baby Boss Hội sở' | 'Baby Boss miền Bắc';

export interface User {
  id: string;
  fullName: string;
  phone: string;
  position: string;
  username: string;
  password?: string;
  role: Role;
  branch: Branch;
}

export interface Customer {
  id: string;
  salesId: string; // User ID of the sales staff responsible
  createdDate: string;
  name: string; // Customer Name
  companyName: string;
  position?: string;
  phone: string;
  email?: string;
  address: string;
  repName?: string;
  repPhone?: string;
  repPosition?: string;
  notes?: string; // New field for customer notes
  // Computed fields for summary
  totalOrders?: number;
  totalIceCreamRevenue?: number;
  totalToppingRevenue?: number;
  lastPurchaseDate?: string;
  firstPurchaseDate?: string;
  totalBoxes?: number;
}

export type IceCreamLine = 'Pro' | 'Promax';
export type IceCreamSize = '80g' | '500ml' | '2700ml' | '3500ml';

export interface IceCreamItem {
  id: string;
  line: IceCreamLine;
  size: IceCreamSize;
  flavor: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
}

export interface ToppingItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
}

export interface Order {
  id: string;
  salesId: string;
  customerId: string;
  customerName: string;
  companyName: string;
  date: string; // ISO Date
  hasInvoice: boolean;
  
  // Purchased Items
  iceCreamItems: IceCreamItem[];
  toppingItems: ToppingItem[];
  
  // New: Discount & Gifts
  discountItems?: IceCreamItem[]; // Same structure but price/total is usually 0 or tracked separately
  giftItems?: ToppingItem[];      // First order gifts
  
  // Computed totals
  totalIceCreamRevenue: number;
  totalToppingRevenue: number;
  totalRevenue: number; // Sales Revenue (Product only)
  totalQuantity: number; // Boxes
  
  // New: Shipping & Final Amount
  shippingCost?: number; // 3rd party cost
  finalAmount?: number; // totalRevenue + shippingCost
  
  // New: Deposit
  depositAmount?: number;
}

export type ViewState = 'dashboard' | 'customers' | 'new-order' | 'sales-log' | 'summary' | 'analysis';