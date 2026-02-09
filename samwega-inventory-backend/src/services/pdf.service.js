const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

class PDFService {
    constructor() {
        this.companyName = 'SAMWEGA WORKS LTD';
        this.companyAddress = 'Gilgil, Kenya';
        this.companyPhone = '0113689071';
    }

    /**
     * Create PDF header
     * @param {PDFDocument} doc
     * @param {string} title
     */
    addHeader(doc, title) {
        doc.fontSize(20)
            .font('Helvetica-Bold')
            .text(this.companyName, 50, 50, { align: 'center' });

        doc.fontSize(10)
            .font('Helvetica')
            .text(this.companyAddress, { align: 'center' })
            .text(`Tel: ${this.companyPhone}`, { align: 'center' });

        doc.moveDown();
        doc.fontSize(16)
            .font('Helvetica-Bold')
            .text(title, { align: 'center' });

        doc.moveDown();
        doc.moveTo(50, doc.y)
            .lineTo(550, doc.y)
            .stroke();

        doc.moveDown();
    }

    /**
     * Create PDF footer
     * @param {PDFDocument} doc
     */
    addFooter(doc) {
        try {
            const range = doc.bufferedPageRange();
            if (!range || range.count === 0) {
                // No buffered pages, add footer to current page only
                doc.fontSize(8)
                    .font('Helvetica')
                    .text(
                        `Generated on ${new Date().toLocaleString()} | Page 1 of 1`,
                        50,
                        doc.page.height - 50,
                        { align: 'center', width: doc.page.width - 100 }
                    );
                return;
            }

            const pageCount = range.count;
            for (let i = range.start; i < range.start + pageCount; i++) {
                doc.switchToPage(i);
                doc.fontSize(8)
                    .font('Helvetica')
                    .text(
                        `Generated on ${new Date().toLocaleString()} | Page ${i - range.start + 1} of ${pageCount}`,
                        50,
                        doc.page.height - 50,
                        { align: 'center', width: doc.page.width - 100 }
                    );
            }
        } catch (error) {
            // If footer fails, log but don't crash
            logger.warn('Could not add footer to PDF:', error.message);
        }
    }

