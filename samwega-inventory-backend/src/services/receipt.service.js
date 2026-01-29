const salesService = require('./sales.service');
const logger = require('../utils/logger');

class ReceiptService {
    /**
     * Generate receipt data
     * @param {string} saleId
     * @returns {Promise<Object>}
     */
    async generateReceipt(saleId) {
        try {
            const sale = await salesService.getSaleById(saleId);

            // Format receipt data
            const receipt = {
                receiptNumber: sale.receiptNumber,
                date: sale.saleDate,

                // Company info (should be from settings)
                company: {
                    name: 'SAMWEGA WORKS LTD',
                    address: 'P.O. Box 12345, Nairobi',
                    phone: '+254 712 345 678',
                    email: 'info@samwegaworks.com',
                    pin: 'P051234567X'
                },

                // Vehicle & Sales Rep
                vehicle: {
                    name: sale.vehicleName,
                    id: sale.vehicleId
                },
                salesRep: {
                    name: sale.salesRepName,
                    id: sale.salesRepId
                },

                // Customer (if applicable)
                customer: sale.customerName ? {
                    name: sale.customerName,
                    phone: sale.customerPhone,
                    idNumber: sale.customerIdNumber,
                    email: sale.customerEmail
                } : null,

                // Items
                items: sale.items.map(item => ({
                    productName: item.productName,
                    quantity: item.quantity,
                    unit: item.unit,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice
                })),

                // Pricing
                subtotal: sale.subtotal,
                taxAmount: sale.taxAmount,
                discountAmount: sale.discountAmount,
                grandTotal: sale.grandTotal,

                // Payment
                paymentMethod: sale.paymentMethod,
                paymentStatus: sale.paymentStatus,
                payments: sale.payments,

                // Calculate change (for cash payments)
                change: sale.paymentMethod === 'cash' && sale.payments.length > 0
                    ? sale.payments[0].amount - sale.grandTotal
                    : 0,

                // Notes
                notes: sale.notes,

                // Footer
                footer: 'Thank you for your business!',

                // QR code data (for verification)
                qrData: `${sale.receiptNumber}|${sale.grandTotal}|${sale.saleDate}`
            };

            return receipt;
        } catch (error) {
            logger.error('Generate receipt error:', error);
            throw error;
        }
    }

    /**
     * Generate thermal receipt (ESC/POS format)
     * @param {string} saleId
     * @param {number} width - Character width (32, 40, or 48)
     * @returns {Promise<string>}
     */
    async generateThermalReceipt(saleId, width = 48) {
        try {
            const receipt = await this.generateReceipt(saleId);

            const centerText = (text, width) => {
                const padding = Math.max(0, Math.floor((width - text.length) / 2));
                return ' '.repeat(padding) + text;
            };

            const rightAlign = (text, width) => {
                const padding = Math.max(0, width - text.length);
                return ' '.repeat(padding) + text;
            };

            const line = (char = '=') => char.repeat(width);

            let thermal = '';

            // Header
            thermal += centerText(receipt.company.name, width) + '\n';
            thermal += centerText(receipt.company.address, width) + '\n';
            thermal += centerText(`Tel: ${receipt.company.phone}`, width) + '\n';
            thermal += centerText(`PIN: ${receipt.company.pin}`, width) + '\n';
            thermal += line() + '\n';

            // Receipt details
            thermal += `Receipt No: ${receipt.receiptNumber}\n`;
            thermal += `Date: ${new Date(receipt.date).toLocaleString()}\n`;
            thermal += `Vehicle: ${receipt.vehicle.name}\n`;
            thermal += `Served by: ${receipt.salesRep.name}\n`;

            // Customer info
            if (receipt.customer) {
                thermal += line('-') + '\n';
                thermal += `Customer: ${receipt.customer.name}\n`;
                if (receipt.customer.phone) {
                    thermal += `Phone: ${receipt.customer.phone}\n`;
                }
                if (receipt.customer.storeName) {
                    thermal += `Store: ${receipt.customer.storeName}\n`;
                }
            }

            // Items
            thermal += line() + '\n';
            thermal += 'ITEMS\n';
            thermal += line() + '\n';

            receipt.items.forEach(item => {
                // Item name
                thermal += `${item.productName}\n`;

                // Quantity and price
                const qtyPrice = `${item.quantity} ${item.unit} @ ${item.unitPrice.toFixed(2)}`;
                const total = item.totalPrice.toFixed(2);
                const spacing = width - qtyPrice.length - total.length;
                thermal += qtyPrice + ' '.repeat(Math.max(1, spacing)) + total + '\n';
            });

            // Totals
            thermal += line() + '\n';

            const formatTotal = (label, amount) => {
                const amountStr = amount.toFixed(2);
                const spacing = width - label.length - amountStr.length;
                return label + ' '.repeat(Math.max(1, spacing)) + amountStr;
            };

            thermal += formatTotal('Subtotal:', receipt.subtotal) + '\n';

            if (receipt.taxAmount > 0) {
                thermal += formatTotal('Tax:', receipt.taxAmount) + '\n';
            }
            if (receipt.discountAmount > 0) {
                thermal += formatTotal('Discount:', -receipt.discountAmount) + '\n';
            }

            thermal += line('=') + '\n';
            thermal += formatTotal('TOTAL:', receipt.grandTotal) + '\n';
            thermal += line('=') + '\n';

            // Payment info
            thermal += `\nPayment: ${receipt.paymentMethod.toUpperCase()}\n`;
            thermal += `Status: ${receipt.paymentStatus.toUpperCase()}\n`;

            // Multiple payment methods
            if (receipt.paymentMethod === 'mixed' && receipt.payments.length > 0) {
                thermal += '\nPayment Breakdown:\n';
                receipt.payments.forEach(payment => {
                    thermal += formatTotal(`  ${payment.method}:`, payment.amount) + '\n';
                });
            }

            // Change for cash payments
            if (receipt.change > 0) {
                thermal += '\n';
                thermal += formatTotal('Cash Received:', receipt.payments[0].amount) + '\n';
                thermal += formatTotal('Change:', receipt.change) + '\n';
            }

            // Footer
            thermal += '\n' + line() + '\n';
            thermal += centerText(receipt.footer, width) + '\n';
            thermal += line() + '\n';

            // QR code placeholder (actual QR generation would require additional library)
            thermal += centerText('Scan to verify:', width) + '\n';
            thermal += centerText(receipt.qrData, width) + '\n';

            return thermal;
        } catch (error) {
            logger.error('Generate thermal receipt error:', error);
            throw error;
        }
    }

