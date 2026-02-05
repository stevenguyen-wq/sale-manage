
import React, { useState, useEffect } from 'react';
import { User, ViewState } from './types';
import { getUsers, seedData, refreshUsersFromCloud } from './services/mockDataService';
import Layout from './components/Layout';
import CustomerManager from './components/CustomerManager';
import OrderEntry from './components/OrderEntry';
import Reports from './components/Reports';
import Analysis from './components/Analysis';
import ChangePasswordModal from './components/ChangePasswordModal';
import { IceCream, Loader2, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSyncing, setIsSyncing] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    const initApp = async () => {
        setIsSyncing(true);
        // Tải dữ liệu User từ Google Sheet về LocalStorage
        await seedData(); 
        
        // Check loaded users for debugging
        const loadedUsers = getUsers();
        if (loadedUsers.length === 0) {
            setDebugInfo('Chưa tải được danh sách nhân viên từ Google Sheet. Vui lòng kiểm tra lại kết nối hoặc Sheet "NHAN_VIEN".');
        } else {
            console.log(`Loaded ${loadedUsers.length} users form storage.`);
        }

        setIsSyncing(false);
    };
    initApp();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Lấy danh sách user mới nhất từ LocalStorage (đã được sync)
    const allUsers = getUsers();
    
    if (allUsers.length === 0) {
        setError('Hệ thống chưa có dữ liệu nhân viên. Vui lòng F5 để tải lại.');
        return;
    }

    const foundUser = allUsers.find(u => 
        u.username && u.username.toLowerCase() === username.toLowerCase() && 
        u.password === password
    );
    
    if (foundUser) {
      setUser(foundUser);
      setError('');
    } else {
      setError('Sai tên đăng nhập hoặc mật khẩu');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUsername('');
    setPassword('');
    setCurrentView('dashboard');
    setShowPasswordModal(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-baby-pastel relative overflow-hidden">
        {/* Abstract shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
             <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/30 rounded-full blur-[100px]"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-pink-200/30 rounded-full blur-[100px]"></div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 w-full max-w-md relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 shadow-sm">
                <IceCream size={32} className="text-baby-accent" />
            </div>
            <h1 className="text-3xl font-bold text-baby-navy">Baby Boss JSC</h1>
            <p className="text-slate-500 text-sm mt-1">Hệ thống quản lý bán hàng</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Tên đăng nhập</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-baby-accent focus:ring-1 focus:ring-baby-accent transition-all"
                placeholder="username"
                disabled={isSyncing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-baby-accent focus:ring-1 focus:ring-baby-accent transition-all"
                placeholder="••••••"
                disabled={isSyncing}
              />
            </div>
            
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {debugInfo && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs p-3 rounded-lg flex gap-2">
                    <AlertCircle size={16} className="min-w-[16px]" />
                    <span>{debugInfo}</span>
                </div>
            )}
            
            <button
              type="submit"
              disabled={isSyncing}
              className="w-full bg-baby-accent text-white font-bold py-3 rounded-lg hover:bg-pink-600 transition-colors shadow-lg shadow-baby-accent/25 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {isSyncing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Đang tải dữ liệu...</span>
                  </>
              ) : (
                  <span>Đăng nhập</span>
              )}
            </button>
          </form>
        </div>
        <footer className="absolute bottom-4 text-xs text-slate-500">
          © 2026 Baby Boss JSC., All rights reserved.
        </footer>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Reports user={user} viewMode="dashboard" />;
      case 'customers':
        return <CustomerManager user={user} />;
      case 'new-order':
        return <OrderEntry user={user} onOrderComplete={() => setCurrentView('sales-log')} />;
      case 'sales-log':
        return <Reports user={user} viewMode="log" />;
      case 'summary':
        return <Reports user={user} viewMode="revenue_report" />;
      case 'analysis':
        return <Analysis user={user} />;
      default:
        return <div>Comming Soon</div>;
    }
  };

  return (
    <>
      <Layout 
        user={user} 
        currentView={currentView} 
        onNavigate={setCurrentView}
        onLogout={handleLogout}
        onChangePassword={() => setShowPasswordModal(true)}
      >
        {renderContent()}
      </Layout>

      {showPasswordModal && (
        <ChangePasswordModal 
          user={user} 
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => {
             // Optional: Log user out to force re-login with new password
             // handleLogout();
          }}
        />
      )}
    </>
  );
};

export default App;
