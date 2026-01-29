const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

class PDFService {
    constructor() {
        this.companyName = 'SAMWEGA WORKS LTD';
        this.companyAddress = 'Nairobi, Kenya';
        this.companyPhone = '+254 XXX XXX XXX';
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
            .text(this.companyPhone, { align: 'center' });

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

                // Summary
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

                // Summary
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
                doc.fontSize(12)
                    .font('Helvetica-Bold')
                    .text(`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`);
                doc.moveDown();

                // Summary
                doc.fontSize(14)
                    .font('Helvetica-Bold')
                    .text('Summary');
                doc.moveDown(0.5);

                doc.fontSize(10).font('Helvetica');
                const summary = reportData.summary;
                doc.text(`Total Expenses: KES ${summary.totalExpenses.toLocaleString()}`);
                doc.text(`Approved: KES ${summary.approvedExpenses.toLocaleString()}`);
                doc.text(`Pending: KES ${summary.pendingExpenses.toLocaleString()}`);
                doc.text(`Rejected: KES ${summary.rejectedExpenses.toLocaleString()}`);
                doc.moveDown();

                // By Category
                if (reportData.byCategory) {
                    doc.fontSize(14)
                        .font('Helvetica-Bold')
                        .text('Expenses by Category');
                    doc.moveDown(0.5);

                    doc.fontSize(10).font('Helvetica');
                    reportData.byCategory.forEach(cat => {
                        doc.text(`${cat.category}: KES ${cat.totalAmount.toLocaleString()} (${cat.count} transactions)`);
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
                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Total Credit: KES ${reportData.summary.totalCredit.toLocaleString()}`);
                doc.text(`Total Paid: KES ${reportData.summary.totalPaid.toLocaleString()}`);
                doc.text(`Outstanding: KES ${reportData.summary.outstanding.toLocaleString()}`);
                doc.text(`Collection Rate: ${reportData.summary.collectionRate.toFixed(2)}%`);
                doc.moveDown();

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
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.addHeader(doc, 'CUSTOMER SALES REPORT');

                // Customer Info
                if (reportData.customer) {
                    doc.fontSize(12).font('Helvetica-Bold').text('Customer Information');
                    doc.moveDown(0.5);
                    doc.fontSize(10).font('Helvetica');
                    doc.text(`Name: ${reportData.customer.name || 'N/A'}`);
                    doc.text(`Phone: ${reportData.customer.phone || 'N/A'}`);
                    doc.text(`Email: ${reportData.customer.email || 'N/A'}`);
                    doc.moveDown();
                }

                // Summary
                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Total Purchases: KES ${reportData.summary.totalPurchases.toLocaleString()}`);
                doc.text(`Total Transactions: ${reportData.summary.totalTransactions}`);
                doc.text(`Average Purchase: KES ${reportData.summary.averagePurchase.toLocaleString()}`);
                doc.text(`Outstanding Credit: KES ${reportData.summary.outstandingCredit.toLocaleString()}`);
                doc.moveDown();

                // Transactions
                if (reportData.transactions && reportData.transactions.length > 0) {
                    doc.addPage();
                    doc.fontSize(14).font('Helvetica-Bold').text('Transaction History');
                    doc.moveDown(0.5);

                    const tableTop = doc.y;
                    doc.fontSize(10).font('Helvetica-Bold');
                    doc.text('Date', 50, tableTop);
                    doc.text('Receipt', 150, tableTop);
                    doc.text('Amount', 300, tableTop);
                    doc.text('Payment', 450, tableTop);

                    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

                    let y = tableTop + 20;
                    doc.font('Helvetica');
                    reportData.transactions.slice(0, 30).forEach(txn => {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                        }
                        doc.text(new Date(txn.saleDate).toLocaleDateString(), 50, y);
                        doc.text(txn.receiptNumber, 150, y);
                        doc.text(`KES ${txn.grandTotal.toLocaleString()}`, 300, y);
                        doc.text(txn.paymentMethod, 450, y);
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
                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Total Revenue: KES ${reportData.summary.totalRevenue.toLocaleString()}`);
                doc.text(`Total Profit: KES ${reportData.summary.totalProfit.toLocaleString()}`);
                doc.text(`Total Transactions: ${reportData.summary.totalTransactions}`);
                doc.text(`Cash Collected: KES ${reportData.summary.cashCollected.toLocaleString()}`);
                doc.text(`Credit Sales: KES ${reportData.summary.creditSales.toLocaleString()}`);
                doc.moveDown();

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

                // Summary
                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Total Trips: ${reportData.summary.totalTrips}`);
                doc.text(`Total Revenue: KES ${reportData.summary.totalRevenue.toLocaleString()}`);
                doc.text(`Total Profit: KES ${reportData.summary.totalProfit.toLocaleString()}`);
                doc.text(`Average Revenue/Trip: KES ${reportData.summary.averageRevenuePerTrip.toLocaleString()}`);
                doc.moveDown();

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

    /**
     * Generate Stock Movement PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateStockMovementPDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.addHeader(doc, 'STOCK MOVEMENT REPORT');

                doc.fontSize(12).font('Helvetica-Bold')
                    .text(`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`);
                doc.moveDown();

                // Summary
                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Total Movements: ${reportData.summary.totalMovements}`);
                doc.text(`Total In: ${reportData.summary.totalIn}`);
                doc.text(`Total Out: ${reportData.summary.totalOut}`);
                doc.moveDown();

                // Movements
                if (reportData.movements && reportData.movements.length > 0) {
                    doc.addPage();
                    doc.fontSize(14).font('Helvetica-Bold').text('Movement Details');
                    doc.moveDown(0.5);

                    const tableTop = doc.y;
                    doc.fontSize(8).font('Helvetica-Bold');
                    doc.text('Date', 50, tableTop);
                    doc.text('Type', 120, tableTop);
                    doc.text('Product', 180, tableTop);
                    doc.text('Qty', 320, tableTop);
                    doc.text('From', 370, tableTop);
                    doc.text('To', 460, tableTop);

                    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

                    let y = tableTop + 20;
                    doc.font('Helvetica');
                    reportData.movements.slice(0, 50).forEach(movement => {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                        }
                        doc.text(new Date(movement.date).toLocaleDateString(), 50, y);
                        doc.text(movement.type, 120, y);
                        doc.text(movement.product.substring(0, 20), 180, y);
                        doc.text(movement.quantity.toString(), 320, y);
                        doc.text(movement.from.substring(0, 12), 370, y);
                        doc.text(movement.to.substring(0, 12), 460, y);
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

                // Summary
                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Overall Turnover Ratio: ${reportData.summary.overallTurnoverRatio.toFixed(2)}`);
                doc.text(`Average Days in Inventory: ${reportData.summary.averageDaysInInventory.toFixed(0)} days`);
                doc.text(`Fast-Moving Items: ${reportData.summary.fastMoving}`);
                doc.text(`Medium-Moving Items: ${reportData.summary.mediumMoving}`);
                doc.text(`Slow-Moving Items: ${reportData.summary.slowMoving}`);
                doc.moveDown();

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
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.addHeader(doc, 'VEHICLE INVENTORY REPORT');

                // Vehicle Info
                doc.fontSize(12).font('Helvetica-Bold')
                    .text(`Vehicle: ${reportData.vehicle.name} (${reportData.vehicle.registrationNumber})`);
                doc.text(`Assigned To: ${reportData.vehicle.assignedUser || 'N/A'}`);
                doc.moveDown();

                // Summary
                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Total Products: ${reportData.summary.totalProducts}`);
                doc.text(`Total Stock: ${reportData.summary.totalStock}`);
                doc.text(`Total Value: KES ${reportData.summary.totalValue.toLocaleString()}`);
                doc.text(`Capacity Utilization: ${reportData.summary.capacityUtilization.toFixed(2)}%`);
                if (reportData.summary.lastTransferDate) {
                    doc.text(`Last Transfer: ${new Date(reportData.summary.lastTransferDate).toLocaleDateString()}`);
                }
                doc.moveDown();

                // Products
                if (reportData.products && reportData.products.length > 0) {
                    doc.addPage();
                    doc.fontSize(14).font('Helvetica-Bold').text('Product Details');
                    doc.moveDown(0.5);

                    const tableTop = doc.y;
                    doc.fontSize(10).font('Helvetica-Bold');
                    doc.text('Product', 50, tableTop);
                    doc.text('Stock', 250, tableTop);
                    doc.text('Price', 350, tableTop);
                    doc.text('Value', 450, tableTop);

                    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

                    let y = tableTop + 20;
                    doc.font('Helvetica');
                    reportData.products.forEach(product => {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                        }
                        doc.text(product.productName.substring(0, 25), 50, y);
                        doc.text(product.stock.toString(), 250, y);
                        doc.text(`KES ${product.sellingPrice.toLocaleString()}`, 350, y);
                        doc.text(`KES ${product.value.toLocaleString()}`, 450, y);
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

    /**
     * Generate Supplier Performance PDF
     * @param {Object} reportData
     * @returns {Promise<Buffer>}
     */
    async generateSupplierPerformancePDF(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, bufferPages: true });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.addHeader(doc, 'SUPPLIER PERFORMANCE REPORT');

                doc.fontSize(12).font('Helvetica-Bold')
                    .text(`Period: ${reportData.period.startDate} to ${reportData.period.endDate}`);
                doc.moveDown();

                // Summary
                doc.fontSize(14).font('Helvetica-Bold').text('Summary');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Total Suppliers: ${reportData.summary.totalSuppliers}`);
                doc.text(`Total Purchase Value: KES ${reportData.summary.totalPurchaseValue.toLocaleString()}`);
                doc.text(`Total Products Supplied: ${reportData.summary.totalProductsSupplied}`);
                doc.moveDown();

                // Suppliers
                if (reportData.suppliers && reportData.suppliers.length > 0) {
                    doc.addPage();
                    doc.fontSize(14).font('Helvetica-Bold').text('Supplier Details');
                    doc.moveDown(0.5);

                    const tableTop = doc.y;
                    doc.fontSize(10).font('Helvetica-Bold');
                    doc.text('Supplier', 50, tableTop);
                    doc.text('Products', 250, tableTop);
                    doc.text('Purchases', 350, tableTop);
                    doc.text('Value', 450, tableTop);

                    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

                    let y = tableTop + 20;
                    doc.font('Helvetica');
                    reportData.suppliers.forEach(supplier => {
                        if (y > 700) {
                            doc.addPage();
                            y = 50;
                        }
                        doc.text(supplier.supplierName.substring(0, 25), 50, y);
                        doc.text(supplier.totalProducts.toString(), 250, y);
                        doc.text(supplier.totalPurchases.toString(), 350, y);
                        doc.text(`KES ${supplier.totalValue.toLocaleString()}`, 450, y);
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
}

module.exports = new PDFService();
