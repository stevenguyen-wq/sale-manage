
// URL Web App từ Google Apps Script của bạn
// LƯU Ý: Đảm bảo bạn đã Deploy lại Google Script sau khi cập nhật Code.gs
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbydhDn2A9Z1aki3i08BQ4UkH0SsHGpbVSkro3z0w5JfHJtQmyMAOFW-SDC9Ie8cg3hF/exec";

export const syncToGoogleSheets = async (
  action: 'sync_customers' | 'sync_orders' | 'sync_users',
  data: any
) => {
  try {
    // Google Apps Script Web App thường yêu cầu no-cors hoặc redirect handling
    // Tuy nhiên để lấy kết quả trả về, ta cần cors.
    // Đảm bảo script trả về ContentService.createTextOutput...setMimeType(JSON)
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      // Sử dụng mode 'no-cors' sẽ không đọc được response, nên ta dùng default cors
      // Yêu cầu Backend phải handle OPTIONS hoặc trả về đúng headers (GAS tự động xử lý cái này khá tốt)
      headers: {
        "Content-Type": "text/plain;charset=utf-8", // GAS yêu cầu text/plain để không trigger preflight OPTIONS phức tạp
      },
      body: JSON.stringify({ action, data }),
    });

    const result = await response.json();
    console.log(`[GoogleSheet] Synced ${action}:`, result);
    return result;
  } catch (error) {
    console.error(`[GoogleSheet] Error syncing ${action}:`, error);
  }
};

// Generic fetch function for GET requests
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
