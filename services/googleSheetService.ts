
// URL Web App từ Google Apps Script của bạn
// LƯU Ý: Đảm bảo bạn đã Deploy lại Google Script sau khi cập nhật Code.gs
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbydhDn2A9Z1aki3i08BQ4UkH0SsHGpbVSkro3z0w5JfHJtQmyMAOFW-SDC9Ie8cg3hF/exec";

export const syncToGoogleSheets = async (
  action: 'sync_customers' | 'sync_orders' | 'sync_users',
  data: any
) => {
  try {
    // Sử dụng mode 'no-cors' để tránh lỗi chặn CORS từ trình duyệt khi gọi Google Apps Script
    // Lưu ý: Với no-cors, chúng ta KHÔNG THỂ đọc nội dung phản hồi (response.json() sẽ lỗi)
    // Chúng ta chấp nhận mô hình "Fire and Forget" (Gửi và quên)
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors", 
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, data }),
    });

    console.log(`[GoogleSheet] Synced ${action} (No-CORS sent)`);
    return { success: true }; // Giả định thành công vì không đọc được lỗi
  } catch (error) {
    console.error(`[GoogleSheet] Error syncing ${action}:`, error);
    // Vẫn trả về true để không chặn luồng UI, vì dữ liệu đã lưu ở LocalStorage
    return { success: false, error };
  }
};

// Generic fetch function for GET requests (GET vẫn dùng CORS bình thường để đọc dữ liệu về)
export const fetchFromSheet = async (action: string) => {
  try {
    console.log(`[GoogleSheet] Fetching ${action}...`);
    // Thêm timestamp để tránh caching của trình duyệt
    const timestamp = new Date().getTime();
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=${action}&_t=${timestamp}`);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[GoogleSheet] ${action} fetched:`, result);
    
    // Check format of response
    if (Array.isArray(result)) {
        return result;
    } else if (result && Array.isArray(result.data)) {
        return result.data;
    }
    
    return [];
  } catch (error) {
    console.error(`[GoogleSheet] Error fetching ${action}:`, error);
    return [];
  }
};

// Hàm lấy danh sách User từ Sheet NHAN_VIEN
export const fetchUsersFromSheet = async () => {
  return await fetchFromSheet('get_users');
};
