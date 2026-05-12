import { getSalesReportService } from '../../services/admin/salesReportService.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export const getSalesReportPage = async (req, res) => {
    try {
        const { filter = 'daily', startDate, endDate, page = 1, status = 'exclude_cancelled' } = req.query;
        const limit = 10;
        const { orders, stats, period, totalPages, currentPage, previousRevenue, couponUsage, topBrands, chartData } = await getSalesReportService(filter, startDate, endDate, page, limit, status);

        // Build query string for pagination links
        const queryParams = new URLSearchParams({ filter, status });
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);

        res.render('admin/analytics/salesReport', {
            title: 'Sales Report',
            orders,
            stats,
            previousRevenue,
            couponUsage,
            topBrands,
            chartData,
            filter,
            status,
            startDate,
            endDate,
            period,
            totalPages,
            currentPage,
            query: queryParams.toString(),
            breadcrumbs: [
                { label: 'Sales Report', url: '/admin/sales-report' }
            ],
        });
    } catch (error) {
        console.error('Error in getSalesReportPage:', error);
        res.status(500).render('errors/error', { message: 'Internal Server Error' });
    }
};

export const downloadSalesReport = async (req, res) => {
    try {
        const { filter = 'daily', startDate, endDate, format = 'pdf', status = 'exclude_cancelled' } = req.query;
        const { orders, stats, period } = await getSalesReportService(filter, startDate, endDate, null, null, status);

        if (format === 'pdf') {
            await generatePDFReport(res, orders, stats, period, filter);
        } else if (format === 'excel') {
            await generateExcelReport(res, orders, stats, period, filter);
        } else if (format === 'ledger') {
            await generateLedgerBook(res, orders, stats, period, filter);
        } else {
            res.status(400).send('Invalid format');
        }
    } catch (error) {
        console.error('Error in downloadSalesReport:', error);
        res.status(500).send('Internal Server Error');
    }
};

