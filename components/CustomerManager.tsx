import React, { useState, useEffect, useMemo } from 'react';
import { Customer, User, Order, IceCreamLine, IceCreamSize } from '../types';
import { getCustomers, saveCustomer, getOrders, MOCK_USERS, getStaffIdsByBranch } from '../services/mockDataService';
import { Plus, Search, MapPin, Phone, User as UserIcon, Building, Filter, Calendar, X, ArrowLeft, History, DollarSign, Package, Mail, Briefcase, BarChart3, Clock, Pencil, BadgeCheck, FileText } from 'lucide-react';
import { formatCurrency, LINES, SIZES, calculateDaysDifference } from '../constants';

interface Props {
  user: User;
}

// Location Interfaces
interface LocationOption {
    code: number;
    name: string;
}
interface DistrictOption extends LocationOption {
    province_code: number;
    wards: LocationOption[];
}
interface ProvinceDetail extends LocationOption {
    districts: DistrictOption[];
}

const CustomerManager: React.FC<Props> = ({ user }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'detail'>('list');
  
  // Detail View State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerHistory, setCustomerHistory] = useState<Order[]>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<Customer>>({});

  // Address State
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);
  
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>('');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<string>('');
  const [selectedWardCode, setSelectedWardCode] = useState<string>('');
  const [specificAddress, setSpecificAddress] = useState<string>('');

  // Filter State
  const [filterFirstMonth, setFilterFirstMonth] = useState('');
  const [filterLastMonth, setFilterLastMonth] = useState('');
  const [filterProvinceCode, setFilterProvinceCode] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
    // Load Provinces on mount
    fetch('https://provinces.open-api.vn/api/p/')
        .then(res => res.json())
        .then(data => setProvinces(data))
        .catch(err => console.error("Error loading provinces:", err));
  }, [user]);

  const loadData = () => {
    const allCustomers = getCustomers();
    const allOrders = getOrders();

    // Enrich customers with aggregated data
    const enrichedCustomers = allCustomers.map(cust => {
        const custOrders = allOrders.filter(o => o.customerId === cust.id);
        const totalOrders = custOrders.length;
        const totalIceCreamRevenue = custOrders.reduce((acc, o) => acc + o.totalIceCreamRevenue, 0);
        const totalToppingRevenue = custOrders.reduce((acc, o) => acc + o.totalToppingRevenue, 0);
        
        // Revised: Total Boxes should ONLY account for purchased ice cream items, excluding discounts/gifts.
        const totalBoxes = custOrders.reduce((acc, o) => {
             const itemsQty = o.iceCreamItems.reduce((iAcc, i) => iAcc + i.quantity, 0);
             return acc + itemsQty;
        }, 0);
        
        // Sort orders by date
        custOrders.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const firstPurchaseDate = custOrders.length > 0 ? custOrders[0].date : undefined;
        const lastPurchaseDate = custOrders.length > 0 ? custOrders[custOrders.length - 1].date : undefined;

        return {
            ...cust,
            totalOrders,
            totalIceCreamRevenue,
            totalToppingRevenue,
            totalBoxes,
            firstPurchaseDate,
            lastPurchaseDate
        };
    });

    // Filter based on role
    if (user.role === 'admin') {
      setCustomers(enrichedCustomers);
    } else if (user.role === 'manager') {
        const branchStaffIds = getStaffIdsByBranch(user.branch);
        // Manager sees customers of staff in their branch OR their own customers
        setCustomers(enrichedCustomers.filter(c => branchStaffIds.includes(c.salesId) || c.salesId === user.id));
    } else {
      setCustomers(enrichedCustomers.filter(c => c.salesId === user.id));
    }
  };

  // --- Handlers ---

  const handleViewDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    
    // Get History
    const allOrders = getOrders();
    const history = allOrders
        .filter(o => o.customerId === customer.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest first
    
    setCustomerHistory(history);
    setViewMode('detail');
  };

  const handleEditCustomer = (customer: Customer) => {
      setFormData(customer);
      // Note: We don't parse the address back to codes as we don't store codes. 
      // User must re-select address OR we keep the old string if they don't touch it.
      setSpecificAddress(''); // Clear specific address input
      setSelectedProvinceCode('');
      setSelectedDistrictCode('');
      setSelectedWardCode('');
      
      setViewMode('add'); // Use Add view for Edit
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  }

  // Calculate statistics for the selected customer
  const customerStats = useMemo(() => {
    if (!selectedCustomer || customerHistory.length === 0) return null;

    const stats: Record<IceCreamLine, Record<IceCreamSize, number>> = {
        'Pro': { '80g': 0, '500ml': 0, '2700ml': 0, '3500ml': 0 },
        'Promax': { '80g': 0, '500ml': 0, '2700ml': 0, '3500ml': 0 },
    };

    customerHistory.forEach(order => {
        // Only count purchased items for consistency with totalBoxes logic
        order.iceCreamItems.forEach(item => {
            if (stats[item.line] && stats[item.line][item.size] !== undefined) {
                stats[item.line][item.size] += item.quantity;
            }
        });
    });

    return stats;
  }, [customerHistory, selectedCustomer]);


  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const code = e.target.value;
      setSelectedProvinceCode(code);
      setSelectedDistrictCode('');
      setSelectedWardCode('');
      setDistricts([]);
      setWards([]);

      if (code) {
          try {
              const res = await fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`);
              const data: ProvinceDetail = await res.json();
              setDistricts(data.districts);
          } catch (error) {
              console.error("Error loading districts", error);
          }
      }
  };

  const handleDistrictChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const code = e.target.value;
      setSelectedDistrictCode(code);
      setSelectedWardCode('');
      setWards([]);

      if (code) {
          try {
              const res = await fetch(`https://provinces.open-api.vn/api/d/${code}?depth=2`);
              const data = await res.json();
              setWards(data.wards);
          } catch (error) {
               console.error("Error loading wards", error);
          }
      }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Address Logic for Edit vs Create
    let fullAddress = '';
    const isEditing = !!formData.id;

    if (selectedProvinceCode && selectedDistrictCode && selectedWardCode && specificAddress) {
        // Construct new address from selectors
        const pName = provinces.find(p => p.code == Number(selectedProvinceCode))?.name || '';
        const dName = districts.find(d => d.code == Number(selectedDistrictCode))?.name || '';
        const wName = wards.find(w => w.code == Number(selectedWardCode))?.name || '';
        fullAddress = `${specificAddress}, ${wName}, ${dName}, ${pName}`;
    } else if (isEditing && formData.address) {
        // If editing and no new address selected, keep old one
        fullAddress = formData.address;
    } else {
        alert("Vui lòng điền đầy đủ thông tin địa chỉ (Số nhà, Phường/Xã, Quận/Huyện, Tỉnh/Thành).");
        return;
    }

    if (!formData.name || !formData.companyName || !formData.phone) {
      alert("Vui lòng điền các thông tin bắt buộc (Tên, Công ty, SĐT).");
      return;
    }

    const customerToSave: Customer = {
      id: formData.id || Date.now().toString(),
      salesId: formData.salesId || user.id, // Use selected salesId or current user
      createdDate: formData.createdDate || new Date().toISOString().split('T')[0],
      name: formData.name!,
      companyName: formData.companyName!,
      position: formData.position || '',
      phone: formData.phone!,
      email: formData.email || '',
      address: fullAddress,
      repName: formData.repName || '',
      repPhone: formData.repPhone || '',
      repPosition: formData.repPosition || '',
      notes: formData.notes || '', // Save notes
    };

    saveCustomer(customerToSave);
    
    // Cleanup
    setFormData({});
    setSelectedProvinceCode('');
    setSelectedDistrictCode('');
    setSelectedWardCode('');
    setSpecificAddress('');
    
    // If editing, go back to details of that customer (which is updated)
    if (isEditing) {
        setSelectedCustomer(customerToSave);
        setViewMode('detail');
        // Refresh detail view data
        const allOrders = getOrders();
        const history = allOrders.filter(o => o.customerId === customerToSave.id);
        setCustomerHistory(history);
    } else {
        setViewMode('list');
    }
    
    loadData();
  };

  const clearFilters = () => {
      setFilterFirstMonth('');
      setFilterLastMonth('');
      setFilterProvinceCode('');
  };

  // Apply Filters logic
  const filteredCustomers = customers.filter(c => {
      // First Purchase Month Filter
      if (filterFirstMonth) {
          if (!c.firstPurchaseDate) return false;
          // Format YYYY-MM
          const custMonth = c.firstPurchaseDate.substring(0, 7); 
          if (custMonth !== filterFirstMonth) return false;
      }

      // Last Purchase Month Filter
      if (filterLastMonth) {
          if (!c.lastPurchaseDate) return false;
          const custMonth = c.lastPurchaseDate.substring(0, 7);
          if (custMonth !== filterLastMonth) return false;
      }

      // Province Filter
      if (filterProvinceCode) {
          const provinceName = provinces.find(p => p.code == Number(filterProvinceCode))?.name || '';
          // Check if the province name exists in the address string
          if (provinceName && !c.address.toLowerCase().includes(provinceName.toLowerCase())) return false;
      }

      return true;
  });

  // Get staff for Sales Assignment dropdown
  const staffList = MOCK_USERS.filter(u => {
      if(user.role === 'admin') return u.role === 'staff' || u.role === 'manager';
      if(user.role === 'manager') return u.branch === user.branch && (u.role === 'staff' || u.role === 'manager');
      return false;
  });
  const getStaffName = (id: string) => MOCK_USERS.find(u => u.id === id)?.fullName || 'Không xác định';

  return (
    <div className="space-y-6">
      {/* Header with Responsive Layout */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-baby-navy flex items-center gap-2">
            {viewMode === 'detail' && (
                <button onClick={() => setViewMode('list')} className="mr-2 hover:bg-slate-200 p-1 rounded-full transition-colors">
                    <ArrowLeft size={24} className="text-slate-600 hover:text-baby-accent"/>
                </button>
            )}
            {viewMode === 'list' ? 'Danh sách khách hàng' : (formData.id ? 'Cập nhật khách hàng' : 'Chi tiết khách hàng')}
        </h2>
        {viewMode === 'list' && (
          <div className="flex gap-2 w-full md:w-auto">
            <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex-1 md:flex-none justify-center px-4 py-2 rounded-lg flex items-center space-x-2 transition-all border ${showFilters ? 'bg-slate-200 border-baby-accent text-baby-navy' : 'bg-white border-slate-300 text-slate-600 hover:text-baby-navy hover:shadow'}`}
            >
                <Filter size={18} />
                <span>Bộ lọc</span>
            </button>
            <button
                onClick={() => { setFormData({}); setViewMode('add'); }}
                className="flex-1 md:flex-none justify-center bg-baby-accent hover:bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-lg shadow-baby-accent/20"
            >
                <Plus size={18} />
                <span>Thêm mới</span>
            </button>
          </div>
        )}
        {(viewMode === 'add' || viewMode === 'detail') && (
           <button
           onClick={() => setViewMode('list')}
           className="text-slate-500 hover:text-baby-navy px-4 py-2 flex items-center gap-2"
         >
           <ArrowLeft size={18} />
           Quay lại danh sách
         </button>
        )}
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-4">
            {/* Filter Section */}
            {showFilters && (
                <div className="bg-white p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 items-end shadow-sm">
                    <div className="md:col-span-2">
                        <label className="text-xs text-baby-accent font-semibold block mb-1">Tháng đơn đầu tiên</label>
                        <input 
                            type="month" 
                            value={filterFirstMonth}
                            onChange={(e) => setFilterFirstMonth(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-sm text-slate-700 focus:border-baby-accent focus:outline-none" 
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-baby-accent font-semibold block mb-1">Tháng đơn gần nhất</label>
                        <input 
                            type="month" 
                            value={filterLastMonth}
                            onChange={(e) => setFilterLastMonth(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-sm text-slate-700 focus:border-baby-accent focus:outline-none" 
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-baby-accent font-semibold block mb-1">Tỉnh / Thành phố</label>
                        <select 
                            value={filterProvinceCode}
                            onChange={(e) => setFilterProvinceCode(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-sm text-slate-700 focus:border-baby-accent focus:outline-none"
                        >
                            <option value="">Tất cả</option>
                            {provinces.map(p => (
                                <option key={p.code} value={p.code}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-1">
                         <button 
                            onClick={clearFilters}
                            className="w-full py-1.5 text-sm text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 rounded flex items-center justify-center gap-1 transition-colors"
                         >
                            <X size={14}/> Xoá
                         </button>
                    </div>
                </div>
            )}

            {filteredCustomers.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 shadow-sm">
                    {customers.length === 0 ? 'Chưa có khách hàng nào trong dữ liệu.' : 'Không tìm thấy khách hàng phù hợp với bộ lọc.'}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto shadow-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-baby-navy font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Khách hàng</th>
                                <th className="px-4 py-3">Liên hệ</th>
                                <th className="px-4 py-3">Lịch sử mua hàng</th>
                                <th className="px-4 py-3">Ghi chú</th>
                                <th className="px-4 py-3 text-right">Tổng DT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCustomers.map(cust => {
                                return (
                                <tr 
                                    key={cust.id} 
                                    onClick={() => handleViewDetail(cust)}
                                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-800 group-hover:text-baby-accent transition-colors">{cust.companyName}</div>
                                        <div className="text-slate-500 text-xs flex items-center gap-1 mt-1">
                                            <UserIcon size={12}/> {cust.name}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-slate-700 flex items-center gap-2">
                                            <Phone size={14} className="text-baby-accent"/> {cust.phone}
                                        </div>
                                        <div className="text-slate-500 text-xs mt-1 truncate max-w-[200px]" title={cust.address}>
                                            <MapPin size={12} className="inline mr-1"/> {cust.address}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-slate-500 w-16">Gần nhất:</span>
                                            <span className="text-baby-accent">{cust.lastPurchaseDate ? new Date(cust.lastPurchaseDate).toLocaleDateString('vi-VN') : '---'}</span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 border-t border-slate-200 pt-1">
                                            Đã mua: {cust.totalOrders || 0} đơn / <span className="text-slate-800 font-semibold">{cust.totalBoxes || 0} hộp</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate" title={cust.notes}>
                                        {cust.notes ? (
                                            <div className="flex items-center gap-1">
                                                <FileText size={12} className="min-w-[12px]"/> {cust.notes}
                                            </div>
                                        ) : (
                                            <span className="italic opacity-30">Không có</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right text-baby-accent font-bold">
                                        {formatCurrency((cust.totalIceCreamRevenue || 0) + (cust.totalToppingRevenue || 0))}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      ) : viewMode === 'detail' && selectedCustomer ? (
        <div className="space-y-6 animate-fade-in">
             {/* Info Cards */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Card 1: Basic Info */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl col-span-2">
                     <div className="flex flex-col md:flex-row md:items-start justify-between border-b border-slate-200 pb-4 mb-4 gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-baby-navy mb-1">{selectedCustomer.companyName}</h3>
                            <div className="flex items-center gap-2">
                                <span className="bg-baby-accent/10 text-baby-accent text-xs px-2 py-0.5 rounded border border-baby-accent/20">Khách hàng</span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <BadgeCheck size={12} className="text-blue-500"/> Sale: {getStaffName(selectedCustomer.salesId)}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3">
                             <button 
                                onClick={() => handleEditCustomer(selectedCustomer)}
                                className="bg-slate-100 hover:bg-baby-accent hover:text-white text-slate-600 p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium border border-slate-200"
                             >
                                <Pencil size={16}/> Chỉnh sửa
                             </button>
                             <div className="text-right text-xs text-slate-500">
                                Ngày tạo: {selectedCustomer.createdDate}
                             </div>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                         <div className="flex items-start gap-3">
                             <UserIcon className="text-baby-accent mt-0.5" size={18} />
                             <div>
                                 <p className="text-slate-400 text-xs">Người liên hệ chính</p>
                                 <p className="text-slate-800 font-medium">{selectedCustomer.name}</p>
                                 {selectedCustomer.position && <p className="text-slate-500 text-xs">{selectedCustomer.position}</p>}
                             </div>
                         </div>
                         <div className="flex items-start gap-3">
                             <Phone className="text-baby-accent mt-0.5" size={18} />
                             <div>
                                 <p className="text-slate-400 text-xs">Số điện thoại</p>
                                 <p className="text-slate-800 font-medium">{selectedCustomer.phone}</p>
                             </div>
                         </div>
                         <div className="flex items-start gap-3 md:col-span-2">
                             <MapPin className="text-baby-accent mt-0.5" size={18} />
                             <div>
                                 <p className="text-slate-400 text-xs">Địa chỉ</p>
                                 <p className="text-slate-800 font-medium">{selectedCustomer.address}</p>
                             </div>
                         </div>
                         {selectedCustomer.email && (
                            <div className="flex items-start gap-3">
                                <Mail className="text-baby-accent mt-0.5" size={18} />
                                <div>
                                    <p className="text-slate-400 text-xs">Email</p>
                                    <p className="text-slate-800 font-medium">{selectedCustomer.email}</p>
                                </div>
                            </div>
                         )}
                         {/* Display Notes if available */}
                         {selectedCustomer.notes && (
                             <div className="flex items-start gap-3 md:col-span-2 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                 <FileText className="text-yellow-600 mt-0.5" size={18} />
                                 <div>
                                     <p className="text-yellow-700 text-xs font-semibold">Ghi chú</p>
                                     <p className="text-slate-700 text-sm whitespace-pre-wrap">{selectedCustomer.notes}</p>
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>

                 {/* Card 2: Representative & Stats Summary */}
                 <div className="space-y-6">
                    {/* Representative Info */}
                     <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-lg">
                         <h4 className="text-baby-accent font-semibold mb-3 flex items-center gap-2">
                             <Briefcase size={16}/> Người đại diện
                         </h4>
                         {selectedCustomer.repName ? (
                             <div className="space-y-2 text-sm">
                                 <div className="flex justify-between">
                                     <span className="text-slate-500">Họ tên:</span>
                                     <span className="text-slate-800 font-medium">{selectedCustomer.repName}</span>
                                 </div>
                                 <div className="flex justify-between">
                                     <span className="text-slate-500">SĐT:</span>
                                     <span className="text-slate-800 font-medium">{selectedCustomer.repPhone || '---'}</span>
                                 </div>
                                 <div className="flex justify-between">
                                     <span className="text-slate-500">Chức vụ:</span>
                                     <span className="text-slate-800 font-medium">{selectedCustomer.repPosition || '---'}</span>
                                 </div>
                             </div>
                         ) : (
                             <p className="text-slate-400 text-sm italic">Chưa có thông tin</p>
                         )}
                     </div>
                     
                     {/* Quick Stats */}
                     <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-blue-100 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-baby-accent text-sm font-medium">Tổng chi tiêu</span>
                            <DollarSign size={18} className="text-baby-accent"/>
                        </div>
                        <div className="text-2xl font-bold text-baby-navy mb-4">
                            {formatCurrency((selectedCustomer.totalIceCreamRevenue || 0) + (selectedCustomer.totalToppingRevenue || 0))}
                        </div>
                        <div className="flex items-center justify-between text-sm border-t border-blue-200 pt-2">
                            <span className="text-slate-500">Tổng đơn hàng</span>
                            <span className="text-slate-800 font-bold">{selectedCustomer.totalOrders} đơn</span>
                        </div>
                        <div className="flex items-center justify-between text-sm pt-2">
                            <span className="text-slate-500">Tổng sản lượng</span>
                            {/* Display pure purchase quantity */}
                            <span className="text-slate-800 font-bold">{selectedCustomer.totalBoxes} hộp</span>
                        </div>
                     </div>
                 </div>
             </div>

             {/* Detailed Consumption Stats by Line/Size */}
             {customerStats && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50">
                        <BarChart3 size={20} className="text-baby-accent"/>
                        <h3 className="text-lg font-semibold text-baby-navy">Thống kê sản lượng tiêu thụ (Hàng bán)</h3>
                    </div>
                    <div className="p-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr>
                                        <th className="text-left p-3 border-b border-slate-200 text-slate-500">Dòng / Size</th>
                                        {SIZES.map(size => (
                                            <th key={size} className="p-3 border-b border-slate-200 text-baby-navy font-bold text-center">{size}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {LINES.map(line => (
                                        <tr key={line} className="hover:bg-slate-50">
                                            <td className="p-3 border-b border-slate-100 font-bold text-baby-accent">{line}</td>
                                            {SIZES.map(size => (
                                                <td key={size} className="p-3 border-b border-slate-100 text-center text-slate-700">
                                                    {customerStats[line][size] > 0 ? (
                                                        <span className="text-white font-bold bg-slate-400 px-2 py-1 rounded">{customerStats[line][size]}</span>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-500 mt-3 italic">* Đơn vị tính: Hộp (Chỉ tính hàng bán, không bao gồm chiết khấu)</p>
                    </div>
                </div>
             )}

             {/* Order History Table */}
             <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                 <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50">
                     <History size={20} className="text-slate-500"/>
                     <h3 className="text-lg font-semibold text-baby-navy">Lịch sử đơn hàng</h3>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-baby-navy font-medium">
                            <tr>
                                <th className="px-4 py-3">Ngày đặt</th>
                                <th className="px-4 py-3 text-center">SL Hộp</th>
                                <th className="px-4 py-3">Chi tiết hàng hoá</th>
                                <th className="px-4 py-3 text-right">Giá trị đơn</th>
                                <th className="px-4 py-3 text-center">Hoá đơn</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {customerHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Chưa có lịch sử mua hàng.</td>
                                </tr>
                            ) : (
                                customerHistory.map(order => (
                                    <tr key={order.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-mono text-slate-600">{order.date}</td>
                                        <td className="px-4 py-3 text-center text-slate-800 font-semibold">{order.totalQuantity}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-xs text-slate-500 max-w-xs truncate">
                                                {order.iceCreamItems.map(i => `${i.line} ${i.flavor}`).join(', ')}
                                                {order.toppingItems.length > 0 && `, ${order.toppingItems.length} topping`}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-baby-accent">
                                            {formatCurrency(order.totalRevenue)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {order.hasInvoice ? 
                                                <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Có</span> : 
                                                <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">Không</span>
                                            }
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                 </div>
             </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 max-w-4xl mx-auto space-y-6 shadow-xl">
            {/* ... Existing Add Form ... */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-baby-accent border-b border-slate-200 pb-2">Thông tin bắt buộc</h3>
                    <div>
                        <label className="block text-sm text-slate-500 mb-1">Tên khách hàng *</label>
                        <input name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:border-baby-accent focus:outline-none" required />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-500 mb-1">Tên Công ty/Cửa hàng *</label>
                        <input name="companyName" value={formData.companyName || ''} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:border-baby-accent focus:outline-none" required />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-500 mb-1">Số điện thoại *</label>
                        <input name="phone" value={formData.phone || ''} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:border-baby-accent focus:outline-none" required />
                    </div>

                    {/* Sales Assignment */}
                    <div>
                        <label className="block text-sm text-slate-500 mb-1">Nhân viên phụ trách</label>
                        <select 
                            name="salesId" 
                            value={formData.salesId || user.id} 
                            onChange={handleSelectChange}
                            disabled={user.role === 'staff'}
                            className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:border-baby-accent focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                        >
                            {staffList.map(staff => (
                                <option key={staff.id} value={staff.id}>{staff.fullName} ({staff.branch})</option>
                            ))}
                        </select>
                        {user.role === 'staff' && (
                            <p className="text-[10px] text-slate-400 mt-1 italic">* Bạn không có quyền thay đổi thông tin này</p>
                        )}
                    </div>
                    
                    {/* New Address Block */}
                    <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="block text-sm font-semibold text-slate-700">
                            Địa chỉ {formData.id ? '(Chọn lại nếu muốn thay đổi)' : '*'}
                        </label>
                        
                        {formData.id && (
                             <p className="text-xs text-baby-accent mb-2 truncate">Hiện tại: {formData.address}</p>
                        )}
                        
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className="text-xs text-slate-500 block mb-1">Tỉnh / Thành phố</label>
                                <select 
                                    className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-700 focus:border-baby-accent outline-none"
                                    value={selectedProvinceCode}
                                    onChange={handleProvinceChange}
                                >
                                    <option value="">-- Chọn Tỉnh/Thành --</option>
                                    {provinces.map(p => (
                                        <option key={p.code} value={p.code}>{p.name}</option>
                                    ))}
                                </select>
                             </div>
                             <div>
                                <label className="text-xs text-slate-500 block mb-1">Quận / Huyện</label>
                                <select 
                                    className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-700 focus:border-baby-accent outline-none disabled:bg-slate-100"
                                    value={selectedDistrictCode}
                                    onChange={handleDistrictChange}
                                    disabled={!selectedProvinceCode}
                                >
                                    <option value="">-- Chọn Quận/Huyện --</option>
                                    {districts.map(d => (
                                        <option key={d.code} value={d.code}>{d.name}</option>
                                    ))}
                                </select>
                             </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Phường / Xã</label>
                                <select 
                                    className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-700 focus:border-baby-accent outline-none disabled:bg-slate-100"
                                    value={selectedWardCode}
                                    onChange={(e) => setSelectedWardCode(e.target.value)}
                                    disabled={!selectedDistrictCode}
                                >
                                    <option value="">-- Chọn Phường/Xã --</option>
                                    {wards.map(w => (
                                        <option key={w.code} value={w.code}>{w.name}</option>
                                    ))}
                                </select>
                             </div>
                             <div>
                                 <label className="text-xs text-slate-500 block mb-1">Số nhà, tên đường</label>
                                 <input 
                                    value={specificAddress}
                                    onChange={(e) => setSpecificAddress(e.target.value)}
                                    placeholder="VD: Số 10, Ngõ 5..."
                                    className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-700 focus:border-baby-accent outline-none"
                                 />
                             </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-baby-accent border-b border-slate-200 pb-2">Thông tin bổ sung</h3>
                    <div>
                        <label className="block text-sm text-slate-500 mb-1">Chức vụ</label>
                        <input name="position" value={formData.position || ''} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:border-baby-accent focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-500 mb-1">Email</label>
                        <input name="email" type="email" value={formData.email || ''} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:border-baby-accent focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-500 mb-1">Ghi chú về khách hàng</label>
                        <textarea 
                            name="notes" 
                            rows={3}
                            value={formData.notes || ''} 
                            onChange={handleInputChange} 
                            placeholder="Nhập các lưu ý quan trọng (sở thích, thói quen, lịch hẹn...)"
                            className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:border-baby-accent focus:outline-none" 
                        />
                    </div>
                    <div className="pt-2 border-t border-slate-200 mt-2">
                        <label className="block text-sm text-slate-500 mb-1">Người đại diện (nếu có)</label>
                        <input name="repName" value={formData.repName || ''} placeholder="Họ tên" onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:border-baby-accent focus:outline-none mb-2" />
                        <div className="grid grid-cols-2 gap-2">
                            <input name="repPhone" value={formData.repPhone || ''} placeholder="SĐT Đại diện" onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:border-baby-accent focus:outline-none" />
                            <input name="repPosition" value={formData.repPosition || ''} placeholder="Chức vụ" onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:border-baby-accent focus:outline-none" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
                <button type="submit" className="bg-baby-accent text-white font-bold py-2 px-6 rounded-lg hover:bg-pink-600 transition-colors shadow-md">
                    {formData.id ? 'Lưu Thay Đổi' : 'Lưu Khách Hàng'}
                </button>
            </div>
        </form>
      )}
    </div>
  );
};

export default CustomerManager;