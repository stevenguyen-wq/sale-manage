
import { User, Customer, Order, Branch } from '../types';
import { syncToGoogleSheets, fetchUsersFromSheet } from './googleSheetService';

// Initial Users Data
// EMPTY - All users come from Google Sheet now
const INITIAL_USERS: User[] = [];

// Local Storage Keys
const KEY_CUSTOMERS = 'babyboss_customers';
const KEY_ORDERS = 'babyboss_orders';
const KEY_USERS = 'babyboss_users';

// --- USER MANAGEMENT ---

export const getUsers = (): User[] => {
  const data = localStorage.getItem(KEY_USERS);
  if (data) {
    return JSON.parse(data);
  }
  return INITIAL_USERS;
};

// Hàm mới để đồng bộ User từ Sheet về App khi khởi động
export const refreshUsersFromCloud = async (): Promise<boolean> => {
    const cloudUsers = await fetchUsersFromSheet();
    if (cloudUsers && cloudUsers.length > 0) {
        localStorage.setItem(KEY_USERS, JSON.stringify(cloudUsers));
        return true;
    }
    return false;
};

export const updateUserPassword = async (userId: string, newPass: string): Promise<boolean> => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  
  if (index >= 0) {
    // 1. Update Local
    users[index].password = newPass;
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
    
    // 2. Sync to Google Sheets
    // Note: We send the specific user object that changed
    await syncToGoogleSheets('sync_users', users[index]);
    
    return true;
  }
  return false;
};

// Export for backward compatibility if needed, but prefer getUsers()
export const MOCK_USERS = INITIAL_USERS; 

// --- CUSTOMER MANAGEMENT ---

export const getCustomers = (): Customer[] => {
  const data = localStorage.getItem(KEY_CUSTOMERS);
  return data ? JSON.parse(data) : [];
};

export const saveCustomer = (customer: Customer): void => {
  const current = getCustomers();
  const index = current.findIndex(c => c.id === customer.id);
  
  if (index >= 0) {
    // Update existing
    current[index] = customer;
    localStorage.setItem(KEY_CUSTOMERS, JSON.stringify(current));
  } else {
    // Create new
    const updated = [...current, customer];
    localStorage.setItem(KEY_CUSTOMERS, JSON.stringify(updated));
  }

  // --- SYNC TO GOOGLE SHEETS ---
  syncToGoogleSheets('sync_customers', customer);
};

// --- ORDER MANAGEMENT ---

export const getOrders = (): Order[] => {
  const data = localStorage.getItem(KEY_ORDERS);
  return data ? JSON.parse(data) : [];
};

export const saveOrder = (order: Order): void => {
  const current = getOrders();
  const updated = [...current, order];
  localStorage.setItem(KEY_ORDERS, JSON.stringify(updated));
  
  // --- SYNC TO GOOGLE SHEETS ---
  syncToGoogleSheets('sync_orders', order);
};

export const getStaffIdsByBranch = (branch: Branch): string[] => {
    return getUsers().filter(u => u.branch === branch).map(u => u.id);
};

// Helper to seed data if empty
export const seedData = async () => {
  // Ensure users are initialized in LocalStorage from Cloud
  await refreshUsersFromCloud();
  
  // No longer seeding demo customers or users
};