async function generateLedgerBook(res, orders, stats, period, filter) {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Ledger-Book-${filter}-${new Date().getTime()}.pdf"`);
    
    doc.pipe(res);

    // Ledger Header
    doc.rect(30, 30, 535, 40).fill('#111');
    doc.fillColor('#fff').fontSize(14).font('Helvetica-Bold').text('FINANCIAL LEDGER BOOK', 40, 45);
    doc.fontSize(8).text(`GENERATED: ${new Date().toLocaleString()}`, 400, 48, { align: 'right' });
    
    doc.moveDown(3);

    // Summary Box
    doc.rect(30, doc.y, 535, 60).stroke('#eee');
    doc.fillColor('#333').fontSize(10).font('Helvetica-Bold');
    const summaryY = doc.y + 15;
    doc.text('CREDIT (REVENUE)', 50, summaryY);
    doc.text('DEBIT (DISCOUNTS)', 200, summaryY);
    doc.text('NET BALANCE', 350, summaryY);
    
    doc.font('Helvetica').fontSize(12);
    doc.text(`₹${stats.totalRevenue.toLocaleString()}`, 50, summaryY + 20);
    doc.fillColor('#d32f2f').text(`₹${stats.totalDiscount.toLocaleString()}`, 200, summaryY + 20);
    doc.fillColor('#2e7d32').text(`₹${(stats.totalRevenue - stats.totalDiscount).toLocaleString()}`, 350, summaryY + 20);

    doc.moveDown(5);

    // Ledger Table Header
    const tableTop = doc.y;
    doc.rect(30, tableTop, 535, 20).fill('#f5f5f5');
    doc.fillColor('#333').fontSize(8).font('Helvetica-Bold');
    doc.text('DATE', 35, tableTop + 6, { width: 50 });
    doc.text('ORDER ID', 95, tableTop + 6, { width: 80 });
    doc.text('METHOD', 180, tableTop + 6, { width: 100 });
    doc.text('STATUS', 285, tableTop + 6, { width: 65, align: 'center' });
    doc.text('QTY', 355, tableTop + 6, { width: 20, align: 'center' });
    doc.text('CREDIT (+)', 380, tableTop + 6, { width: 60, align: 'right' });
    doc.text('DEBIT (-)', 445, tableTop + 6, { width: 60, align: 'right' });
    doc.text('BALANCE', 510, tableTop + 6, { width: 55, align: 'right' });

    let currentY = tableTop + 20;
    let runningBalance = 0;
    doc.font('Helvetica').fillColor('#444');

    orders.forEach((order) => {
        if (currentY > 750) {
            doc.addPage();
            currentY = 30;
        }

        const balanceBefore = runningBalance;
        runningBalance += (order.totalAmount - order.discount);
        const qty = order.items.reduce((sum, item) => sum + item.qty, 0);

        const methodMap = {
            'CASH ON DELIVERY': 'COD',
            'ONLINE PAYMENT': 'ONLINE',
            'RAZORPAY': 'ONLINE',
            'WALLET': 'WALLET'
        };
        const shortMethod = methodMap[order.paymentMethod] || order.paymentMethod;

        doc.fontSize(6.5);
        doc.text(new Date(order.createdAt).toLocaleDateString(), 35, currentY + 6, { width: 50 });
        doc.text(`#${order.orderId}`, 95, currentY + 6, { width: 80, ellipsis: true });
        doc.text(shortMethod, 180, currentY + 6, { width: 100, ellipsis: true });
        doc.text(order.orderStatus, 285, currentY + 6, { width: 65, align: 'center', ellipsis: true });
        doc.text(`${qty}`, 355, currentY + 6, { width: 20, align: 'center' });
        doc.text(`₹${order.totalAmount.toLocaleString()}`, 380, currentY + 6, { width: 60, align: 'right' });
        doc.fillColor('#d32f2f').text(`₹${order.discount.toLocaleString()}`, 445, currentY + 6, { width: 60, align: 'right' });
        doc.fillColor('#333').text(`₹${runningBalance.toLocaleString()}`, 510, currentY + 6, { width: 55, align: 'right' });

        doc.strokeColor('#eee').lineWidth(0.5).moveTo(30, currentY + 20).lineTo(565, currentY + 20).stroke();
        currentY += 20;
    });

    doc.end();
}

async function generatePDFReport(res, orders, stats, period, filter) {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Sales-Report-${filter}-${new Date().getTime()}.pdf"`);
    
    doc.pipe(res);

    // Header
    doc.fillColor('#ff6a00').fontSize(20).text('STARZO MOBILES', { align: 'center' });
    doc.fillColor('#333').fontSize(16).text('Sales Report', { align: 'center' });
    doc.fontSize(10).text(`Period: ${filter.toUpperCase()}`, { align: 'center' });
    if (period.start && period.end) {
        doc.fontSize(8).text(`${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}`, { align: 'center' });
    }
    doc.moveDown();

    // Stats Summary
    doc.rect(30, doc.y, 535, 60).fill('#f9f9f9');
    doc.fillColor('#333').fontSize(10);
    const summaryY = doc.y + 15;
    doc.text(`Total Orders: ${stats.totalSales}`, 50, summaryY);
    doc.text(`Total Revenue: ₹${stats.totalRevenue.toLocaleString()}`, 200, summaryY);
    doc.text(`Total Discount: ₹${stats.totalDiscount.toLocaleString()}`, 380, summaryY);
    doc.moveDown(4);

    // Table Header
    const tableTop = doc.y;
    doc.rect(30, tableTop, 535, 20).fill('#333');
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
    doc.text('Order ID', 35, tableTop + 6, { width: 75 });
    doc.text('Date', 115, tableTop + 6, { width: 50 });
    doc.text('Customer', 170, tableTop + 6, { width: 75 });
    doc.text('Qty', 250, tableTop + 6, { width: 20, align: 'center' });
    doc.text('Method', 275, tableTop + 6, { width: 100 });
    doc.text('Status', 380, tableTop + 6, { width: 60, align: 'center' });
    doc.text('Amount', 445, tableTop + 6, { width: 60, align: 'right' });
    doc.text('Discount', 510, tableTop + 6, { width: 55, align: 'right' });

    // Table Rows
    let currentY = tableTop + 20;
    doc.font('Helvetica').fillColor('#333');

    orders.forEach((order, index) => {
        if (currentY > 750) {
            doc.addPage();
            currentY = 30;
        }

        if (index % 2 === 1) {
            doc.rect(30, currentY, 535, 20).fill('#f1f1f1');
        }
        
        const qty = order.items.reduce((sum, item) => sum + item.qty, 0);

        const methodMap = {
            'CASH ON DELIVERY': 'COD',
            'ONLINE PAYMENT': 'ONLINE',
            'RAZORPAY': 'ONLINE',
            'WALLET': 'WALLET'
        };
        const shortMethod = methodMap[order.paymentMethod] || order.paymentMethod;

        doc.fillColor('#333').fontSize(7);
        doc.text(order.orderId, 35, currentY + 6, { width: 75, ellipsis: true });
        doc.text(new Date(order.createdAt).toLocaleDateString(), 115, currentY + 6, { width: 50 });
        doc.text(order.user ? `${order.user.firstName} ${order.user.lastName}` : 'N/A', 170, currentY + 6, { width: 75, height: 10, ellipsis: true });
        doc.text(`${qty}`, 250, currentY + 6, { width: 20, align: 'center' });
        doc.text(shortMethod, 275, currentY + 6, { width: 100, ellipsis: true });
        doc.text(order.orderStatus, 380, currentY + 6, { width: 60, align: 'center', ellipsis: true });
        doc.text(`₹${order.totalAmount.toLocaleString()}`, 445, currentY + 6, { width: 60, align: 'right' });
        doc.text(`₹${order.discount.toLocaleString()}`, 510, currentY + 6, { width: 55, align: 'right' });

        currentY += 20;
    });

    doc.end();
}

