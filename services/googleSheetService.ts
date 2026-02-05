
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

// Hàm mới để lấy danh sách User từ Sheet NHAN_VIEN
export const fetchUsersFromSheet = async () => {
  try {
    console.log("[GoogleSheet] Fetching users...");
    // Sử dụng fetch GET
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_users`);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("[GoogleSheet] Users fetched:", result);
    
    // Google Script trả về mảng trực tiếp [ {}, {} ] hoặc object { data: [] } tùy cách viết
    // Code GAS ở bước 1 trả về mảng trực tiếp
    if (Array.isArray(result)) {
        return result;
    } else if (result && Array.isArray(result.data)) {
        return result.data;
    }
    
    return [];
  } catch (error) {
    console.error("[GoogleSheet] Error fetching users:", error);
    return [];
  }
};
