
import React from 'react';
import { User, Branch } from '../types';
import { MOCK_USERS } from '../services/mockDataService';
import { X, SlidersHorizontal } from 'lucide-react';

interface ReportsFilterProps {
  user: User;
  viewMode: 'dashboard' | 'log' | 'revenue_report';
  filterType: 'week' | 'month' | 'year';
  setFilterType: (val: 'week' | 'month' | 'year') => void;
  reportMonth: number;
  setReportMonth: (val: number) => void;
  reportYear: number;
  setReportYear: (val: number) => void;
  filterBranch: Branch | 'All';
  setFilterBranch: (val: Branch | 'All') => void;
  filterEmployeeId: string;
  setFilterEmployeeId: (val: string) => void;
  showFilters: boolean;
  setShowFilters: (val: boolean) => void;
}

const ReportsFilter: React.FC<ReportsFilterProps> = ({
  user,
  viewMode,
  filterType,
  setFilterType,
  reportMonth,
  setReportMonth,
  reportYear,
  setReportYear,
  filterBranch,
  setFilterBranch,
  filterEmployeeId,
  setFilterEmployeeId,
  showFilters,
  setShowFilters,
}) => {
    
  // Calculate employees list based on role
  const employees = MOCK_USERS.filter(u => {
      if (user.role === 'admin') return true;
      if (user.role === 'manager') return u.branch === user.branch;
      return false;
  });

  // Current Filter Summary Text
  let summaryText = "";
  if (viewMode === 'revenue_report') {
      summaryText = `Tháng ${reportMonth}/${reportYear}`;
  } else {
      if (filterType === 'week') summaryText = "Tuần này";
      else if (filterType === 'month') summaryText = "Tháng này";
      else summaryText = "Năm nay";
  }
  
  if (user.role === 'admin' || user.role === 'manager') {
      if (filterBranch !== 'All' || filterEmployeeId !== 'All') {
          summaryText += " (Có lọc nâng cao)";
      }
  }

  return (
    <div className="mb-6">
        <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
             <div className="text-sm text-slate-500 pl-2">
                <span className="hidden md:inline">Đang xem: </span>
                <span className="text-baby-navy font-bold">{summaryText}</span>
             </div>
             <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                    showFilters 
                    ? 'bg-baby-accent border-baby-accent text-white shadow-lg shadow-baby-accent/20' 
                    : 'bg-white border-slate-300 text-slate-600 hover:text-baby-navy hover:border-slate-400 hover:shadow'
                }`}
            >
                {showFilters ? <X size={16} /> : <SlidersHorizontal size={16} />}
                <span className="text-sm font-medium">{showFilters ? 'Đóng bộ lọc' : 'Bộ lọc'}</span>
            </button>
        </div>

        {showFilters && (
            <div className="mt-2 bg-white p-6 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in shadow-xl">
                {/* Time Filters */}
                <div className="md:col-span-2 lg:col-span-1">
                     <label className="text-xs font-bold text-baby-accent uppercase tracking-wider mb-3 block">Thời gian</label>
                     {viewMode === 'revenue_report' ? (
                        <div className="flex gap-2">
                            <div className="w-1/2">
                                <label className="text-xs text-slate-500 block mb-1">Tháng</label>
                                <select 
                                    value={reportMonth} 
                                    onChange={(e) => setReportMonth(Number(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:border-baby-accent focus:outline-none"
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>Tháng {m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-1/2">
                                <label className="text-xs text-slate-500 block mb-1">Năm</label>
                                <select 
                                    value={reportYear} 
                                    onChange={(e) => setReportYear(Number(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:border-baby-accent focus:outline-none"
                                >
                                    {[2024, 2025, 2026].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                     ) : (
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            {(['week', 'month', 'year'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setFilterType(p)}
                                    className={`flex-1 py-1.5 text-sm rounded-md capitalize transition-colors ${
                                        filterType === p 
                                        ? 'bg-white text-baby-navy border border-slate-200 shadow font-medium' 
                                        : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    {p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Năm'}
                                </button>
                            ))}
                        </div>
                     )}
                </div>

                {/* Admin Filters */}
                {(user.role === 'admin' || user.role === 'manager') && (
                    <>
                        <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-baby-accent uppercase tracking-wider mb-3 block">Chi nhánh & Nhân sự</label>
                                <div className="space-y-3">
                                    {user.role === 'admin' && (
                                        <div>
                                             <select 
                                                value={filterBranch}
                                                onChange={(e) => setFilterBranch(e.target.value as Branch | 'All')}
                                                className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded px-3 py-2 focus:outline-none focus:border-baby-accent"
                                            >
                                                <option value="All">Tất cả chi nhánh</option>
                                                <option value="Baby Boss Hội sở">Baby Boss Hội sở</option>
                                                <option value="Baby Boss miền Bắc">Baby Boss miền Bắc</option>
                                            </select>
                                        </div>
                                    )}
                                    <div>
                                        <select 
                                            value={filterEmployeeId}
                                            onChange={(e) => setFilterEmployeeId(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded px-3 py-2 focus:outline-none focus:border-baby-accent"
                                        >
                                            <option value="All">Tất cả nhân viên</option>
                                            {employees.map(u => (
                                                <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-end pb-1">
                                {(filterBranch !== 'All' || filterEmployeeId !== 'All') && (
                                    <button 
                                        onClick={() => {setFilterBranch('All'); setFilterEmployeeId('All');}}
                                        className="text-sm text-red-500 hover:text-red-700 flex items-center gap-2 px-3 py-2 rounded hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                                    >
                                        <X size={16}/> Xoá bộ lọc nâng cao
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}
    </div>
  );
};

export default ReportsFilter;