async function generateExcelReport(res, orders, stats, period, filter) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add metadata at the top
    worksheet.addRow(['STARZO MOBILES SALES REPORT']).font = { bold: true, size: 16 };
    worksheet.addRow([`Generated At: ${new Date().toLocaleString()}`]).font = { italic: true };
    
    const periodStr = period.start && period.end 
        ? `${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}`
        : filter.toUpperCase();
    worksheet.addRow([`Report Period: ${periodStr}`]).font = { bold: true };
    worksheet.addRow([]); // Spacer

    // Define columns
    worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Qty', key: 'qty', width: 10 },
        { header: 'Payment Method', key: 'paymentMethod', width: 20 },
        { header: 'Total Amount', key: 'totalAmount', width: 15 },
        { header: 'Discount', key: 'discount', width: 15 },
        { header: 'Status', key: 'status', width: 15 }
    ];

    // Style the header row (which is now row 5 because of 4 rows of metadata)
    const headerRow = worksheet.getRow(5);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF333333' }
        };
    });

    orders.forEach(order => {
        const methodMap = {
            'CASH ON DELIVERY': 'COD',
            'ONLINE PAYMENT': 'ONLINE',
            'RAZORPAY': 'ONLINE',
            'WALLET': 'WALLET'
        };
        worksheet.addRow({
            orderId: order.orderId,
            date: new Date(order.createdAt).toLocaleDateString(),
            customer: order.user ? `${order.user.firstName} ${order.user.lastName}` : 'N/A',
            qty: order.items.reduce((sum, item) => sum + item.qty, 0),
            paymentMethod: methodMap[order.paymentMethod] || order.paymentMethod,
            totalAmount: order.totalAmount,
            discount: order.discount,
            status: order.orderStatus
        });
    });

    // Add summary row
    worksheet.addRow([]);
    const totalRow = worksheet.addRow({
        orderId: 'TOTAL',
        totalAmount: stats.totalRevenue,
        discount: stats.totalDiscount
    });
    totalRow.font = { bold: true };
    totalRow.getCell('totalAmount').numFmt = '₹#,##0';
    totalRow.getCell('discount').numFmt = '₹#,##0';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Sales-Report-${filter}-${new Date().getTime()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
}
