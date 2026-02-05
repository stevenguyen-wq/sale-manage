
import React, { useState, useMemo } from 'react';
import { User, Branch } from '../types';
import { getOrders, getCustomers, getUsers } from '../services/mockDataService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Filter, MapPin, Users, Building } from 'lucide-react';

interface Props {
  user: User;
}

const Analysis: React.FC<Props> = ({ user }) => {
  const [filterPeriod, setFilterPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [filterBranch, setFilterBranch] = useState<Branch | 'All'>('All');

  const analysisData = useMemo(() => {
    const orders = getOrders();
    const allUsers = getUsers();
    const now = new Date();

    // 1. Filter Orders
    const filteredOrders = orders.filter(o => {
      const d = new Date(o.date);
      const saleUser = allUsers.find(u => u.id === o.salesId);

      // Role Restriction Logic
      if (user.role === 'manager') {
          // Manager: See orders in branch OR own orders
          // Note: "All" Branch filter implies standard view, but individual restriction still applies if not admin
          const isBranchOrder = saleUser?.branch === user.branch;
          const isOwnOrder = o.salesId === user.id;
          
          if (!isBranchOrder && !isOwnOrder) return false;
      } else if (user.role === 'staff') {
          // Staff: See own orders only (Strictly speaking analysis usually shows personal stats for staff)
          if (o.salesId !== user.id) return false;
      }

      // Period Filter
      let timeMatch = false;
      if (filterPeriod === 'year') {
          timeMatch = d.getFullYear() === now.getFullYear();
      } else if (filterPeriod === 'month') {
          timeMatch = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (filterPeriod === 'week') {
          const past = new Date();
          past.setDate(past.getDate() - 7);
          timeMatch = d >= past;
      }

      // UI Branch Filter (Admin only)
      let branchMatch = true;
      if (user.role === 'admin' && filterBranch !== 'All') {
          branchMatch = saleUser?.branch === filterBranch;
      }
      
      return timeMatch && branchMatch;
    });

    // 2. Aggregate Flavors
    const flavorCounts: Record<string, number> = {};
    filteredOrders.forEach(o => {
        o.iceCreamItems.forEach(i => {
            flavorCounts[i.flavor] = (flavorCounts[i.flavor] || 0) + i.quantity;
        });
    });

    // 3. Aggregate Toppings
    const toppingCounts: Record<string, number> = {};
    filteredOrders.forEach(o => {
        o.toppingItems.forEach(t => {
            toppingCounts[t.name] = (toppingCounts[t.name] || 0) + t.quantity;
        });
    });

    // 4. Sort and Top 5
    const topFlavors = Object.entries(flavorCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const topToppings = Object.entries(toppingCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    
    // 5. Customer Location Analysis (Admin Only)
    let locationData: { name: string, value: number }[] = [];
    let totalProvinces = 0;
    let totalAgents = 0;

    if (user.role === 'admin') {
        const customers = getCustomers();
        totalAgents = customers.length; // Total Customers/Agents

        const locationCounts: Record<string, number> = {};
        
        customers.forEach(c => {
            if (c.address) {
                // Address format is typically "Specific, Ward, District, Province"
                const parts = c.address.split(',');
                if (parts.length > 0) {
                    const province = parts[parts.length - 1].trim();
                    locationCounts[province] = (locationCounts[province] || 0) + 1;
                }
            }
        });
        
        locationData = Object.entries(locationCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); // Sort descending by count
        
        totalProvinces = locationData.length;
    }

    return { topFlavors, topToppings, locationData, totalProvinces, totalAgents };

  }, [filterPeriod, filterBranch, user.role, user.branch, user.id]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-baby-navy">Phân tích hành vi & thị trường</h2>
        
        <div className="flex flex-wrap items-center gap-4">
           {/* Branch Filter for Admin */}
           {user.role === 'admin' && (
               <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-sm">
                    <Filter size={14} className="text-slate-500"/>
                    <select 
                        value={filterBranch}
                        onChange={(e) => setFilterBranch(e.target.value as Branch | 'All')}
                        className="bg-transparent text-slate-700 text-sm focus:outline-none"
                    >
                        <option value="All">Toàn hệ thống</option>
                        <option value="Baby Boss Hội sở">Hội sở</option>
                        <option value="Baby Boss miền Bắc">Miền Bắc</option>
                    </select>
               </div>
           )}

           {/* Period Toggle */}
           <div className="bg-white p-1 rounded-lg border border-slate-300 flex shadow-sm">
                {(['week', 'month', 'year'] as const).map(p => (
                    <button
                        key={p}
                        onClick={() => setFilterPeriod(p)}
                        className={`px-4 py-1.5 text-sm rounded-md capitalize transition-colors ${filterPeriod === p ? 'bg-baby-accent text-white shadow' : 'text-slate-500 hover:text-baby-navy'}`}
                    >
                        {p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Năm'}
                    </button>
                ))}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Flavors Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg">
             <h3 className="text-lg font-bold text-baby-accent mb-2">Top 5 Vị Kem Bán Chạy Nhất</h3>
             <p className="text-xs text-slate-400 mb-6">Tính theo tổng số lượng hộp đã bán</p>
             
             {/* Fixed: Added minWidth={0} to ResponsiveContainer to prevent width(-1) error */}
             <div className="w-full min-w-0" style={{ height: 320 }}>
                {analysisData.topFlavors.length > 0 ? (
                    <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                        <BarChart layout="vertical" data={analysisData.topFlavors} margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                            <XAxis type="number" stroke="#64748b" fontSize={12} />
                            <YAxis dataKey="name" type="category" width={100} stroke="#64748b" fontSize={11} />
                            <Tooltip 
                                cursor={{fill: 'transparent'}}
                                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="value" fill="#db2777" radius={[0, 4, 4, 0]} barSize={30}>
                                {analysisData.topFlavors.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#db2777' : '#be185d'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Chưa có dữ liệu</div>
                )}
             </div>
          </div>

          {/* Top Toppings Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg">
             <h3 className="text-lg font-bold text-baby-accent mb-2">Top 5 Topping & Dụng Cụ</h3>
             <p className="text-xs text-slate-400 mb-6">Tính theo tổng số lượng xuất kho</p>

             {/* Fixed: Added minWidth={0} to ResponsiveContainer to prevent width(-1) error */}
             <div className="w-full min-w-0" style={{ height: 320 }}>
                {analysisData.topToppings.length > 0 ? (
                    <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                        <BarChart layout="vertical" data={analysisData.topToppings} margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                            <XAxis type="number" stroke="#64748b" fontSize={12} />
                            <YAxis dataKey="name" type="category" width={100} stroke="#64748b" fontSize={11} />
                            <Tooltip 
                                cursor={{fill: 'transparent'}}
                                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30}>
                                 {analysisData.topToppings.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#60a5fa'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Chưa có dữ liệu</div>
                )}
             </div>
          </div>

          {/* Customer Location Analysis - Only for Admin */}
          {user.role === 'admin' && (
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg md:col-span-2">
                   <div className="flex items-center gap-3 mb-6">
                        <MapPin className="text-baby-accent" size={24}/>
                        <div>
                            <h3 className="text-lg font-bold text-baby-navy">Mạng lưới phân phối</h3>
                            <p className="text-xs text-slate-500">Thống kê theo địa lý và quy mô đối tác</p>
                        </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Summary Cards */}
                        <div className="space-y-4">
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-500 text-sm font-medium">Tổng số Tỉnh / Thành</span>
                                    <MapPin size={20} className="text-purple-500"/>
                                </div>
                                <div className="text-3xl font-bold text-purple-700">{analysisData.totalProvinces}</div>
                                <div className="text-xs text-slate-500 mt-1">Đã có mặt Baby Boss</div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-500 text-sm font-medium">Tổng Đại lý / Đối tác</span>
                                    <Users size={20} className="text-blue-500"/>
                                </div>
                                <div className="text-3xl font-bold text-blue-700">{analysisData.totalAgents}</div>
                                <div className="text-xs text-slate-500 mt-1">Trên toàn quốc</div>
                            </div>
                        </div>

                        {/* Province List Table */}
                        <div className="md:col-span-1 lg:col-span-2 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                             <div className="px-4 py-3 bg-white border-b border-slate-200 font-bold text-baby-navy text-sm">
                                Danh sách phân bổ theo Tỉnh / Thành
                             </div>
                             <div className="max-h-[300px] overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-500 sticky top-0 backdrop-blur-sm">
                                        <tr>
                                            <th className="px-4 py-2">Tỉnh / Thành phố</th>
                                            <th className="px-4 py-2 text-right">Số lượng khách hàng</th>
                                            <th className="px-4 py-2 text-right">Tỷ trọng</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {analysisData.locationData.length > 0 ? (
                                            analysisData.locationData.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-200/50">
                                                    <td className="px-4 py-2 text-slate-700 font-medium">{item.name}</td>
                                                    <td className="px-4 py-2 text-right text-baby-accent">{item.value}</td>
                                                    <td className="px-4 py-2 text-right text-slate-500">
                                                        {analysisData.totalAgents > 0 ? ((item.value / analysisData.totalAgents) * 100).toFixed(1) : 0}%
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={3} className="p-4 text-center text-slate-500">Chưa có dữ liệu</td></tr>
                                        )}
                                    </tbody>
                                </table>
                             </div>
                        </div>
                   </div>
               </div>
          )}
      </div>
    </div>
  );
};

export default Analysis;