    /**
     * Generate Detailed Sales Report PDF (Tabulated)
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateDetailedSalesReportPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 30, bufferPages: true, layout: 'landscape' });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Header
                this.addHeader(doc, 'DETAILED SALES REPORT');

                // Period
                doc.fontSize(12)
                    .font('Helvetica-Bold')
                    .text(`Period: ${reportData.startDate} to ${reportData.endDate}`);
                doc.moveDown();

                // Table Header
                const tableTop = doc.y;
                const colX = {
                    date: 30,
                    receipt: 100,
                    customer: 180,
                    item: 300,
                    code: 430,
                    qty: 500,
                    amount: 550,
                    total: 650
                };

                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('Date', colX.date, tableTop);
                doc.text('Receipt', colX.receipt, tableTop);
                doc.text('Customer', colX.customer, tableTop);
                doc.text('Item', colX.item, tableTop);
                doc.text('Code', colX.code, tableTop);
                doc.text('Qty', colX.qty, tableTop);
                doc.text('Amount', colX.amount, tableTop);

                doc.moveTo(30, tableTop + 15)
                    .lineTo(770, tableTop + 15)
                    .stroke();

                let y = tableTop + 20;
                doc.font('Helvetica');

                let grandTotal = 0;

                // Flatten sales items
                const allItems = [];
                if (reportData.sales && Array.isArray(reportData.sales)) {
                    reportData.sales.forEach(sale => {
                        if (sale.items && Array.isArray(sale.items)) {
                            sale.items.forEach(item => {
                                allItems.push({
                                    date: sale.saleDate,
                                    receipt: sale.receiptNumber,
                                    customer: sale.customerName || 'Walk-in',
                                    itemName: item.productName,
                                    itemCode: item.shortCode || item.inventoryId?.substring(0, 6) || 'N/A', // Try to get 6 digit code
                                    quantity: item.quantity,
                                    amount: item.totalPrice
                                });
                                grandTotal += (item.totalPrice || 0);
                            });
                        }
                    });
                }

                // Sort by date desc
                allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

                allItems.forEach(row => {
                    if (y > 500) {
                        doc.addPage();
                        y = 50;

                        // Re-draw header on new page
                        doc.fontSize(9).font('Helvetica-Bold');
                        doc.text('Date', colX.date, y);
                        doc.text('Receipt', colX.receipt, y);
                        doc.text('Customer', colX.customer, y);
                        doc.text('Item', colX.item, y);
                        doc.text('Code', colX.code, y);
                        doc.text('Qty', colX.qty, y);
                        doc.text('Amount', colX.amount, y);

                        doc.moveTo(30, y + 15).lineTo(770, y + 15).stroke();
                        y += 20;
                        doc.font('Helvetica');
                    }

                    doc.fontSize(8);
                    doc.text(new Date(row.date).toLocaleDateString(), colX.date, y);
                    doc.text(row.receipt, colX.receipt, y);
                    doc.text(row.customer.substring(0, 20), colX.customer, y);
                    doc.text(row.itemName.substring(0, 25), colX.item, y);
                    doc.text(row.itemCode, colX.code, y);
                    doc.text(row.quantity.toString(), colX.qty, y);
                    doc.text(row.amount.toLocaleString(), colX.amount, y);

                    y += 15;
                });

                // Grand Total
                y += 10;
                doc.moveTo(30, y).lineTo(770, y).stroke();
                y += 10;
                doc.fontSize(10).font('Helvetica-Bold');
                doc.text('GRAND TOTAL:', colX.qty - 50, y);
                doc.text(`KES ${grandTotal.toLocaleString()}`, colX.amount, y);

                // Footer
                this.addFooter(doc);

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate Sales Report PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateSalesReportPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Header
                this.addHeader(doc, 'SALES REPORT');

                // Period
                doc.fontSize(12)
                    .font('Helvetica-Bold')
                    .text(`Period: ${reportData.startDate} to ${reportData.endDate}`);
                doc.moveDown();

                // Top Products
                if (reportData.topProducts && reportData.topProducts.length > 0) {
                    doc.addPage();
                    doc.fontSize(14)
                        .font('Helvetica-Bold')
                        .text('Top Products');
                    doc.moveDown(0.5);

                    // Table header
                    const tableTop = doc.y;
                    doc.fontSize(10).font('Helvetica-Bold');
                    doc.text('Product', 50, tableTop);
                    doc.text('Quantity', 250, tableTop);
                    doc.text('Revenue', 350, tableTop);
                    doc.text('Profit', 450, tableTop);

                    doc.moveTo(50, tableTop + 15)
                        .lineTo(550, tableTop + 15)
                        .stroke();

                    // Table rows
                    let y = tableTop + 20;
                    doc.font('Helvetica');
                    reportData.topProducts.slice(0, 20).forEach((product, i) => {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                        }
                        doc.text(product.productName, 50, y);
                        doc.text(product.quantity.toString(), 250, y);
                        doc.text(`KES ${product.revenue.toLocaleString()}`, 350, y);
                        doc.text(`KES ${product.profit.toLocaleString()}`, 450, y);
                        y += 20;
                    });
                    doc.moveDown();
                }

                // Summary
                doc.addPage();
                doc.fontSize(14)
                    .font('Helvetica-Bold')
                    .text('Summary');
                doc.moveDown(0.5);

                doc.fontSize(10)
                    .font('Helvetica');

                const summary = reportData.summary;
                doc.text(`Total Revenue: KES ${summary.totalRevenue.toLocaleString()}`);
                doc.text(`Total Transactions: ${summary.totalTransactions}`);
                doc.text(`Average Sale Value: KES ${summary.averageSaleValue.toLocaleString()}`);
                doc.text(`Total Profit: KES ${summary.totalProfit.toLocaleString()}`);
                doc.text(`Profit Margin: ${summary.profitMargin.toFixed(2)}%`);
                doc.moveDown();

                // Payment Methods
                if (reportData.paymentMethods) {
                    doc.fontSize(14)
                        .font('Helvetica-Bold')
                        .text('Payment Methods');
                    doc.moveDown(0.5);

                    doc.fontSize(10).font('Helvetica');
                    Object.entries(reportData.paymentMethods).forEach(([method, amount]) => {
                        doc.text(`${method.toUpperCase()}: KES ${amount.toLocaleString()}`);
                    });
                    doc.moveDown();
                }

                // Footer
                this.addFooter(doc);

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate Inventory Report PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateInventoryReportPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Header
                this.addHeader(doc, 'INVENTORY REPORT');

                // Low Stock Items
                if (reportData.lowStockItems && reportData.lowStockItems.length > 0) {
                    doc.fontSize(14)
                        .font('Helvetica-Bold')
                        .text('Low Stock Alert');
                    doc.moveDown(0.5);

                    const tableTop = doc.y;
                    doc.fontSize(10).font('Helvetica-Bold');
                    doc.text('Product', 50, tableTop);
                    doc.text('Current Stock', 300, tableTop);
                    doc.text('Reorder Level', 450, tableTop);

                    doc.moveTo(50, tableTop + 15)
                        .lineTo(550, tableTop + 15)
                        .stroke();

                    let y = tableTop + 20;
                    doc.font('Helvetica');
                    reportData.lowStockItems.forEach(item => {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                        }
                        doc.text(item.productName, 50, y);
                        doc.text(item.stock.toString(), 300, y);
                        doc.text(item.reorderLevel.toString(), 450, y);
                        y += 20;
                    });
                }

                // Summary
                doc.moveDown();
                if (doc.y > 600) doc.addPage(); // Avoid splitting summary
                doc.fontSize(14)
                    .font('Helvetica-Bold')
                    .text('Summary');
                doc.moveDown(0.5);

                doc.fontSize(10).font('Helvetica');
                const summary = reportData.summary;
                doc.text(`Total Items: ${summary.totalItems}`);
                doc.text(`Total Value: KES ${summary.totalValue.toLocaleString()}`);
                doc.text(`Low Stock Items: ${summary.lowStockCount}`);
                doc.text(`Out of Stock Items: ${summary.outOfStockCount}`);
                doc.moveDown();

                // Footer
                this.addFooter(doc);

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate Profit & Loss PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateProfitLossPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Header
                this.addHeader(doc, 'PROFIT & LOSS STATEMENT');

                // Period
                doc.fontSize(12)
                    .font('Helvetica-Bold')
                    .text(`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`);
                doc.moveDown(2);

                // Revenue Section
                doc.fontSize(14)
                    .font('Helvetica-Bold')
                    .text('REVENUE');
                doc.moveDown(0.5);

                doc.fontSize(10).font('Helvetica');
                doc.text(`Sales Revenue: KES ${reportData.revenue.sales.toLocaleString()}`, { indent: 20 });
                doc.moveDown(0.5);
                doc.font('Helvetica-Bold');
                doc.text(`Total Revenue: KES ${reportData.revenue.total.toLocaleString()}`);
                doc.moveDown(2);

                // Expenses Section
                doc.fontSize(14)
                    .font('Helvetica-Bold')
                    .text('EXPENSES');
                doc.moveDown(0.5);

                doc.fontSize(10).font('Helvetica');
                Object.entries(reportData.expenses).forEach(([category, amount]) => {
                    if (category !== 'total') {
                        doc.text(`${category.charAt(0).toUpperCase() + category.slice(1)}: KES ${amount.toLocaleString()}`, { indent: 20 });
                    }
                });
                doc.moveDown(0.5);
                doc.font('Helvetica-Bold');
                doc.text(`Total Expenses: KES ${reportData.expenses.total.toLocaleString()}`);
                doc.moveDown(2);

                // Net Profit
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .fillColor(reportData.netProfit >= 0 ? 'green' : 'red')
                    .text(`NET ${reportData.netProfit >= 0 ? 'PROFIT' : 'LOSS'}: KES ${Math.abs(reportData.netProfit).toLocaleString()}`);

                doc.fillColor('black');
                doc.fontSize(12)
                    .font('Helvetica')
                    .text(`Profit Margin: ${reportData.profitMargin.toFixed(2)}%`);

                // Footer
                this.addFooter(doc);

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate Expense Report PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateExpenseReportPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Header
                this.addHeader(doc, 'EXPENSE REPORT');

                // Period
                doc.fontSize(10).font('Helvetica-Bold');
                doc.text(`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`, 50, 95);

                // Summary Box (Right aligned)
                const summary = reportData.summary;
                doc.fontSize(10).text(`Total Expenses: KES ${summary.totalExpenses.toLocaleString()}`, 400, 95, { align: 'right' });
                doc.text(`Approved: KES ${summary.approvedExpenses.toLocaleString()}`, 400, 110, { align: 'right' });
                doc.moveDown();

                // Table Configuration
                const tableTop = 140;
                const colX = {
                    date: 30,
                    desc: 110,
                    category: 400,
                    amount: 500
                };

                // Table Header
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('Date', colX.date, tableTop);
                doc.text('Description', colX.desc, tableTop);
                doc.text('Category', colX.category, tableTop);
                doc.text('Amount (KES)', colX.amount, tableTop, { align: 'right', width: 60 });

                doc.moveTo(30, tableTop + 15)
                    .lineTo(560, tableTop + 15)
                    .stroke();

                let y = tableTop + 25;
                doc.font('Helvetica');

                if (reportData.expenses && reportData.expenses.length > 0) {
                    reportData.expenses.forEach((exp, index) => {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                            // Re-draw header
                            doc.fontSize(9).font('Helvetica-Bold');
                            doc.text('Date', colX.date, y);
                            doc.text('Description', colX.desc, y);
                            doc.text('Category', colX.category, y);
                            doc.text('Amount (KES)', colX.amount, y, { align: 'right', width: 60 });
                            doc.moveTo(30, y + 15).lineTo(560, y + 15).stroke();
                            y += 25;
                            doc.font('Helvetica');
                        }

                        // Zebra striping
                        if (index % 2 === 0) {
                            doc.fillColor('#f9fafb');
                            doc.rect(30, y - 5, 530, 20).fill();
                            doc.fillColor('black');
                        }

                        const dateStr = new Date(exp.expenseDate?._seconds * 1000 || exp.expenseDate).toLocaleDateString();
                        const desc = exp.description || exp.reason || 'N/A';

                        doc.fontSize(8);
                        doc.text(dateStr, colX.date, y);
                        doc.text(desc.substring(0, 55) + (desc.length > 55 ? '...' : ''), colX.desc, y, { width: 280 });
                        doc.text(exp.category || '-', colX.category, y);

                        doc.text(exp.amount?.toLocaleString() || '0', colX.amount, y, { align: 'right', width: 60 });

                        y += 20;
                    });
                } else {
                    doc.text("No expenses found for this period.", colX.date, y);
                }

                // Final Summary at Bottom
                y += 20;
                doc.moveTo(30, y).lineTo(560, y).stroke();
                y += 15;

                doc.fontSize(10).font('Helvetica-Bold');
                doc.text('SUMMARY BY CATEGORY', 30, y);
                y += 20;

                if (reportData.byCategory) {
                    reportData.byCategory.forEach(cat => {
                        doc.fontSize(9).font('Helvetica');
                        doc.text(`${cat.category}:`, 30, y);
                        doc.text(`KES ${cat.totalAmount.toLocaleString()}`, 150, y);
                        doc.text(`(${cat.count} txns)`, 250, y);
                        y += 15;
                    });
                }

                // Footer
                this.addFooter(doc);

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }


    /**
     * Generate Credit Sales & Debts PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateCreditSalesPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.addHeader(doc, 'CREDIT SALES & DEBTS REPORT');

                doc.fontSize(12).font('Helvetica-Bold')
                    .text(`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`);
                doc.moveDown();

                // Summary
                // Summary moved to bottom

                // Aging Analysis
                doc.fontSize(14).font('Helvetica-Bold').text('Aging Analysis');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`0-30 days: KES ${reportData.aging.current.toLocaleString()}`);
                doc.text(`31-60 days: KES ${reportData.aging.days31to60.toLocaleString()}`);
                doc.text(`61-90 days: KES ${reportData.aging.days61to90.toLocaleString()}`);
                doc.text(`Over 90 days: KES ${reportData.aging.over90.toLocaleString()}`);
                doc.moveDown();

                // Top Debtors
                if (reportData.customers && reportData.customers.length > 0) {
                    doc.addPage();
                    doc.fontSize(14).font('Helvetica-Bold').text('Top Debtors');
                    doc.moveDown(0.5);

                    const tableTop = doc.y;
                    doc.fontSize(10).font('Helvetica-Bold');
                    doc.text('Customer', 50, tableTop);
                    doc.text('Phone', 200, tableTop);
                    doc.text('Outstanding', 350, tableTop);

                    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

                    let y = tableTop + 20;
                    doc.font('Helvetica');
                    reportData.customers.slice(0, 20).forEach(customer => {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                        }
                        doc.text(customer.customerName || 'N/A', 50, y);
                        doc.text(customer.customerPhone || 'N/A', 200, y);
                        doc.text(`KES ${customer.outstanding.toLocaleString()}`, 350, y);
                        y += 20;
                    });
                }

                // Summary
                doc.moveDown();
                if (doc.y > 600) doc.addPage();
                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Total Credit: KES ${reportData.summary.totalCredit.toLocaleString()}`);
                doc.text(`Total Paid: KES ${reportData.summary.totalPaid.toLocaleString()}`);
                doc.text(`Outstanding: KES ${reportData.summary.outstanding.toLocaleString()}`);
                doc.text(`Collection Rate: ${reportData.summary.collectionRate.toFixed(2)}%`);
                doc.moveDown();

                this.addFooter(doc);
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate Customer Sales PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateCustomerSalesPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                // Use landscape layout for better table width
                const doc = new PDFDocument({ margin: 30, bufferPages: true, layout: 'landscape' });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Header
                this.addHeader(doc, 'CUSTOMER SALES REPORT');

                // Customer Info & Period
                doc.fontSize(10).font('Helvetica-Bold');
                doc.text(`Customer: ${reportData.customer?.name || 'N/A'} (${reportData.customer?.phone || 'N/A'})`, 30, 95);
                doc.text(`Period: ${reportData.startDate || ''} to ${reportData.endDate || ''}`, 30, 110);

                // Summary Box (Right aligned)
                doc.fontSize(10).text(`Total Purchases: KES ${reportData.summary?.totalPurchases?.toLocaleString() || '0'}`, 550, 95);
                doc.text(`Outstanding Credit: KES ${reportData.summary?.outstandingCredit?.toLocaleString() || '0'}`, 550, 110);

                doc.moveDown();

                // Table Configuration
                const tableTop = 140;
                const colX = {
                    date: 30,
                    receipt: 110,
                    items: 200,
                    amount: 550,
                    payment: 630,
                    status: 700
                };

                // Table Header
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('Date', colX.date, tableTop);
                doc.text('Receipt #', colX.receipt, tableTop);
                doc.text('Items', colX.items, tableTop);
                doc.text('Amount', colX.amount, tableTop);
                doc.text('Payment', colX.payment, tableTop);
                doc.text('Status', colX.status, tableTop);

                doc.moveTo(30, tableTop + 15)
                    .lineTo(770, tableTop + 15)
                    .stroke();

                let y = tableTop + 25;
                doc.font('Helvetica');

                // Transactions Loop
                if (reportData.transactions && reportData.transactions.length > 0) {
                    reportData.transactions.forEach((txn, index) => {
                        if (y > 500) {
                            doc.addPage();
                            y = 50;
                            // Re-draw header on new page
                            doc.fontSize(9).font('Helvetica-Bold');
                            doc.text('Date', colX.date, y);
                            doc.text('Receipt #', colX.receipt, y);
                            doc.text('Items', colX.items, y);
                            doc.text('Amount', colX.amount, y);
                            doc.text('Payment', colX.payment, y);
                            doc.text('Status', colX.status, y);
                            doc.moveTo(30, y + 15).lineTo(770, y + 15).stroke();
                            y += 25;
                            doc.font('Helvetica');
                        }

                        // Format Items List
                        let itemsText = "";
                        if (txn.items && Array.isArray(txn.items)) {
                            itemsText = txn.items.map(i => `${i.quantity}x ${i.productName}`).join(', ');
                        } else {
                            itemsText = "N/A";
                        }

                        // Truncate long item lists
                        if (itemsText.length > 60) itemsText = itemsText.substring(0, 60) + "...";

                        // Zebra striping for rows
                        if (index % 2 === 0) {
                            doc.fillColor('#f9fafb');
                            doc.rect(30, y - 5, 740, 20).fill();
                            doc.fillColor('black');
                        }

                        // Date Formatting
                        const dateStr = new Date(txn.saleDate?._seconds * 1000 || txn.saleDate).toLocaleDateString();
                        const timeStr = new Date(txn.saleDate?._seconds * 1000 || txn.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        doc.fontSize(8);
                        doc.text(`${dateStr} ${timeStr}`, colX.date, y);
                        doc.text(txn.receiptNumber || '-', colX.receipt, y);
                        doc.text(itemsText, colX.items, y, { width: 340 });
                        doc.text(`KES ${txn.grandTotal?.toLocaleString() || '0'}`, colX.amount, y);
                        doc.text(txn.paymentMethod || '-', colX.payment, y);

                        // Status Color
                        if (txn.paymentMethod === 'credit') {
                            doc.fillColor('#d97706'); // Amber for credit
                        } else {
                            doc.fillColor('#059669'); // Emerald/Green for paid
                        }
                        doc.text(txn.paymentMethod === 'credit' ? 'Credit' : 'Paid', colX.status, y);
                        doc.fillColor('black'); // Reset color

                        y += 20;
                    });
                } else {
                    doc.text("No transactions found for this period.", colX.date, y);
                }

                // Final Summary at Bottom
                y += 20;
                doc.moveTo(30, y).lineTo(770, y).stroke();
                y += 15;

                doc.fontSize(10).font('Helvetica-Bold');
                doc.text('SUMMARY', 30, y);
                y += 20;
                doc.fontSize(9).font('Helvetica');
                doc.text(`Total Transactions: ${reportData.summary?.totalTransactions || 0}`, 30, y);
                doc.text(`Total Purchases: KES ${reportData.summary?.totalPurchases?.toLocaleString() || 0}`, 200, y);
                doc.text(`Total Paid: KES ${reportData.summary?.totalPaid?.toLocaleString() || 0}`, 400, y);
                doc.text(`Outstanding Credit: KES ${reportData.summary?.outstandingCredit?.toLocaleString() || 0}`, 600, y);

                this.addFooter(doc);
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate Trip Sales PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateTripSalesPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.addHeader(doc, 'TRIP SALES REPORT');

                // Trip Info
                doc.fontSize(12).font('Helvetica-Bold').text(`Trip Date: ${reportData.tripDate}`);
                doc.text(`Vehicle: ${reportData.vehicle.name} (${reportData.vehicle.registrationNumber})`);
                doc.moveDown();

                // Summary
                // Summary moved to bottom

                // Sales
                if (reportData.sales && reportData.sales.length > 0) {
                    doc.addPage();
                    doc.fontSize(14).font('Helvetica-Bold').text('Sales Details');
                    doc.moveDown(0.5);

                    const tableTop = doc.y;
                    doc.fontSize(10).font('Helvetica-Bold');
                    doc.text('Time', 50, tableTop);
                    doc.text('Receipt', 150, tableTop);
                    doc.text('Amount', 300, tableTop);
                    doc.text('Payment', 450, tableTop);

                    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

                    let y = tableTop + 20;
                    doc.font('Helvetica');
                    reportData.sales.forEach(sale => {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                        }
                        doc.text(new Date(sale.saleDate).toLocaleTimeString(), 50, y);
                        doc.text(sale.receiptNumber, 150, y);
                        doc.text(`KES ${sale.grandTotal.toLocaleString()}`, 300, y);
                        doc.text(sale.paymentMethod, 450, y);
                        y += 20;
                    });
                }

                // Summary
                doc.moveDown();
                if (doc.y > 600) doc.addPage();
                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Total Revenue: KES ${reportData.summary.totalRevenue.toLocaleString()}`);
                doc.text(`Total Profit: KES ${reportData.summary.totalProfit.toLocaleString()}`);
                doc.text(`Total Transactions: ${reportData.summary.totalTransactions}`);
                doc.text(`Cash Collected: KES ${reportData.summary.cashCollected.toLocaleString()}`);
                doc.text(`Credit Sales: KES ${reportData.summary.creditSales.toLocaleString()}`);
                doc.moveDown();

                this.addFooter(doc);
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate Vehicle Trip History PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateVehicleTripHistoryPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.addHeader(doc, 'VEHICLE TRIP HISTORY');

                // Vehicle Info
                doc.fontSize(12).font('Helvetica-Bold')
                    .text(`Vehicle: ${reportData.vehicle.name} (${reportData.vehicle.registrationNumber})`);
                doc.text(`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`);
                doc.moveDown();

                // Summary moved to bottom

                // Trips
                if (reportData.trips && reportData.trips.length > 0) {
                    doc.addPage();
                    doc.fontSize(14).font('Helvetica-Bold').text('Trip History');
                    doc.moveDown(0.5);

                    const tableTop = doc.y;
                    doc.fontSize(10).font('Helvetica-Bold');
                    doc.text('Date', 50, tableTop);
                    doc.text('Transactions', 200, tableTop);
                    doc.text('Revenue', 350, tableTop);
                    doc.text('Profit', 480, tableTop);

                    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

                    let y = tableTop + 20;
                    doc.font('Helvetica');
                    reportData.trips.forEach(trip => {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                        }
                        doc.text(trip.date, 50, y);
                        doc.text(trip.transactions.toString(), 200, y);
                        doc.text(`KES ${trip.revenue.toLocaleString()}`, 350, y);
                        doc.text(`KES ${trip.profit.toLocaleString()}`, 480, y);
                        y += 20;
                    });
                }

                this.addFooter(doc);
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }


    async generateStockMovementPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 30, bufferPages: true, layout: 'landscape' });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.addHeader(doc, 'STOCK MOVEMENT REPORT');

                doc.fontSize(10).font('Helvetica-Bold')
                    .text(`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`, 30, doc.y);
                if (reportData.filters && Object.keys(reportData.filters).length > 0) {
                    doc.fontSize(8).font('Helvetica')
                        .text(`Filters: ${JSON.stringify(reportData.filters)}`, 30, doc.y + 12);
                }
                doc.moveDown();

                // Summary Section (Bottom) - we'll add it at the end

                // Main Table
                if (reportData.movements && reportData.movements.length > 0) {
                    if (doc.y > 450) doc.addPage();

                    doc.moveDown();
                    const tableTop = doc.y;

                    // Columns: Date, Item, Qty, Cost, Total, Origin, Dest, Veh, Ref, User
                    const col = {
                        date: 30,
                        item: 100, // Shifted left to take up space
                        qty: 300,
                        cost: 340,
                        val: 390,
                        orig: 450,
                        dest: 510,
                        veh: 570,
                        ref: 630,
                        user: 690
                    };

                    doc.fontSize(8).font('Helvetica-Bold');
                    doc.text('Date & Time', col.date, tableTop);
                    // Removed Type
                    doc.text('Item Name', col.item, tableTop);
                    // Removed Cat
                    doc.text('Qty', col.qty, tableTop);
                    doc.text('Cost', col.cost, tableTop);
                    doc.text('Value', col.val, tableTop);
                    doc.text('Origin', col.orig, tableTop);
                    doc.text('Dest', col.dest, tableTop);
                    doc.text('Vehicle', col.veh, tableTop);
                    doc.text('Ref', col.ref, tableTop);
                    doc.text('User', col.user, tableTop);

                    doc.moveTo(30, tableTop + 12).lineTo(770, tableTop + 12).stroke();

                    let y = tableTop + 15;
                    doc.font('Helvetica');

                    reportData.movements.forEach(m => {
                        if (y > 500) {
                            doc.addPage();
                            y = 50;
                            // Header again
                            doc.fontSize(8).font('Helvetica-Bold');
                            doc.text('Date & Time', col.date, y);
                            // Removed Type
                            doc.text('Item Name', col.item, y);
                            // Removed Cat
                            doc.text('Qty', col.qty, y);
                            doc.text('Cost', col.cost, y);
                            doc.text('Value', col.val, y);
                            doc.text('Origin', col.orig, y);
                            doc.text('Dest', col.dest, y);
                            doc.text('Vehicle', col.veh, y);
                            doc.text('Ref', col.ref, y);
                            doc.text('User', col.user, y);
                            doc.moveTo(30, y + 12).lineTo(770, y + 12).stroke();
                            y += 15;
                            doc.font('Helvetica');
                        }

                        doc.fontSize(7);
                        // Increased height to allow wrapping (width option enabled)
                        // Removed substring limits to show full content
                        // y increment increased to 30 to prevent overwrite
                        doc.text(new Date(m.date).toLocaleString(), col.date, y, { width: 55 });
                        // Removed Type data
                        doc.text(m.itemName, col.item, y, { width: 180 }); // Increased width for Item Name
                        // Removed Cat data
                        doc.text(m.quantity.toString(), col.qty, y, { width: 35 });
                        doc.text((m.unitCost || 0).toFixed(0), col.cost, y, { width: 45 });
                        doc.text((m.totalValue || 0).toLocaleString(), col.val, y, { width: 55 });
                        doc.text(m.origin || '-', col.orig, y, { width: 55 });
                        doc.text(m.destination || '-', col.dest, y, { width: 55 });
                        doc.text(m.vehicle || '-', col.veh, y, { width: 55 });
                        doc.text(m.reference || '-', col.ref, y, { width: 55 });
                        doc.text(m.recordedBy || '-', col.user, y, { width: 70 });

                        // Line separator (positioned lower)
                        doc.moveTo(30, y + 25).lineTo(770, y + 25).lineWidth(0.1).stroke();
                        y += 30; // Double line spacing (approx)
                    });
                } else {
                    doc.moveDown();
                    doc.text('No movements found for this period.');
                }

                // Summary Section
                doc.addPage();
                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown();

                const sumX = 50;
                const sumValX = 300;
                doc.fontSize(10).font('Helvetica');

                const drawSum = (label, val) => {
                    doc.text(label, sumX, doc.y);
                    doc.text(val, sumValX, doc.y);
                    doc.moveDown(0.5);
                };

                if (reportData.summary) {
                    drawSum('Total Movements:', reportData.summary.totalMovements.toString());
                    drawSum('Total Units Received:', reportData.summary.totalUnitsReceived.toString());
                    drawSum('Total Units Issued to Vehicles:', reportData.summary.totalUnitsIssued.toString());
                    drawSum('Total Units Sold:', reportData.summary.totalUnitsSold.toString());
                    drawSum('Total Units Returned:', reportData.summary.totalUnitsReturned.toString());
                    drawSum('Total Value Moved:', `KES ${reportData.summary.totalValueMoved.toLocaleString()}`);
                }

                this.addFooter(doc);
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate Inventory Turnover PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateInventoryTurnoverPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.addHeader(doc, 'INVENTORY TURNOVER REPORT');

                doc.fontSize(12).font('Helvetica-Bold')
                    .text(`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`);
                doc.moveDown();

                // Summary moved to bottom

                // Products
                if (reportData.products && reportData.products.length > 0) {
                    doc.addPage();
                    doc.fontSize(14).font('Helvetica-Bold').text('Product Turnover');
                    doc.moveDown(0.5);

                    const tableTop = doc.y;
                    doc.fontSize(9).font('Helvetica-Bold');
                    doc.text('Product', 50, tableTop);
                    doc.text('Sold', 250, tableTop);
                    doc.text('Turnover', 320, tableTop);
                    doc.text('Days', 410, tableTop);
                    doc.text('Category', 470, tableTop);

                    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

                    let y = tableTop + 20;
                    doc.font('Helvetica');
                    reportData.products.slice(0, 30).forEach(product => {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                        }
                        doc.text(product.productName.substring(0, 25), 50, y);
                        doc.text(product.quantitySold.toString(), 250, y);
                        doc.text(product.turnoverRatio.toFixed(2), 320, y);
                        doc.text(product.daysInInventory.toFixed(0), 410, y);
                        doc.text(product.category, 470, y);
                        y += 15;
                    });
                }

                this.addFooter(doc);
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate Enhanced Vehicle Inventory PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateEnhancedVehicleInventoryPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 30, bufferPages: true, layout: 'landscape' });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.addHeader(doc, 'VEHICLE INVENTORY REPORT');

                // Vehicle Info
                doc.fontSize(12).font('Helvetica-Bold')
                    .text(`Vehicle: ${reportData.vehicle.name} (${reportData.vehicle.registrationNumber || 'N/A'})`, 50);
                doc.text(`Assigned To: ${reportData.vehicle.assignedUser || 'Unassigned'}`);
                doc.moveDown();

                // Summary moved to bottom

                // Main Data Table
                if (reportData.data && reportData.data.length > 0) {
                    doc.moveDown();

                    // Check if we have enough space for header + at least one row, else add page
                    if (doc.y > 450) {
                        doc.addPage();
                    }

                    doc.fontSize(14).font('Helvetica-Bold').text('Inventory Details');
                    doc.moveDown(0.5);

                    const tableTop = doc.y;

                    // Column positions
                    const col = {
                        item: 30,
                        sold: 340,
                        rem: 420,
                        price: 500,
                        valRem: 610
                    };

                    doc.fontSize(9).font('Helvetica-Bold');
                    doc.text('Item', col.item, tableTop);
                    doc.text('Sold', col.sold, tableTop);
                    doc.text('Rem', col.rem, tableTop);
                    doc.text('Min Price', col.price, tableTop);
                    doc.text('Val Rem', col.valRem, tableTop);

                    doc.moveTo(30, tableTop + 15).lineTo(770, tableTop + 15).stroke();

                    let y = tableTop + 20;
                    doc.font('Helvetica');

                    reportData.data.forEach(row => {
                        if (y > 500) {
                            doc.addPage();
                            y = 50;
                            // Re-draw header
                            doc.fontSize(9).font('Helvetica-Bold');
                            doc.text('Item', col.item, y);
                            doc.text('Sold', col.sold, y);
                            doc.text('Rem', col.rem, y);
                            doc.text('Min Price', col.price, y);
                            doc.text('Val Rem', col.valRem, y);
                            doc.moveTo(30, y + 15).lineTo(770, y + 15).stroke();
                            y += 20;
                            doc.font('Helvetica');
                        }

                        doc.fontSize(8);
                        doc.text(row.itemName.substring(0, 40), col.item, y);
                        doc.text((row.quantitySold || 0).toString(), col.sold, y);
                        doc.text((row.quantityRemaining || 0).toString(), col.rem, y);
                        doc.text((row.minimumPrice || 0).toLocaleString(), col.price, y);
                        doc.text((row.totalValueRemaining || 0).toLocaleString(), col.valRem, y);

                        // Row separate line
                        doc.moveTo(30, y + 12).lineTo(770, y + 12).lineWidth(0.5).stroke();

                        y += 15;
                    });
                } else {
                    doc.moveDown();
                    doc.font('Helvetica-Oblique').text('No inventory items found on this vehicle.', 50);
                }

                // Summary (Moved to Bottom)
                if (doc.y > 600) {
                    doc.addPage();
                } else {
                    doc.moveDown(2);
                }

                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown(0.5);

                // Define summary positions
                const sumLabelX = 50;
                const sumValueX = 250;

                doc.fontSize(10).font('Helvetica');

                const drawSummaryRow = (label, value) => {
                    const y = doc.y;
                    doc.text(label, sumLabelX, y);
                    doc.text(value, sumValueX, y);
                    doc.moveDown();
                };

                drawSummaryRow('Total Value Loaded:', `KES ${reportData.summary.totalValueLoadedStock.toLocaleString()}`);
                drawSummaryRow('Total Value Sold:', `KES ${reportData.summary.totalValueSold.toLocaleString()}`);
                drawSummaryRow('Total Value Remaining:', `KES ${reportData.summary.totalValueRemaining.toLocaleString()}`);

                doc.moveDown();

                this.addFooter(doc);
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

}

module.exports = new PDFService();
