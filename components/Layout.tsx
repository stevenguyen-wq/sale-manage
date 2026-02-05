
import React, { useState, useEffect } from 'react';
import { User, ViewState } from '../types';
import { 
  LogOut, 
  Users, 
  ShoppingCart, 
  FileText, 
  BarChart3, 
  IceCream,
  PieChart,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Settings
} from 'lucide-react';

interface LayoutProps {
  user: User;
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onLogout: () => void;
  onChangePassword: () => void; // New Prop
}

const Layout: React.FC<LayoutProps> = ({ user, children, currentView, onNavigate, onLogout, onChangePassword }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Handle responsiveness
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Set initial state
    handleResize();
    
    // Add resize listener
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => {
        onNavigate(view);
        // On mobile, auto-close sidebar after navigation for better UX
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 whitespace-nowrap ${
        currentView === view 
          ? 'bg-baby-accent text-white font-bold shadow-lg shadow-baby-accent/30' 
          : 'text-white hover:text-baby-accent hover:bg-slate-800/50'
      }`}
    >
      <Icon size={20} className="min-w-[20px]" />
      <span className={`transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-baby-pastel overflow-hidden">
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Navy Background */}
      <aside 
        className={`bg-baby-navy border-r border-slate-700 flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 z-50 fixed inset-y-0 left-0 md:relative ${
          isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full opacity-0 overflow-hidden border-none'
        }`}
      >
        <div className="p-4 border-b border-slate-700 flex items-center justify-between whitespace-nowrap overflow-hidden">
          <div className="flex items-center space-x-2 text-white">
            <IceCream size={24} className="text-baby-accent min-w-[24px]" />
            <h1 className="text-xl font-bold font-sans">Baby Boss JSC</h1>
          </div>
          {/* Close Button Inside Sidebar Header */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 text-slate-400 hover:text-baby-accent hover:bg-slate-800 rounded-lg transition-colors"
            title="Thu gọn menu"
          >
            <PanelLeftClose size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-700 bg-slate-800/50 whitespace-nowrap overflow-hidden">
          <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
          <div className="flex items-center justify-between mt-0.5">
             <div>
                <p className="text-xs text-baby-accent truncate">{user.position}</p>
                <p className="text-xs text-slate-400 truncate w-40">{user.branch}</p>
             </div>
             <button 
                onClick={onChangePassword}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
                title="Đổi mật khẩu"
             >
                 <Settings size={16} />
             </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
          <NavItem view="dashboard" icon={BarChart3} label="Tổng quan" />
          <NavItem view="customers" icon={Users} label="Khách hàng" />
          <NavItem view="new-order" icon={ShoppingCart} label="Tạo đơn hàng" />
          <NavItem view="sales-log" icon={FileText} label="Nhật ký bán hàng" />
          <NavItem view="summary" icon={BarChart3} label="Tổng doanh số" />
          {(user.role === 'admin' || user.role === 'manager') && (
            <NavItem view="analysis" icon={PieChart} label="Phân tích" />
          )}
        </nav>

        <div className="p-4 border-t border-slate-700 whitespace-nowrap overflow-hidden">
          <button 
            onClick={onLogout}
            className="w-full flex items-center space-x-2 px-4 py-2 text-slate-400 hover:text-baby-accent transition-colors"
          >
            <LogOut size={18} className="min-w-[18px]" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300 bg-baby-pastel">
        
        {/* Mobile Header Bar - Visible only on mobile */}
        <div className="md:hidden flex items-center justify-between bg-white px-4 py-3 border-b border-slate-200 sticky top-0 z-30 shadow-sm">
            <button 
                onClick={() => setIsSidebarOpen(true)}
                className="text-baby-navy hover:text-baby-accent transition-colors"
            >
                <Menu size={24} />
            </button>
            <div className="flex items-center gap-2 font-bold text-baby-navy">
                <IceCream size={20} className="text-baby-accent" />
                <span>Baby Boss JSC</span>
            </div>
            <div className="w-6"></div> {/* Spacer for center alignment */}
        </div>

        {/* Desktop Open Button (Floating) - Only visible on desktop when sidebar is closed */}
        {!isSidebarOpen && (
            <div className="hidden md:block absolute top-4 left-4 z-50">
            <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-white border border-slate-200 text-baby-navy hover:text-baby-accent hover:shadow-md rounded-lg shadow transition-all"
                title="Mở menu"
            >
                <PanelLeftOpen size={20} />
            </button>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
            {/* Background elements for aesthetic - subtle pastel blobs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl -z-10 pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-100/50 rounded-full blur-3xl -z-10 pointer-events-none -translate-x-1/2 translate-y-1/2"></div>
            
            {children}
        </div>

        {/* Footer */}
        <footer className="py-3 px-6 bg-white border-t border-slate-200 text-center z-10 shadow-sm hidden md:block">
          <p className="text-xs text-slate-500 font-medium">
            © 2026 Baby Boss JSC., All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Layout;
