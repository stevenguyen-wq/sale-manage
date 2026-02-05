
import React, { useState, useEffect, useMemo } from 'react';
import { User, Order, Branch, IceCreamItem, ToppingItem } from '../types';
import { getOrders, getUsers, getStaffIdsByBranch, refreshOrdersFromCloud } from '../services/mockDataService';
import { formatCurrency, formatNumber, removeVietnameseTones, COMPANY_LOGO_BASE64 } from '../constants';
import { DollarSign, Package, X, Eye, FileDown, User as UserIcon, Building, Calendar, Trophy, Medal, Truck, Check, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReportsFilter from './ReportsFilter';

interface Props {
  user: User;
  viewMode: 'dashboard' | 'log' | 'revenue_report';
}

const Reports: React.FC<Props> = ({ user, viewMode }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dashboard/Log Filters
  const [filterType, setFilterType] = useState<'week' | 'month' | 'year'>('month');
  
  // Revenue Report Specific Filters (Month & Year Select)
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());

  const [filterBranch, setFilterBranch] = useState<Branch | 'All'>('All');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('All');
  
  // UI State
  const [showFilters, setShowFilters] = useState(false);

  // Helper to find user info for an order
  const getOrderUser = (salesId: string) => {
      const users = getUsers();
      return users.find(u => u.id === salesId);
  };

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        // 1. Refresh Orders from Cloud first to ensure data consistency
        await refreshOrdersFromCloud();

        // 2. Fetch Orders from LocalStorage
        const allOrders = getOrders();
        
        // 3. Determine base access rights
        let accessibleOrders = allOrders;
        
        if (user.role === 'staff') {
            // Staff sees only their own orders
            accessibleOrders = allOrders.filter(o => o.salesId === user.id);
        } else if (user.role === 'manager') {
            // Manager sees orders from staff in their branch OR their own orders
            const branchStaffIds = getStaffIdsByBranch(user.branch);
            accessibleOrders = allOrders.filter(o => branchStaffIds.includes(o.salesId) || o.salesId === user.id);
        }
        // Admin sees all initially, filtered later by UI controls

        // 4. Sort by date desc
        accessibleOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setOrders(accessibleOrders);
        setIsLoading(false);
    };

    fetchData();
  }, [user]);

  // Apply UI Filters
  const filteredOrders = useMemo(() => {
      return orders.filter(o => {
        const orderUser = getOrderUser(o.salesId);
        const d = new Date(o.date);
        const now = new Date();

        // Time Filter Logic
        let timeMatch = false;

        if (viewMode === 'revenue_report') {
            // Precise Month/Year filter for Report
            timeMatch = (d.getMonth() + 1 === reportMonth) && (d.getFullYear() === reportYear);
        } else {
            // Relative time filter for Dashboard/Log
            if (filterType === 'year') {
                timeMatch = d.getFullYear() === now.getFullYear();
            } else if (filterType === 'month') {
                timeMatch = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            } else if (filterType === 'week') {
                const past = new Date();
                past.setDate(past.getDate() - 7);
                timeMatch = d >= past;
            }
        }

        // Branch Filter (Admin Only)
        let branchMatch = true;
        if (user.role === 'admin' && filterBranch !== 'All') {
            branchMatch = orderUser?.branch === filterBranch;
        }
        // Note: For managers, orders are already pre-filtered in useEffect, so no branch check needed here.

        // Employee Filter (Admin/Manager)
        let employeeMatch = true;
        if ((user.role === 'admin' || user.role === 'manager') && filterEmployeeId !== 'All') {
            employeeMatch = o.salesId === filterEmployeeId;
        }

        return timeMatch && branchMatch && employeeMatch;
    });
  }, [orders, viewMode, filterType, reportMonth, reportYear, filterBranch, filterEmployeeId, user.role]);

  // IMPORTANT: Reports use `totalRevenue` which EXCLUDES shipping cost as per requirement.
  const totalRevenue = filteredOrders.reduce((acc, o) => acc + o.totalRevenue, 0);
  const totalOrders = filteredOrders.length;

  // Chart Data (for Dashboard)
  const chartData = filteredOrders.slice(0, 10).map(o => ({
      name: o.companyName.substring(0, 10) + '...',
      fullName: o.companyName,
      value: o.totalRevenue
  })).reverse();

  // Top 5 Ranking Data (for Dashboard - Admin/Manager only)
  const topRankingData = useMemo(() => {
    if (viewMode !== 'dashboard' || user.role === 'staff') return [];

    // Aggregate by Customer
    const customerStats: Record<string, { 
        name: string, 
        salesId: string, 
        totalOrders: number, 
        totalRevenue: number 
    }> = {};

    filteredOrders.forEach(o => {
        if (!customerStats[o.customerId]) {
            customerStats[o.customerId] = {
                name: o.companyName,
                salesId: o.salesId,
                totalOrders: 0,
                totalRevenue: 0
            };
        }
        customerStats[o.customerId].totalOrders += 1;
        customerStats[o.customerId].totalRevenue += o.totalRevenue;
    });

    // Convert to array, sort by revenue, take top 5
    return Object.values(customerStats)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5);
  }, [filteredOrders, viewMode, user.role]);

  // Calculate Report Data
  const reportData = useMemo(() => {
    // Only calculate if needed for performance, but hook must execute
    if (viewMode !== 'revenue_report') return [];

    const grouping: Record<string, { name: string, sub: string, revenue: number, orders: number, qty: number }> = {};
    
    filteredOrders.forEach(o => {
        let key = '';
        let name = '';
        let sub = '';

        if (user.role === 'admin' || user.role === 'manager') {
            // Group by Staff
            key = o.salesId;
            const staff = getOrderUser(o.salesId);
            name = staff?.fullName || 'Unknown';
            sub = staff?.branch || '';
        } else {
            // Group by Customer
            key = o.customerId;
            name = o.companyName;
            sub = o.customerName;
        }

        if (!grouping[key]) {
            grouping[key] = { name, sub, revenue: 0, orders: 0, qty: 0 };
        }
        grouping[key].revenue += o.totalRevenue;
        grouping[key].orders += 1;
        
        // Only count ice cream quantity (sales), exclude discount
        const iceCreamQty = o.iceCreamItems.reduce((acc, i) => acc + i.quantity, 0);
        grouping[key].qty += iceCreamQty;
    });

    return Object.values(grouping).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, user.role, viewMode]);

  // --- PDF Generator for Log View ---
  const generatePDF = async (order: Order) => {
    try {
        setIsGeneratingPdf(true);
        const saleUser = getOrderUser(order.salesId);
        const doc = new jsPDF();
        
        // Recalculate based on existing order data
        const icTotal = order.totalIceCreamRevenue;
        const topTotal = order.totalToppingRevenue;
        const discountTotal = order.discountItems?.reduce((acc, i) => acc + i.total, 0) || 0;
        const giftTotal = order.giftItems?.reduce((acc, i) => acc + i.total, 0) || 0;
        const section3Total = discountTotal + giftTotal;

        const shipping = order.shippingCost || 0;
        const grandTotalValue = icTotal + topTotal + section3Total + shipping;
        const grandTotalPayment = order.finalAmount || (icTotal + topTotal + shipping);

        let fontLoadSuccess = false;
        try {
            // Use Roboto Regular from a reliable CDN
            const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
            const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
            
            const uint8Array = new Uint8Array(fontBytes);
            let binaryString = "";
            for (let i = 0; i < uint8Array.length; i++) {
                binaryString += String.fromCharCode(uint8Array[i]);
            }
            const base64Font = window.btoa(binaryString);

            // Add font to VFS
            doc.addFileToVFS('Roboto-Regular.ttf', base64Font);
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            doc.setFont('Roboto'); // Set active
            fontLoadSuccess = true;
        } catch (fontError) {
            console.warn("Could not load custom font, falling back to standard font.", fontError);
        }

        // Use global constant or logic to load image
        let logoData = COMPANY_LOGO_BASE64;

        // Helper to process text
        const txt = (str: string) => fontLoadSuccess ? str : removeVietnameseTones(str);
        const tableStyles: any = fontLoadSuccess ? { font: 'Roboto', fontStyle: 'normal' } : {};

        // --- HEADER ---
        autoTable(doc, {
            body: [[
                { 
                    content: '', // Empty for image
                    styles: { 
                        halign: 'center', 
                        valign: 'middle', 
                        minCellHeight: 35
                    } 
                },
                { 
                    content: txt("CÔNG TY CỔ PHẦN ĐẦU TƯ BABY BOSS\n" +
                        "MST: 0316366057\n" +
                        "Địa chỉ: Tầng 14, Toà nhà HM Town, 412, Nguyễn Thị Minh Khai, phường Bàn Cờ, Thành phố Hồ Chí Minh.\n" +
                        "Hotline: 1900 99 88 80\n" +
                        "Website: www.babyboss.com.vn"),
                    styles: { halign: 'center', valign: 'middle', fontSize: 10, ...tableStyles } 
                }
            ]],
            theme: 'grid',
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 'auto' }
            },
            styles: {
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                cellPadding: 2,
            } as any,
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 0 && data.row.index === 0) {
                    if (logoData) {
                        try {
                             doc.addImage(logoData, 'PNG', data.cell.x + 2, data.cell.y + 2, 36, 31);
                        } catch (e) {
                            // Fail silently or draw text
                            doc.setFontSize(10);
                            doc.text("BABY BOSS", data.cell.x + 5, data.cell.y + 20);
                        }
                    } else {
                        doc.setFontSize(14);
                        doc.setTextColor(219, 39, 119);
                        doc.text("LOGO", data.cell.x + 10, data.cell.y + 20);
                    }
                }
            }
        });

        // --- TITLE & INFO ---
        let y = (doc as any).lastAutoTable.finalY + 10;
        
        doc.setFontSize(16);
        if(fontLoadSuccess) doc.setFont("Roboto", "normal");
        else doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0); // Reset color
        doc.text(txt("ĐƠN ĐẶT HÀNG KEM"), 105, y, { align: "center" });

        if (fontLoadSuccess) doc.setFont("Roboto", "normal");
        else doc.setFont("helvetica", "normal");

        doc.setFontSize(10);
        y += 10;
        
        doc.text(`${txt("Ngày đặt hàng")}: ${order.date}`, 190, y, { align: 'right' });
        y += 10;

        const leftX = 14;
        doc.text(`${txt("Tên Khách hàng")}: ${txt(order.companyName)}`, leftX, y);
        y += 6;
        doc.text(`${txt("Nhân viên phụ trách")}: ${txt(saleUser?.fullName || '')}`, leftX, y);
        y += 6;
        doc.text(`${txt("Người liên hệ")}: ${txt(order.customerName)}`, leftX, y); 
        y += 10;

        // --- TABLE CONFIG ---
        const navyBlue: [number, number, number] = [15, 23, 42];
        const headerStyles: any = { 
            fillColor: navyBlue, 
            textColor: 255, 
            halign: 'center', 
            ...tableStyles 
        };
        if (!fontLoadSuccess) headerStyles.fontStyle = 'bold'; 

        const bodyStyles: any = { ...tableStyles };
        
        const columns = [
            { header: 'STT', dataKey: 'stt' },
            { header: txt('Tên sản phẩm'), dataKey: 'name' },
            { header: txt('Dòng SP'), dataKey: 'line' },
            { header: txt('Quy cách'), dataKey: 'size' },
            { header: txt('Số lượng'), dataKey: 'qty' },
            { header: txt('ĐVT'), dataKey: 'unit' },
            { header: txt('Đơn giá (VNĐ)'), dataKey: 'price' },
            { header: txt('Thành tiền (VNĐ)'), dataKey: 'total' },
        ];

        const commonColumnStyles: any = {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'right' },
            7: { halign: 'right' }
        };

        // --- SECTION I: ICE CREAM ---
        const dataI = order.iceCreamItems.map((item, index) => ({
            stt: (index + 1).toString(),
            name: txt(`Kem ${item.flavor}`),
            line: item.line,
            size: item.size,
            qty: item.quantity.toString(),
            unit: txt('Hộp'),
            price: formatNumber(item.pricePerUnit),
            total: formatNumber(item.total)
        }));

        dataI.push({
            stt: '', name: txt('Tổng hàng bán (I)'), line: '', size: '',
            qty: order.iceCreamItems.reduce((a, b) => a + b.quantity, 0).toString(), unit: '', price: '',
            total: formatNumber(icTotal)
        } as any);

        autoTable(doc, {
            startY: y,
            head: [columns.map(c => c.header)],
            body: dataI.map(row => Object.values(row)),
            theme: 'grid',
            headStyles: headerStyles,
            bodyStyles: bodyStyles,
            columnStyles: commonColumnStyles,
            didParseCell: (data) => {
                if (data.row.index === dataI.length - 1) {
                    if (!fontLoadSuccess) data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // --- SECTION II: TOPPING ---
        y = (doc as any).lastAutoTable.finalY + 10; 
        const dataII = order.toppingItems.map((item, index) => ({
            stt: (index + 1).toString(),
            name: txt(item.name),
            line: '-', size: '-',
            qty: item.quantity.toString(),
            unit: txt(item.unit),
            price: formatNumber(item.pricePerUnit),
            total: formatNumber(item.total)
        }));

        dataII.push({
            stt: '', name: txt('Tổng dụng cụ và topping (II)'), line: '', size: '',
            qty: '', unit: '', price: '',
            total: formatNumber(topTotal)
        } as any);

        if (dataII.length > 1) { 
            autoTable(doc, {
                startY: y,
                head: [columns.map(c => c.header)],
                body: dataII.map(row => Object.values(row)),
                theme: 'grid',
                headStyles: headerStyles,
                bodyStyles: bodyStyles,
                columnStyles: commonColumnStyles,
                didParseCell: (data) => {
                    if (data.row.index === dataII.length - 1) {
                        if (!fontLoadSuccess) data.cell.styles.fontStyle = 'bold';
                    }
                }
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }

        // --- SECTION III: PROMOTIONS ---
        const promoItems = [
            ...(order.discountItems || []).map(i => ({ name: txt(`[CK] Kem ${i.flavor}`), line: i.line, size: i.size, qty: i.quantity, unit: txt('Hộp'), price: 0, total: 0 })),
            ...(order.giftItems || []).map(i => ({ name: txt(`[Quà] ${i.name}`), line: '-', size: '-', qty: i.quantity, unit: txt(i.unit), price: i.pricePerUnit, total: i.total }))
        ];
        
        const dataIII = promoItems.map((item, index) => ({
            stt: (index + 1).toString(),
            name: item.name,
            line: item.line || '-', size: item.size || '-',
            qty: item.qty.toString(),
            unit: item.unit,
            price: formatNumber(item.price),
            total: formatNumber(item.total)
        }));

        dataIII.push({
            stt: '', name: txt('Tổng chiết khấu và khuyến mãi (III)'), line: '', size: '',
            qty: '', unit: '', price: '',
            total: formatNumber(section3Total)
        } as any);

        autoTable(doc, {
            startY: y,
            head: [columns.map(c => c.header)],
            body: dataIII.map(row => Object.values(row)),
            theme: 'grid',
            headStyles: headerStyles,
            bodyStyles: bodyStyles,
            columnStyles: commonColumnStyles,
            didParseCell: (data) => {
                if (data.row.index === dataIII.length - 1) {
                    if (!fontLoadSuccess) data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        y = (doc as any).lastAutoTable.finalY;

        autoTable(doc, {
            startY: y,
            body: [
                [
                    { content: txt("Chi phí vận chuyển và bảo quản (IV)"), styles: { fontStyle: 'normal', halign: 'left', ...tableStyles } as any },
                    { content: formatNumber(shipping || 0), styles: { halign: 'right', ...tableStyles } as any }
                ],
                [
                    { content: txt("Tổng giá trị đơn hàng (I + II + III + IV)"), styles: { fontStyle: fontLoadSuccess ? 'normal' : 'bold', halign: 'left', ...tableStyles } as any },
                    { content: formatNumber(grandTotalValue), styles: { fontStyle: fontLoadSuccess ? 'normal' : 'bold', halign: 'right', ...tableStyles } as any }
                ],
                [
                    { content: txt("Tổng giá trị thanh toán (I + II + IV)"), styles: { fontStyle: fontLoadSuccess ? 'normal' : 'bold', halign: 'left', fillColor: [240, 240, 240], ...tableStyles } as any },
                    { content: formatNumber(grandTotalPayment), styles: { fontStyle: fontLoadSuccess ? 'normal' : 'bold', halign: 'right', fillColor: [240, 240, 240], textColor: [219, 39, 119], ...tableStyles } as any }
                ]
            ],
            theme: 'grid',
            showHead: 'never',
            columnStyles: {
                0: { cellWidth: 'auto' }, 
                1: { cellWidth: 40 }
            }
        });

        y = (doc as any).lastAutoTable.finalY + 10;
        const pageHeight = doc.internal.pageSize.height;
        
        if (y > pageHeight - 60) {
            doc.addPage();
            y = 20;
        }

        doc.setFontSize(9);
        if(fontLoadSuccess) doc.setFont("Roboto", "normal");
        else doc.setFont("helvetica", "bold");
        doc.text(txt("1. Thanh toán:"), 14, y);
        if(fontLoadSuccess) doc.setFont("Roboto", "normal");
        else doc.setFont("helvetica", "normal");
        y += 5;
        doc.text(txt("- Thanh toán lần 1 với 50% giá trị đơn hàng ngay sau khi khách hàng xác nhận đơn hàng."), 14, y);
        y += 5;
        doc.text(txt("- Thanh toán lần 2 với 50% giá trị đơn hàng còn lại ngay sau khi khách hàng nhận và kiểm tra hàng."), 14, y);
        y += 8;
        if(fontLoadSuccess) doc.setFont("Roboto", "normal");
        else doc.setFont("helvetica", "bold");
        doc.text(txt("2. Phương thức thanh toán: Chuyển khoản hoặc tiền mặt"), 14, y);
        if(fontLoadSuccess) doc.setFont("Roboto", "normal");
        else doc.setFont("helvetica", "normal");
        y += 5;
        doc.text(txt("- Số tài khoản 112568"), 14, y);
        y += 5;
        doc.text(txt("- Chủ tài khoản: CONG TY CO PHAN DAU TU BABY BOSS"), 14, y);
        y += 5;
        doc.text(txt("- Ngân hàng EXIMBANK"), 14, y);
        y += 10;
        if(fontLoadSuccess) doc.setFont("Roboto", "normal"); 
        else doc.setFont("helvetica", "italic");
        doc.text(txt("Thời gian làm việc và giao hàng: từ thứ hai đến thứ bảy; sáng từ 8 giờ đến 12 giờ, chiều từ 13 giờ đến 17 giờ; Chủ nhật nghỉ."), 14, y, { maxWidth: 180 });

        y += 20;
        if (y > pageHeight - 40) {
            doc.addPage();
            y = 20;
        }

        if(fontLoadSuccess) doc.setFont("Roboto", "normal");
        else doc.setFont("helvetica", "bold");
        doc.text(txt("NGƯỜI ĐẶT HÀNG"), 40, y, { align: 'center' });
        doc.text(txt("NGƯỜI LẬP ĐƠN"), 170, y, { align: 'center' });
        y += 30;
        doc.text(txt(order.customerName), 40, y, { align: 'center' });
        doc.text(txt(saleUser?.fullName || ''), 170, y, { align: 'center' });

        doc.save(`Order_${removeVietnameseTones(order.companyName)}_${order.date}.pdf`);
    } catch (e) {
        console.error("PDF Generation Error:", e);
        alert("Lỗi xuất file PDF. Vui lòng thử lại.");
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 size={40} className="animate-spin text-baby-accent mb-4"/>
              <p>Đang đồng bộ dữ liệu báo cáo...</p>
          </div>
      );
  }

  // VIEW: DASHBOARD
  if (viewMode === 'dashboard') {
      return (
          <div className="space-y-6 animate-fade-in">
               <h2 className="text-2xl font-bold text-baby-navy mb-2">Tổng quan hệ thống</h2>
               <ReportsFilter
                  user={user}
                  viewMode={viewMode}
                  filterType={filterType}
                  setFilterType={setFilterType}
                  reportMonth={reportMonth}
                  setReportMonth={setReportMonth}
                  reportYear={reportYear}
                  setReportYear={setReportYear}
                  filterBranch={filterBranch}
                  setFilterBranch={setFilterBranch}
                  filterEmployeeId={filterEmployeeId}
                  setFilterEmployeeId={setFilterEmployeeId}
                  showFilters={showFilters}
                  setShowFilters={setShowFilters}
               />

               {/* Stats Cards */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <DollarSign size={64} className="text-baby-accent" />
                        </div>
                        <p className="text-slate-500 text-sm mb-1 font-medium">Doanh thu (Hàng hoá)</p>
                        <p className="text-3xl font-bold text-baby-accent">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Package size={64} className="text-blue-500" />
                        </div>
                        <p className="text-slate-500 text-sm mb-1 font-medium">Số đơn hàng</p>
                        <p className="text-3xl font-bold text-baby-navy">{totalOrders}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg">
                        <p className="text-slate-500 text-sm mb-1 font-medium">Tài khoản</p>
                        <div className="text-baby-navy">
                            <div className="font-bold text-lg">{user.fullName}</div>
                            <div className="text-baby-accent font-medium">{user.position}</div>
                            <div className="text-xs text-slate-500 mt-1">{user.branch}</div>
                        </div>
                    </div>
               </div>

                {/* Top 5 Ranking Table (Admin/Manager Only) */}
                {(user.role === 'admin' || user.role === 'manager') && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                             <Trophy size={20} className="text-yellow-500" />
                             <h3 className="text-baby-navy font-bold">Top 5 Khách hàng doanh số cao nhất ({filterType === 'week' ? 'Tuần này' : filterType === 'month' ? 'Tháng này' : 'Năm nay'})</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 text-center">Hạng</th>
                                        <th className="px-4 py-3">Khách hàng</th>
                                        <th className="px-4 py-3">Nhân viên phụ trách</th>
                                        <th className="px-4 py-3 text-center">Số đơn</th>
                                        <th className="px-4 py-3 text-right">Tổng doanh số</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {topRankingData.length === 0 ? (
                                        <tr><td colSpan={5} className="p-6 text-center text-slate-500">Chưa có dữ liệu</td></tr>
                                    ) : (
                                        topRankingData.map((item, index) => {
                                            const staff = getOrderUser(item.salesId);
                                            return (
                                                <tr key={index} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 text-center">
                                                        {index === 0 && <Medal size={20} className="text-yellow-500 mx-auto" />}
                                                        {index === 1 && <Medal size={20} className="text-slate-400 mx-auto" />}
                                                        {index === 2 && <Medal size={20} className="text-amber-700 mx-auto" />}
                                                        {index > 2 && <span className="text-slate-500 font-bold">{index + 1}</span>}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-baby-navy">{item.name}</td>
                                                    <td className="px-4 py-3 text-slate-600">
                                                        {staff?.fullName} <span className="text-[10px] text-slate-400">({staff?.branch?.replace('Baby Boss ', '')})</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-slate-800">{item.totalOrders}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-baby-accent">{formatCurrency(item.totalRevenue)}</td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Chart */}
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg">
                    <h3 className="text-baby-navy font-bold mb-4">Biểu đồ doanh thu gần đây</h3>
                    <div className="w-full" style={{ height: 320 }}>
                        <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#db2777' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                    labelFormatter={(label) => {
                                        const item = chartData.find(i => i.name === label);
                                        return item ? item.fullName : label;
                                    }}
                                />
                                <Bar dataKey="value" fill="#db2777" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#db2777' : '#be185d'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
               </div>
          </div>
      )
  }

  // VIEW: REVENUE REPORT (SUMMARY)
  if (viewMode === 'revenue_report') {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
                <Calendar className="text-baby-accent" size={24}/>
                <h2 className="text-2xl font-bold text-baby-navy">Báo cáo doanh số</h2>
            </div>
            
            <ReportsFilter
                user={user}
                viewMode={viewMode}
                filterType={filterType}
                setFilterType={setFilterType}
                reportMonth={reportMonth}
                setReportMonth={setReportMonth}
                reportYear={reportYear}
                setReportYear={setReportYear}
                filterBranch={filterBranch}
                setFilterBranch={setFilterBranch}
                filterEmployeeId={filterEmployeeId}
                setFilterEmployeeId={setFilterEmployeeId}
                showFilters={showFilters}
                setShowFilters={setShowFilters}
            />

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-baby-navy font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">
                                {(user.role === 'admin' || user.role === 'manager') ? 'Nhân viên kinh doanh' : 'Khách hàng'}
                            </th>
                            <th className="px-6 py-4 text-center">Tổng đơn hàng</th>
                            <th className="px-6 py-4 text-center">Tổng sản lượng (Hộp)</th>
                            <th className="px-6 py-4 text-right">Tổng doanh thu</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {reportData.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Không có dữ liệu cho tháng này.</td></tr>
                        ) : (
                            reportData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{row.name}</div>
                                        <div className="text-xs text-slate-500">{row.sub}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-600">{row.orders}</td>
                                    <td className="px-6 py-4 text-center text-slate-600">{row.qty}</td>
                                    <td className="px-6 py-4 text-right font-bold text-baby-accent">{formatCurrency(row.revenue)}</td>
                                </tr>
                            ))
                        )}
                        {/* Total Row */}
                        {reportData.length > 0 && (
                             <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                <td className="px-6 py-4 text-baby-navy">TỔNG CỘNG</td>
                                <td className="px-6 py-4 text-center text-baby-navy">{totalOrders}</td>
                                <td className="px-6 py-4 text-center text-baby-navy">
                                    {/* Total Qty here is also excluding discount items based on logic above */}
                                    {reportData.reduce((acc, r) => acc + r.qty, 0)}
                                </td>
                                <td className="px-6 py-4 text-right text-baby-accent">{formatCurrency(totalRevenue)}</td>
                             </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
  }

  // VIEW: SALES LOG
  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-baby-navy mb-2">Nhật ký bán hàng</h2>
      <ReportsFilter
          user={user}
          viewMode={viewMode}
          filterType={filterType}
          setFilterType={setFilterType}
          reportMonth={reportMonth}
          setReportMonth={setReportMonth}
          reportYear={reportYear}
          setReportYear={setReportYear}
          filterBranch={filterBranch}
          setFilterBranch={setFilterBranch}
          filterEmployeeId={filterEmployeeId}
          setFilterEmployeeId={setFilterEmployeeId}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto shadow-xl">
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-baby-navy font-semibold whitespace-nowrap border-b border-slate-200">
                <tr>
                    <th className="px-4 py-3">Ngày</th>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3 text-center">SL Hộp</th>
                    <th className="px-4 py-3 text-right">Doanh số</th>
                    <th className="px-4 py-3 text-right text-green-600">Thực thu</th>
                    <th className="px-4 py-3">NV Sale</th> 
                    <th className="px-4 py-3 text-center">Invoice</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                     <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">Chưa có đơn hàng nào trong khoảng thời gian này.</td>
                     </tr>
                ) : (
                    filteredOrders.map(order => {
                        const salePerson = getOrderUser(order.salesId);
                        // Filter Qty for Display (Exclude discount items)
                        const realQty = order.iceCreamItems.reduce((acc, i) => acc + i.quantity, 0);

                        return (
                        <tr 
                            key={order.id} 
                            onClick={() => setSelectedOrder(order)}
                            className="hover:bg-slate-50 transition-colors cursor-pointer group"
                        >
                            <td className="px-4 py-3 text-slate-600 font-mono whitespace-nowrap group-hover:text-baby-accent">{order.date}</td>
                            <td className="px-4 py-3">
                                <div className="text-baby-navy font-medium truncate max-w-[150px]" title={order.companyName}>{order.companyName}</div>
                                <div className="text-slate-400 text-xs">{order.customerName}</div>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600">
                                {realQty}
                            </td>
                            <td className="px-4 py-3 text-right text-baby-accent font-bold">{formatCurrency(order.totalRevenue)}</td>
                            <td className="px-4 py-3 text-right text-green-600 font-bold">
                                {formatCurrency(order.finalAmount || order.totalRevenue)}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                                <div>{salePerson?.fullName}</div>
                                <div className="text-[10px] opacity-70">{salePerson?.branch?.replace('Baby Boss ', '')}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                                {order.hasInvoice ? 
                                    <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Có</span> : 
                                    <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">Không</span>
                                }
                            </td>
                        </tr>
                        )
                    })
                )}
            </tbody>
        </table>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
              <div className="bg-white w-full max-w-3xl rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                      <h3 className="text-lg font-bold text-baby-navy flex items-center gap-2">
                          <Eye size={20} className="text-baby-accent"/> Chi tiết đơn hàng
                      </h3>
                      <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
                  </div>
                  
                  <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
                      {/* Header Info */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                              <p className="text-slate-500 text-xs">Khách hàng</p>
                              <p className="font-bold text-baby-navy text-lg">{selectedOrder.companyName}</p>
                              <p className="text-slate-600">{selectedOrder.customerName}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-slate-500 text-xs">Ngày đặt</p>
                              <p className="font-bold text-baby-navy">{selectedOrder.date}</p>
                              <p className="text-slate-500 text-xs mt-2">Nhân viên sale</p>
                              <p className="text-baby-accent font-medium">{getOrderUser(selectedOrder.salesId)?.fullName}</p>
                          </div>
                      </div>

                      {/* Item Table */}
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-semibold">
                              <tr>
                                  <th className="px-3 py-2">Sản phẩm</th>
                                  <th className="px-3 py-2 text-center">SL</th>
                                  <th className="px-3 py-2 text-right">Đơn giá</th>
                                  <th className="px-3 py-2 text-right">Thành tiền</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {/* Ice Cream */}
                              {selectedOrder.iceCreamItems.map((item, idx) => (
                                  <tr key={`ice-${idx}`}>
                                      <td className="px-3 py-2 text-slate-700">Kem {item.line} ({item.size}) - <span className="text-baby-navy font-medium">{item.flavor}</span></td>
                                      <td className="px-3 py-2 text-center text-slate-600">{item.quantity}</td>
                                      <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(item.pricePerUnit)}</td>
                                      <td className="px-3 py-2 text-right text-baby-navy font-medium">{formatCurrency(item.total)}</td>
                                  </tr>
                              ))}
                              {/* Topping */}
                              {selectedOrder.toppingItems.map((item, idx) => (
                                  <tr key={`top-${idx}`}>
                                      <td className="px-3 py-2 text-slate-700">{item.name}</td>
                                      <td className="px-3 py-2 text-center text-slate-600">{item.quantity} {item.unit}</td>
                                      <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(item.pricePerUnit)}</td>
                                      <td className="px-3 py-2 text-right text-baby-navy font-medium">{formatCurrency(item.total)}</td>
                                  </tr>
                              ))}
                              {/* Discount */}
                              {selectedOrder.discountItems?.map((item, idx) => (
                                  <tr key={`disc-${idx}`} className="text-yellow-600 italic bg-yellow-50">
                                      <td className="px-3 py-2">[CK] Kem {item.line} ({item.size}) - {item.flavor}</td>
                                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                                      <td className="px-3 py-2 text-right">0 đ</td>
                                      <td className="px-3 py-2 text-right">0 đ</td>
                                  </tr>
                              ))}
                              {/* Gift */}
                              {selectedOrder.giftItems?.map((item, idx) => (
                                  <tr key={`gift-${idx}`} className="text-purple-600 italic bg-purple-50">
                                      <td className="px-3 py-2">[Quà] {item.name}</td>
                                      <td className="px-3 py-2 text-center">{item.quantity} {item.unit}</td>
                                      <td className="px-3 py-2 text-right line-through opacity-50">{formatCurrency(item.pricePerUnit)}</td>
                                      <td className="px-3 py-2 text-right">0 đ</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500">Doanh thu hàng hoá:</span>
                          <span className="text-slate-800 font-medium">{formatCurrency(selectedOrder.totalRevenue)}</span>
                       </div>
                       
                       {selectedOrder.shippingCost && selectedOrder.shippingCost > 0 && (
                           <div className="flex justify-between items-center text-sm">
                               <span className="text-slate-500 flex items-center gap-1"><Truck size={14}/> Phí vận chuyển:</span>
                               <span className="text-slate-800 font-medium">{formatCurrency(selectedOrder.shippingCost)}</span>
                           </div>
                       )}

                       <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                          <span className="text-sm font-bold text-baby-navy">Tổng giá trị đơn hàng:</span>
                          <span className="text-baby-accent font-bold text-lg">{formatCurrency(selectedOrder.finalAmount || selectedOrder.totalRevenue)}</span>
                       </div>
                       
                       {selectedOrder.depositAmount && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Đã cọc:</span>
                                <span className="text-yellow-600 font-medium">{formatCurrency(selectedOrder.depositAmount)}</span>
                            </div>
                       )}

                       <div className="mt-2">
                            <button 
                                onClick={() => generatePDF(selectedOrder)}
                                disabled={isGeneratingPdf}
                                className="w-full bg-white border border-slate-300 text-baby-navy font-bold py-2 px-4 rounded hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 shadow-sm"
                            >
                                {isGeneratingPdf ? <Loader2 size={18} className="animate-spin"/> : <FileDown size={18}/>} 
                                {isGeneratingPdf ? 'Tải PDF' : 'Tải PDF'}
                            </button>
                       </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Reports;
