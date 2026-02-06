
import React, { useState, useEffect, useMemo } from 'react';
import { User, Customer, Order, IceCreamItem, ToppingItem, IceCreamLine, IceCreamSize } from '../types';
import { getCustomers, saveOrder, getOrders, getStaffIdsByBranch, getUsers } from '../services/mockDataService';
import { FLAVORS, ICE_CREAM_PRICES, LINES, SIZES, formatCurrency, formatNumber, removeVietnameseTones, COMPANY_LOGO_BASE64 } from '../constants';
import { Trash2, PlusCircle, CheckCircle, Gift, Percent, FileDown, Truck, Loader2, IceCream } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  user: User;
  onOrderComplete: () => void;
}

const OrderEntry: React.FC<Props> = ({ user, onOrderComplete }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [step, setStep] = useState<'details' | 'items' | 'review'>('details');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Order State
  const [selectedCustId, setSelectedCustId] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [hasInvoice, setHasInvoice] = useState<boolean>(false);
  
  // Items State
  const [iceCreamItems, setIceCreamItems] = useState<IceCreamItem[]>([]);
  const [toppingItems, setToppingItems] = useState<ToppingItem[]>([]);
  const [discountItems, setDiscountItems] = useState<IceCreamItem[]>([]);
  const [giftItems, setGiftItems] = useState<ToppingItem[]>([]);

  // Shipping Cost State (New)
  const [shippingCost, setShippingCost] = useState<number>(0);

  // Derived State
  const [isFirstOrder, setIsFirstOrder] = useState<boolean>(false);

  // Temp State: Purchasing Ice Cream
  const [curLine, setCurLine] = useState<IceCreamLine>('Pro');
  const [curSize, setCurSize] = useState<IceCreamSize>('500ml');
  const [curFlavor, setCurFlavor] = useState<string>(FLAVORS[0]);
  const [curQty, setCurQty] = useState<number>(1);

  // Temp State: Purchasing Topping
  const [topName, setTopName] = useState('');
  const [topUnit, setTopUnit] = useState('');
  const [topQty, setTopQty] = useState(1);
  const [topPrice, setTopPrice] = useState(0);

  // Temp State: Discount Ice Cream
  const [discLine, setDiscLine] = useState<IceCreamLine>('Pro');
  const [discSize, setDiscSize] = useState<IceCreamSize>('500ml');
  const [discFlavor, setDiscFlavor] = useState<string>(FLAVORS[0]);
  const [discQty, setDiscQty] = useState<number>(1);

  // Temp State: Gift Item
  const [giftName, setGiftName] = useState('');
  const [giftUnit, setGiftUnit] = useState('');
  const [giftQty, setGiftQty] = useState(1);
  const [giftPrice, setGiftPrice] = useState(0);

  useEffect(() => {
    // Load customers available for this user
    const all = getCustomers();
    if (user.role === 'admin') {
      setCustomers(all);
    } else if (user.role === 'manager') {
      const branchStaffIds = getStaffIdsByBranch(user.branch);
      // Manager sees all customers belonging to their branch staff OR themselves
      // (Assuming customer.salesId links to the staff)
      setCustomers(all.filter(c => branchStaffIds.includes(c.salesId) || c.salesId === user.id));
    } else {
      setCustomers(all.filter(c => c.salesId === user.id));
    }
  }, [user]);

  useEffect(() => {
      // Check if customer is first time
      if(selectedCustId) {
          const allOrders = getOrders();
          // Filter to find orders belonging to this specific customer
          const prevOrders = allOrders.filter(o => o.customerId === selectedCustId);
          
          if (prevOrders.length === 0) {
              setIsFirstOrder(true);
          } else {
              setIsFirstOrder(false);
              setGiftItems([]); // Clear gifts if customer changes to an existing one (not eligible)
          }
      } else {
          setIsFirstOrder(false);
          setGiftItems([]);
      }
  }, [selectedCustId]);

  // Helper to get assigned sales person for the selected customer
  const getAssignedSalesPerson = (customerId: string): User | undefined => {
      const cust = customers.find(c => c.id === customerId);
      if (!cust || !cust.salesId) return undefined;
      const allUsers = getUsers();
      return allUsers.find(u => u.id === cust.salesId);
  };

  // --- Handlers for Purchase Items ---
  const addIceCream = () => {
    const price = ICE_CREAM_PRICES[curLine][curSize];
    const newItem: IceCreamItem = {
      id: Date.now().toString(),
      line: curLine, size: curSize, flavor: curFlavor, quantity: curQty,
      pricePerUnit: price, total: price * curQty
    };
    setIceCreamItems([...iceCreamItems, newItem]);
  };
  const removeIceCream = (id: string) => setIceCreamItems(iceCreamItems.filter(i => i.id !== id));

  const addTopping = () => {
    if (!topName || !topUnit) return;
    const newItem: ToppingItem = {
      id: Date.now().toString(),
      name: topName, unit: topUnit, quantity: topQty,
      pricePerUnit: topPrice, total: topPrice * topQty
    };
    setToppingItems([...toppingItems, newItem]);
    setTopName(''); setTopUnit(''); setTopQty(1); setTopPrice(0);
  };
  const removeTopping = (id: string) => setToppingItems(toppingItems.filter(i => i.id !== id));

  // --- Handlers for Discount/Gifts ---
  const addDiscountItem = () => {
      const newItem: IceCreamItem = {
          id: `disc_${Date.now()}`,
          line: discLine, size: discSize, flavor: discFlavor, quantity: discQty,
          pricePerUnit: 0, total: 0 // Free
      };
      setDiscountItems([...discountItems, newItem]);
  };
  const removeDiscountItem = (id: string) => setDiscountItems(discountItems.filter(i => i.id !== id));

  const addGiftItem = () => {
      if (!giftName || !giftUnit) return;
      const newItem: ToppingItem = {
          id: `gift_${Date.now()}`,
          name: giftName, unit: giftUnit, quantity: giftQty,
          pricePerUnit: giftPrice, // Store real price
          total: giftPrice * giftQty // Store real total value
      };
      setGiftItems([...giftItems, newItem]);
      setGiftName(''); setGiftUnit(''); setGiftQty(1); setGiftPrice(0);
  };
  const removeGiftItem = (id: string) => setGiftItems(giftItems.filter(i => i.id !== id));


  // --- Calculations ---
  const calculateTotals = () => {
    const icTotal = iceCreamItems.reduce((acc, i) => acc + i.total, 0);
    const topTotal = toppingItems.reduce((acc, i) => acc + i.total, 0);
    
    // Revenue (Doanh số) = IceCream + Topping
    const revenue = icTotal + topTotal;
    
    // Final Amount (Giá trị đơn hàng) = Revenue + Shipping Cost
    // Ensure shippingCost is a number
    const safeShipping = Number(shippingCost) || 0;
    const finalAmount = revenue + safeShipping;

    const deposit = finalAmount * 0.5;
    const totalQty = iceCreamItems.reduce((acc, i) => acc + i.quantity, 0) + discountItems.reduce((acc, i) => acc + i.quantity, 0);
    
    return { icTotal, topTotal, revenue, finalAmount, totalQty, deposit };
  };

  const handleSubmitOrder = async () => {
    const cust = customers.find(c => c.id === selectedCustId);
    if (!cust) return;

    setIsSubmitting(true);
    try {
        const { icTotal, topTotal, revenue, finalAmount, totalQty, deposit } = calculateTotals();

        // Determine who gets credit for the sale.
        const effectiveSalesId = cust.salesId || user.id;

        const newOrder: Order = {
          id: Date.now().toString(),
          salesId: effectiveSalesId,
          customerId: cust.id,
          customerName: cust.name,
          companyName: cust.companyName,
          date: orderDate,
          hasInvoice,
          iceCreamItems,
          toppingItems,
          discountItems,
          giftItems,
          totalIceCreamRevenue: icTotal,
          totalToppingRevenue: topTotal,
          totalRevenue: revenue, // Sales Revenue only
          shippingCost: Number(shippingCost) || 0, // Saved separately
          finalAmount: finalAmount, // Total to pay
          totalQuantity: totalQty,
          depositAmount: deposit
        };

        const success = await saveOrder(newOrder);
        
        // Always finish if local save worked
        alert("Đơn hàng đã được lưu!");
        onOrderComplete();
    } catch (e) {
        console.error("Submit Error", e);
        alert("Có lỗi xảy ra khi lưu đơn hàng.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const generatePDF = async () => {
    try {
        setIsGeneratingPdf(true);
        const cust = customers.find(c => c.id === selectedCustId);
        if (!cust) return;
        
        const assignedSale = getAssignedSalesPerson(cust.id) || user;
        const { icTotal, topTotal, revenue, finalAmount } = calculateTotals();
        const safeShipping = Number(shippingCost) || 0;

        // Calculate III Total (Discounts/Gifts Value)
        const giftTotal = giftItems.reduce((acc, g) => acc + g.total, 0);
        const discountTotal = discountItems.reduce((acc, i) => acc + i.total, 0);
        const section3Total = giftTotal + discountTotal;

        const grandTotalValue = icTotal + topTotal + section3Total + safeShipping;
        const grandTotalPayment = icTotal + topTotal + safeShipping;

        const doc = new jsPDF();

        // --- Load Font ---
        let fontLoadSuccess = false;
        try {
            const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
            const fontBytes = await fetch(fontUrl).then(res => {
                if(!res.ok) throw new Error("Font fetch failed");
                return res.arrayBuffer();
            });
            const uint8Array = new Uint8Array(fontBytes);
            let binaryString = "";
            for (let i = 0; i < uint8Array.length; i++) {
                binaryString += String.fromCharCode(uint8Array[i]);
            }
            const base64Font = window.btoa(binaryString);
            doc.addFileToVFS('Roboto-Regular.ttf', base64Font);
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            doc.setFont('Roboto'); 
            fontLoadSuccess = true;
        } catch (fontError) {
            console.warn("Could not load custom font, fallback to standard.", fontError);
        }

        // --- Prepare Logo ---
        // Basic check for base64 string
        let logoData = (COMPANY_LOGO_BASE64 && COMPANY_LOGO_BASE64.startsWith('data:image')) ? COMPANY_LOGO_BASE64 : null;
        
        // Helper to process text
        const txt = (str: string) => fontLoadSuccess ? str : removeVietnameseTones(str);
        const tableStyles: any = fontLoadSuccess ? { font: 'Roboto', fontStyle: 'normal' } : {};

        // --- HEADER with Logo ---
        autoTable(doc, {
            body: [[
                { 
                    content: '', 
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
                            console.error("Error drawing logo", e);
                            doc.setFontSize(10);
                            doc.text("BABY BOSS", data.cell.x + 5, data.cell.y + 20);
                        }
                    } else {
                        doc.setFontSize(14);
                        doc.setTextColor(219, 39, 119);
                        doc.text("BABY BOSS", data.cell.x + 5, data.cell.y + 20);
                    }
                }
            }
        });

        // --- TITLE & INFO ---
        let y = (doc as any).lastAutoTable.finalY + 10;
        
        doc.setFontSize(16);
        if(fontLoadSuccess) doc.setFont("Roboto", "normal");
        else doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0); 
        doc.text(txt("ĐƠN ĐẶT HÀNG KEM"), 105, y, { align: "center" });

        if (fontLoadSuccess) doc.setFont("Roboto", "normal");
        else doc.setFont("helvetica", "normal");

        doc.setFontSize(10);
        y += 10;
        
        doc.text(`${txt("Ngày đặt hàng")}: ${orderDate}`, 190, y, { align: 'right' });
        y += 10;

        const leftX = 14;
        doc.text(`${txt("Tên Khách hàng")}: ${txt(cust.companyName)}`, leftX, y);
        y += 6;
        doc.text(`${txt("Nhân viên phụ trách")}: ${txt(assignedSale.fullName)}`, leftX, y);
        y += 6;
        doc.text(`${txt("Số điện thoại khách hàng")}: ${cust.phone}`, leftX, y);
        y += 6;
        doc.text(`${txt("Địa chỉ khách hàng")}: ${txt(cust.address)}`, leftX, y);
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

        const dataI = iceCreamItems.map((item, index) => ({
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
            qty: iceCreamItems.reduce((a, b) => a + b.quantity, 0).toString(), unit: '', price: '',
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

        y = (doc as any).lastAutoTable.finalY + 10;
        const dataII = toppingItems.map((item, index) => ({
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

        const promoItems = [
            ...discountItems.map(i => ({ name: txt(`[CK] Kem ${i.flavor}`), line: i.line, size: i.size, qty: i.quantity, unit: txt('Hộp'), price: 0, total: 0 })),
            ...giftItems.map(i => ({ name: txt(`[Quà] ${i.name}`), line: '-', size: '-', qty: i.quantity, unit: txt(i.unit), price: i.pricePerUnit, total: i.total }))
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
                    { content: formatNumber(safeShipping), styles: { halign: 'right', ...tableStyles } as any }
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
        doc.text(txt(cust.name), 40, y, { align: 'center' });
        doc.text(txt(user.fullName), 170, y, { align: 'center' });

        doc.save(`Order_${removeVietnameseTones(cust.companyName)}_${orderDate}.pdf`);
    } catch (e) {
        console.error("PDF Generation Error:", e);
        alert("Lỗi xuất file PDF. Vui lòng kiểm tra lại trình duyệt.");
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const { icTotal, topTotal, revenue, finalAmount, deposit } = calculateTotals();

  if (step === 'details') {
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl border border-slate-200 shadow-xl">
        <h2 className="text-xl font-bold text-baby-accent mb-6 border-b border-slate-200 pb-2">Bước 1: Thông tin đơn hàng</h2>
        <div className="space-y-4">
          {/* Moved Date Input to Top */}
          <div>
            <label className="block text-sm text-slate-500 mb-1">Ngày mua hàng</label>
            <input 
              type="date"
              className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-500 mb-1">Khách hàng</label>
            <select 
              className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800"
              value={selectedCustId}
              onChange={(e) => setSelectedCustId(e.target.value)}
            >
              <option value="">-- Chọn khách hàng --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.companyName} - {c.name}</option>
              ))}
            </select>
            {isFirstOrder && <p className="text-green-600 text-xs mt-1 italic font-medium">* Khách hàng mới (Đơn đầu tiên)</p>}
          </div>
          
          <div className="flex items-center space-x-2 pt-2">
            <input 
              type="checkbox" 
              id="invoice"
              checked={hasInvoice}
              onChange={(e) => setHasInvoice(e.target.checked)}
              className="w-4 h-4 accent-baby-accent"
            />
            <label htmlFor="invoice" className="text-slate-800">Xuất hoá đơn GTGT</label>
          </div>

          <div className="pt-6 flex justify-end">
            <button 
              disabled={!selectedCustId}
              onClick={() => setStep('items')}
              className="bg-baby-accent disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg hover:bg-pink-600 transition-colors shadow-md"
            >
              Tiếp tục: Chọn hàng hoá
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'items') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* --- SECTION 1: PURCHASING --- */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl">
          <h3 className="text-lg font-bold text-baby-accent mb-4 flex items-center gap-2">
            <IceCream /> Mua Kem (Tính doanh số)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Dòng</label>
              <select value={curLine} onChange={(e) => setCurLine(e.target.value as IceCreamLine)} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800">
                {LINES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Định lượng</label>
              <select value={curSize} onChange={(e) => setCurSize(e.target.value as IceCreamSize)} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800">
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Vị</label>
              <select value={curFlavor} onChange={(e) => setCurFlavor(e.target.value)} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800">
                {FLAVORS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Số lượng</label>
              <div className="flex gap-2">
                <input type="number" min="1" value={curQty} onChange={(e) => setCurQty(parseInt(e.target.value))} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800" />
                <button onClick={addIceCream} className="bg-baby-accent p-1.5 rounded text-white hover:bg-pink-600 shadow-sm"><PlusCircle size={20}/></button>
              </div>
            </div>
          </div>
          {/* List Added Ice Creams */}
          <div className="mt-4 space-y-2">
            {iceCreamItems.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-200">
                <div className="text-sm">
                  <span className="font-bold text-baby-navy">{item.line} - {item.size}</span>
                  <span className="text-slate-400 mx-2">|</span>
                  <span className="text-slate-800">{item.flavor}</span>
                  <span className="text-slate-500 text-xs ml-2">x{item.quantity}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-baby-accent font-medium">{formatCurrency(item.total)}</span>
                  <button onClick={() => removeIceCream(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- SECTION 2: TOPPING & TOOLS --- */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl">
          <h3 className="text-lg font-bold text-baby-accent mb-4 flex items-center gap-2">
             Topping & Dụng cụ (Tính doanh số)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Tên hàng</label>
              <input value={topName} onChange={(e) => setTopName(e.target.value)} placeholder="Nhập tên..." className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Đơn vị</label>
              <input value={topUnit} onChange={(e) => setTopUnit(e.target.value)} placeholder="kg/cái" className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800" />
            </div>
            <div>
                <label className="text-xs text-slate-500 block mb-1">Giá đơn vị</label>
                <input type="number" value={topPrice} onChange={(e) => setTopPrice(parseFloat(e.target.value))} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Số lượng</label>
              <div className="flex gap-2">
                <input type="number" min="1" value={topQty} onChange={(e) => setTopQty(parseInt(e.target.value))} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800" />
                <button onClick={addTopping} className="bg-baby-accent p-1.5 rounded text-white hover:bg-pink-600 shadow-sm"><PlusCircle size={20}/></button>
              </div>
            </div>
          </div>
           {/* List Added Toppings */}
           <div className="mt-4 space-y-2">
            {toppingItems.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-200">
                <div className="text-sm">
                  <span className="font-bold text-slate-800">{item.name}</span>
                  <span className="text-slate-500 text-xs ml-2">({item.quantity} {item.unit} x {formatCurrency(item.pricePerUnit)})</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-baby-accent font-medium">{formatCurrency(item.total)}</span>
                  <button onClick={() => removeTopping(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- SECTION 3: DISCOUNT ICE CREAM --- */}
        <div className="bg-white p-6 rounded-xl border border-yellow-200 shadow-xl relative overflow-hidden">
          <div className="absolute -right-6 top-6 bg-yellow-500 text-white text-xs font-bold px-8 py-1 rotate-45">CHIẾT KHẤU</div>
          <h3 className="text-lg font-bold text-yellow-600 mb-4 flex items-center gap-2">
            <Percent size={20}/> Kem Chiết Khấu (Tặng/Offset)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Dòng</label>
              <select value={discLine} onChange={(e) => setDiscLine(e.target.value as IceCreamLine)} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800">
                {LINES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Định lượng</label>
              <select value={discSize} onChange={(e) => setDiscSize(e.target.value as IceCreamSize)} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800">
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Vị</label>
              <select value={discFlavor} onChange={(e) => setDiscFlavor(e.target.value)} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800">
                {FLAVORS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Số lượng</label>
              <div className="flex gap-2">
                <input type="number" min="1" value={discQty} onChange={(e) => setDiscQty(parseInt(e.target.value))} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800" />
                <button onClick={addDiscountItem} className="bg-yellow-500 p-1.5 rounded text-white hover:bg-yellow-400 shadow-sm"><PlusCircle size={20}/></button>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {discountItems.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-yellow-50 p-3 rounded border border-yellow-200">
                <div className="text-sm">
                  <span className="font-bold text-yellow-600">{item.line} - {item.size}</span>
                  <span className="text-slate-800 mx-2">{item.flavor}</span>
                  <span className="text-slate-500 text-xs">x{item.quantity}</span>
                </div>
                <button onClick={() => removeDiscountItem(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* --- SECTION 4: FIRST ORDER GIFTS --- */}
        {isFirstOrder && (
            <div className="bg-white p-6 rounded-xl border border-purple-200 shadow-xl relative overflow-hidden">
            <div className="absolute -right-6 top-6 bg-purple-500 text-white text-xs font-bold px-8 py-1 rotate-45">NEW USER</div>
            <h3 className="text-lg font-bold text-purple-600 mb-4 flex items-center gap-2">
                <Gift size={20}/> Tặng Đơn Đầu (Hàng tặng kèm)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 block mb-1">Tên quà tặng</label>
                  <input value={giftName} onChange={(e) => setGiftName(e.target.value)} placeholder="Nhập tên..." className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Đơn vị</label>
                  <input value={giftUnit} onChange={(e) => setGiftUnit(e.target.value)} placeholder="cái/bộ" className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 block mb-1">Đơn giá (Chỉ hiển thị)</label>
                    <input type="number" value={giftPrice} onChange={(e) => setGiftPrice(parseFloat(e.target.value))} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Số lượng</label>
                  <div className="flex gap-2">
                      <input type="number" min="1" value={giftQty} onChange={(e) => setGiftQty(parseInt(e.target.value))} className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm text-slate-800" />
                      <button onClick={addGiftItem} className="bg-purple-500 p-1.5 rounded text-white hover:bg-purple-400 shadow-sm"><PlusCircle size={20}/></button>
                  </div>
                </div>
            </div>
            <div className="mt-4 space-y-2">
                {giftItems.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-purple-50 p-3 rounded border border-purple-200">
                    <div className="text-sm">
                      <span className="font-bold text-purple-600">{item.name}</span>
                      <span className="text-slate-500 text-xs ml-2">({item.quantity} {item.unit})</span>
                      <span className="text-slate-400 text-xs ml-2 italic">- Trị giá: {formatCurrency(item.total)}</span>
                    </div>
                    <button onClick={() => removeGiftItem(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                </div>
                ))}
            </div>
            </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <button onClick={() => setStep('details')} className="text-slate-500 hover:text-baby-navy px-4">Quay lại</button>
          <button 
            disabled={iceCreamItems.length === 0 && toppingItems.length === 0 && discountItems.length === 0 && giftItems.length === 0}
            onClick={() => setStep('review')}
            className="bg-baby-accent disabled:opacity-50 text-white font-bold py-2 px-8 rounded-lg hover:bg-pink-600 transition-colors shadow-md"
          >
            Review Đơn Hàng
          </button>
        </div>
      </div>
    );
  }

  // Review Step
  const cust = customers.find(c => c.id === selectedCustId);
  const assignedSaleName = cust ? getAssignedSalesPerson(cust.id)?.fullName : user.fullName;

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl border border-slate-200 shadow-2xl">
      <h2 className="text-2xl font-bold text-baby-navy mb-6 text-center">Xác nhận đơn hàng</h2>
      
      <div className="grid grid-cols-2 gap-4 text-sm mb-6 border-b border-slate-200 pb-4">
        <div>
          <span className="text-slate-500 block">Khách hàng:</span>
          <span className="text-slate-800 font-medium">{cust?.companyName}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Ngày đặt:</span>
          <span className="text-slate-800 font-medium">{orderDate}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Hoá đơn:</span>
          <span className="text-slate-800 font-medium">{hasInvoice ? "Có xuất hoá đơn" : "Không"}</span>
        </div>
        <div>
           <span className="text-slate-500 block">Nhân viên sale phụ trách:</span>
           <span className="text-slate-800 font-medium">{assignedSaleName || user.fullName}</span>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <h3 className="font-bold text-baby-accent">Chi tiết hàng hoá</h3>
        <table className="w-full text-sm text-left text-slate-700">
            <thead className="text-xs uppercase bg-slate-100 text-slate-500 font-semibold">
                <tr>
                    <th className="px-2 py-1">Tên hàng</th>
                    <th className="px-2 py-1 text-center">SL</th>
                    <th className="px-2 py-1 text-right">Đơn giá</th>
                    <th className="px-2 py-1 text-right">Thành tiền</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {/* Regular Items */}
                {iceCreamItems.map(i => (
                    <tr key={i.id}>
                        <td className="px-2 py-2">Kem {i.line} ({i.size}) - {i.flavor}</td>
                        <td className="px-2 py-2 text-center">{i.quantity}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(i.pricePerUnit)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(i.total)}</td>
                    </tr>
                ))}
                {toppingItems.map(t => (
                    <tr key={t.id}>
                        <td className="px-2 py-2">{t.name}</td>
                        <td className="px-2 py-2 text-center">{t.quantity} {t.unit}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t.pricePerUnit)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t.total)}</td>
                    </tr>
                ))}
                
                {/* Discount Items */}
                {discountItems.map(i => (
                     <tr key={i.id} className="text-yellow-600 italic">
                        <td className="px-2 py-2">[CK] Kem {i.line} ({i.size}) - {i.flavor}</td>
                        <td className="px-2 py-2 text-center">{i.quantity}</td>
                        <td className="px-2 py-2 text-right">0 đ</td>
                        <td className="px-2 py-2 text-right">0 đ</td>
                    </tr>
                ))}
                
                 {/* Gift Items */}
                 {giftItems.map(i => (
                     <tr key={i.id} className="text-purple-600 italic bg-purple-50">
                        <td className="px-2 py-2">
                           <div>[Quà] {i.name}</div>
                           <div className="text-[10px] opacity-70">Trị giá: {formatCurrency(i.total)}</div>
                        </td>
                        <td className="px-2 py-2 text-center">{i.quantity} {i.unit}</td>
                        <td className="px-2 py-2 text-right line-through opacity-50">{formatCurrency(i.pricePerUnit)}</td>
                        <td className="px-2 py-2 text-right">0 đ</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm border border-slate-200">
        <div className="flex justify-between">
            <span className="text-slate-500">Doanh thu kem:</span>
            <span className="text-slate-800">{formatCurrency(icTotal)}</span>
        </div>
        <div className="flex justify-between border-b border-slate-200 pb-2">
            <span className="text-slate-500">Doanh thu topping:</span>
            <span className="text-slate-800">{formatCurrency(topTotal)}</span>
        </div>
        
        {/* Shipping Input */}
        <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-slate-600">
                <Truck size={16}/> <span>Phí vận chuyển & bảo quản (Bên thứ 3):</span>
            </div>
            <div className="w-40">
                <input 
                    type="number" 
                    value={shippingCost} 
                    onChange={(e) => setShippingCost(Number(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-right text-slate-800 focus:border-baby-accent outline-none"
                    min="0"
                />
            </div>
        </div>

        <div className="flex justify-between pt-2 border-t border-slate-300 text-lg font-bold text-baby-accent">
            <span>Tổng giá trị đơn hàng:</span>
            <span>{formatCurrency(finalAmount)}</span>
        </div>
        
        {/* Deposit Calculation */}
        <div className="flex justify-between pt-2 mt-2 border-t border-dashed border-slate-300 text-lg font-bold text-yellow-600">
             <span>Số tiền phải cọc (50%):</span>
             <span>{formatCurrency(deposit)}</span>
        </div>
      </div>

      <div className="flex justify-between pt-8 gap-4">
          <button onClick={() => setStep('items')} className="text-slate-500 hover:text-baby-navy px-2">Chỉnh sửa</button>
          
          <div className="flex gap-4">
            <button 
                onClick={generatePDF}
                disabled={isGeneratingPdf}
                className="bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg hover:bg-slate-300 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
                {isGeneratingPdf ? <Loader2 size={20} className="animate-spin"/> : <FileDown size={20}/>} 
                {isGeneratingPdf ? 'Đang tạo...' : 'Xuất PDF'}
            </button>
            <button 
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
                className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-500 transition-colors shadow-lg shadow-green-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isSubmitting ? <Loader2 size={20} className="animate-spin"/> : <CheckCircle size={20}/>}
                {isSubmitting ? 'Đang gửi...' : 'Submit Đơn'}
            </button>
          </div>
        </div>
    </div>
  );
};

export default OrderEntry;