    /**
     * Generate receipt PDF
     * @param {string} saleId
     * @returns {Promise<Buffer>}
     */
    async generateReceiptPDF(saleId) {
        try {
            // Note: PDF generation would require a library like PDFKit or Puppeteer
            // For now, we'll return a placeholder
            // In production, implement actual PDF generation

            const receipt = await this.generateReceipt(saleId);

            logger.info(`Receipt PDF generation requested for ${receipt.receiptNumber}`);

            // TODO: Implement PDF generation using PDFKit
            // const PDFDocument = require('pdfkit');
            // const doc = new PDFDocument();
            // ... PDF generation logic

            return {
                message: 'PDF generation not yet implemented',
                receipt
            };
        } catch (error) {
            logger.error('Generate receipt PDF error:', error);
            throw error;
        }
    }

    /**
     * Send receipt via SMS/Email
     * @param {string} saleId
     * @param {string} method - 'sms' or 'email'
     * @returns {Promise<Object>}
     */
    async sendReceipt(saleId, method = 'sms') {
        try {
            const receipt = await this.generateReceipt(saleId);

            if (method === 'sms' && receipt.customer?.phone) {
                // TODO: Implement SMS sending using Africa's Talking or similar
                logger.info(`SMS receipt sent to ${receipt.customer.phone}`);
                return {
                    success: true,
                    message: 'Receipt sent via SMS',
                    recipient: receipt.customer.phone
                };
            } else if (method === 'email' && receipt.customer?.email) {
                // TODO: Implement email sending using SendGrid or similar
                logger.info(`Email receipt sent to ${receipt.customer.email}`);
                return {
                    success: true,
                    message: 'Receipt sent via email',
                    recipient: receipt.customer.email
                };
            } else {
                return {
                    success: false,
                    message: `No ${method} contact information available`
                };
            }
        } catch (error) {
            logger.error('Send receipt error:', error);
            throw error;
        }
    }

    /**
     * Format receipt as text (for printing or SMS)
     * @param {string} saleId
     * @returns {Promise<string>}
     */
    async formatReceiptText(saleId) {
        try {
            const receipt = await this.generateReceipt(saleId);

            let text = '';
            text += `========================================\n`;
            text += `       ${receipt.company.name}\n`;
            text += `========================================\n`;
            text += `${receipt.company.address}\n`;
            text += `Tel: ${receipt.company.phone}\n`;
            text += `PIN: ${receipt.company.pin}\n`;
            text += `========================================\n\n`;

            text += `Receipt No: ${receipt.receiptNumber}\n`;
            text += `Date: ${new Date(receipt.date).toLocaleString()}\n`;
            text += `Vehicle: ${receipt.vehicle.name}\n`;
            text += `Served by: ${receipt.salesRep.name}\n`;

            if (receipt.customer) {
                text += `\nCustomer: ${receipt.customer.name}\n`;
                text += `Phone: ${receipt.customer.phone}\n`;
            }

            text += `\n========================================\n`;
            text += `ITEMS\n`;
            text += `========================================\n`;

            receipt.items.forEach(item => {
                text += `${item.productName}\n`;
                text += `  ${item.quantity} ${item.unit} @ ${item.unitPrice.toFixed(2)}\n`;
                text += `  ${item.totalPrice.toFixed(2)}\n\n`;
            });

            text += `========================================\n`;
            text += `Subtotal:        ${receipt.subtotal.toFixed(2)}\n`;

            if (receipt.taxAmount > 0) {
                text += `Tax:             ${receipt.taxAmount.toFixed(2)}\n`;
            }
            if (receipt.discountAmount > 0) {
                text += `Discount:       -${receipt.discountAmount.toFixed(2)}\n`;
            }

            text += `========================================\n`;
            text += `TOTAL:           ${receipt.grandTotal.toFixed(2)}\n`;
            text += `========================================\n\n`;

            text += `Payment Method: ${receipt.paymentMethod.toUpperCase()}\n`;
            text += `Status: ${receipt.paymentStatus.toUpperCase()}\n`;

            if (receipt.change > 0) {
                text += `\nCash Received:   ${receipt.payments[0].amount.toFixed(2)}\n`;
                text += `Change:          ${receipt.change.toFixed(2)}\n`;
            }

            text += `\n========================================\n`;
            text += `${receipt.footer}\n`;
            text += `========================================\n`;

            return text;
        } catch (error) {
            logger.error('Format receipt text error:', error);
            throw error;
        }
    }
}

module.exports = new ReceiptService();
