import { Alert, Platform, PermissionsAndroid, LogBox } from 'react-native';
import { BLEPrinter } from 'react-native-thermal-receipt-printer';

// Suppress the NativeEventEmitter warnings caused by react-native-thermal-receipt-printer
LogBox.ignoreLogs(['new NativeEventEmitter() was called with a non-null argument without the required `addListener` method', 'new NativeEventEmitter() was called with a non-null argument without the required `removeListeners` method']);

// Constants for 58mm printer
// Standard 58mm thermal printers usually support 32 characters per line with normal font
const PRINTER_WIDTH = 32; // 58mm printers print 32 characters per line in normal font

class ReceiptService {
    constructor() {
        this.printerWidth = PRINTER_WIDTH;
        this.isConnected = false;
        this.isInitialized = false;
        // Do NOT call this.init() here because permissions haven't been granted yet
    }

    async init() {
        if (this.isInitialized) return;
        try {
            if (BLEPrinter && typeof BLEPrinter.init === 'function') {
                await BLEPrinter.init();
                this.isInitialized = true;
                console.log('[ReceiptService] BLEPrinter initialized');
            } else {
                console.warn('[ReceiptService] BLEPrinter or BLEPrinter.init not available');
            }
        } catch (err) {
            console.warn('[ReceiptService] Failed to initialize BLEPrinter:', err);
        }
    }

    /**
     * Center text within the printer width
     * @param {string} text 
     * @returns {string}
     */
    centerText(text) {
        if (text.length >= this.printerWidth) return text.substring(0, this.printerWidth);
        const padding = Math.max(0, Math.floor((this.printerWidth - text.length) / 2));
        return ' '.repeat(padding) + text;
    }

    /**
     * Create a row with label and value (Left - Right)
     * @param {string} label 
     * @param {string} value 
     * @returns {string}
     */
    createRow(label, value) {
        const valueStr = String(value);
        const labelStr = String(label);

        // If label + value fits
        if (labelStr.length + valueStr.length + 1 <= this.printerWidth) {
            const spaces = Math.max(1, this.printerWidth - labelStr.length - valueStr.length);
            return labelStr + ' '.repeat(spaces) + valueStr;
        }

        // If not, wrap label. 
        // Base case: If label is already empty, just return value (truncated if necessary to avoid recursion)
        if (!labelStr) {
            return valueStr.substring(0, this.printerWidth);
        }

        // If value itself is too long for one line, truncate it or handle it
        // To avoid infinite recursion, we truncate the label if it's very long and somehow causing issues
        const safeLabel = labelStr.substring(0, this.printerWidth);

        return safeLabel + '\n' + this.createRow('', valueStr);
    }

    /**
     * Format a line with fixed-width cells
     * @param {Array<{text: string, width: number, align: string}>} cells 
     * @returns {string}
     */
    formatLine(cells) {
        let line = '';
        cells.forEach(cell => {
            let text = String(cell.text || '');
            const width = Math.max(0, cell.width || 0);
            const align = cell.align || 'left';

            if (text.length > width && width > 3) {
                text = text.substring(0, width - 3) + '...';
            } else if (text.length > width) {
                text = text.substring(0, width);
            }

            const padding = Math.max(0, width - text.length);
            if (align === 'right') {
                line += ' '.repeat(padding) + text;
            } else if (align === 'center') {
                const leftPad = Math.floor(padding / 2);
                const rightPad = padding - leftPad;
                line += ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
            } else {
                line += text + ' '.repeat(padding);
            }
        });
        return line;
    }

    /**
     * Create a divider line
     * @returns {string}
     */
    createDivider() {
        return '-'.repeat(Math.max(0, this.printerWidth));
    }

    /**
     * Darker divider for receipts ("=" prints heavier than "-")
     * @returns {string}
     */
    createStrongDivider() {
        return '='.repeat(this.printerWidth);
    }

    /**
     * Format currency
     * @param {number} amount 
     * @returns {string}
     */
    formatCurrency(amount) {
        return parseFloat(amount).toFixed(1).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }

    /**
     * Money for receipt lines: 6700 -> "6,700", 6700.5 -> "6,700.50"
     * @param {number|string} amount
     * @returns {string}
     */
    formatMoney(amount) {
        const n = Number(amount) || 0;
        const hasCents = Math.round(n * 100) % 100 !== 0;
        return n.toLocaleString('en-US', {
            minimumFractionDigits: hasCents ? 2 : 0,
            maximumFractionDigits: 2,
        });
    }

    /**
     * Quantity: 2 -> "2", 2.5 -> "2.5"
     * @param {number|string} qty
     * @returns {string}
     */
    formatQty(qty) {
        return (Number(qty) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    /**
     * Wrap text to a width, breaking on spaces. Very long words are split.
     * @param {string} text
     * @param {number} width
     * @returns {string[]}
     */
    wrapText(text, width) {
        const words = String(text || '').split(/\s+/).filter(Boolean);
        const lines = [];
        let current = '';
        words.forEach((word) => {
            let w = word;
            while (w.length > width) {
                if (current) { lines.push(current); current = ''; }
                lines.push(w.slice(0, width));
                w = w.slice(width);
            }
            if (!current) current = w;
            else if (current.length + 1 + w.length <= width) current += ' ' + w;
            else { lines.push(current); current = w; }
        });
        if (current) lines.push(current);
        return lines.length ? lines : [''];
    }

    /**
     * Item lines: name on its own line, then "qty x price = amount" underneath.
     * @param {Array} items
     * @returns {string[]}
     */
    generateItemLines(items) {
        const lines = [];
        items.forEach((item, index) => {
            const qty = Number(item.quantity) || 0;
            const unit = Number(item.unitPrice) || 0;
            const lineTotal = item.totalPrice !== undefined && item.totalPrice !== null
                ? Number(item.totalPrice)
                : qty * unit;

            this.wrapText(item.productName || 'Unknown', this.printerWidth).forEach((t) => lines.push(t));
            lines.push(`  ${this.formatQty(qty)} x ${this.formatMoney(unit)} = ${this.formatMoney(lineTotal)}`);
            if (index < items.length - 1) lines.push(' '); // small gap between items
        });
        return lines;
    }

    /**
     * Generate receipt text for a sale
     * Font tags: <CD> large centred, <CM> medium centred, <C> centred, <L> left.
     * Do not use <B> here: in this printer library <B> means a large font, not bold.
     * @param {Object} sale
     * @returns {string}
     */
    generateReceipt(sale) {
        if (!sale) return 'Invalid Sale Data';

        const date = new Date(sale.createdAt || sale.saleDate || new Date()).toLocaleString('en-KE', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });

        const line = (text) => `<L>${text}</L>\n`;
        const divider = () => this.createStrongDivider() + '\n';
        // "Label: value", wrapped if long (no space-padding, the printer font is not fixed-width)
        const field = (label, value) =>
            this.wrapText(`${label}: ${value}`, this.printerWidth).map((part) => line(part)).join('');

        let receipt = '';

        // STORE: name on one line
        receipt += '<CD>SAMWEGA WORKS LTD</CD>\n';
        receipt += '<C>GILGIL, KENYA</C>\n';
        receipt += '\n';

        // DOCUMENT TYPE
        receipt += '<CM>RECEIPT</CM>\n';
        receipt += '\n';

        // DETAILS
        receipt += field('Receipt', sale.receiptNumber || 'Pending');
        receipt += field('Date', date);
        receipt += field('Served by', sale.salesRepName || 'Admin');
        if (sale.customerName) receipt += field('Customer', sale.customerName);
        if (sale.storeName) receipt += field('Store', sale.storeName);
        receipt += divider();

        // ITEMS
        receipt += line('ITEM');
        receipt += line('  Qty x Price = Amount');
        receipt += this.createDivider() + '\n';
        this.generateItemLines(sale.items || []).forEach((l) => { receipt += line(l); });
        receipt += divider();

        // TOTALS
        receipt += line(`Subtotal: ${this.formatMoney(sale.subtotal || 0)}`);
        if (sale.taxAmount > 0) {
            receipt += line(`Tax: ${this.formatMoney(sale.taxAmount)}`);
        }
        if (sale.discountAmount > 0) {
            receipt += line(`Discount: -${this.formatMoney(sale.discountAmount)}`);
        }
        receipt += `<CM>TOTAL: ${this.formatMoney(sale.grandTotal || 0)}</CM>\n`;
        receipt += divider();

        // PAYMENTS
        const METHOD_LABELS = { cash: 'Cash', mpesa: 'M-Pesa', bank: 'Bank', credit: 'On credit' };
        // Bank payments name the bank, e.g. "Bank (Old Absa)"
        const labelFor = (method, bankName) => {
            const key = String(method || 'cash').toLowerCase();
            if (key === 'bank' && bankName) return `Bank (${bankName})`;
            return METHOD_LABELS[key] || String(method);
        };
        if (sale.payments && sale.payments.length > 0) {
            sale.payments.forEach((p) => {
                receipt += line(`${labelFor(p.method, p.bankName || sale.bankName)}: ${this.formatMoney(p.amount)}`);
            });
        } else {
            receipt += line(`${labelFor(sale.paymentMethod, sale.bankName)}: ${this.formatMoney(sale.grandTotal || 0)}`);
        }
        receipt += divider();

        // FOOTER
        receipt += '<C>Thank you for shopping</C>\n';
        receipt += '<C>with Samwega Works</C>\n';
        receipt += '<C>Contact us: 0113689071</C>\n';
        receipt += '\n\n\n'; // Feed lines

        return receipt;
    }

    /**
     * Generate report text for inventory
     * @param {Array} inventory 
     * @param {Object} vehicleInfo
     * @returns {string}
     */
    generateInventoryReport(inventory, vehicleInfo = {}) {
        if (!inventory || !Array.isArray(inventory)) return 'No Inventory Data';

        const date = new Date().toLocaleString('en-KE', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });

        let report = '';

        // HEADER
        report += '<C><B>SAMWEGA WORKS LTD</B></C>\n';
        report += '<C>GILGIL, KENYA</C>\n';
        report += '<C>Tel: 0113689071</C>\n';
        report += '\n';

        // METADATA
        report += `<C><B>INVENTORY REPORT</B></C>\n`;
        report += `<L>Date:    ${date}</L>\n`;
        if (vehicleInfo.vehicleNumber || vehicleInfo.vehicleName) {
            report += `<L>Vehicle: ${vehicleInfo.vehicleNumber || vehicleInfo.vehicleName}</L>\n`;
        }
        report += this.createDivider() + '\n';

        // Item (20) Ld (6) Sd (6) Rm (6) | Total 38
        const columns = [
            { text: 'Item', width: 20 },
            { text: 'Ld', width: 6, align: 'right' },
            { text: 'Sd', width: 6, align: 'right' },
            { text: 'Rem', width: 6, align: 'right' }
        ];

        report += `<B>${this.formatLine(columns)}</B>\n`;
        report += this.createDivider() + '\n';
        report += '\n'; // Add space after header

        // ITEMS
        inventory.forEach(item => {
            const rowData = [
                { text: item.itemName || 'Unknown', width: 20 },
                { text: String(item.quantityLoaded || 0), width: 6, align: 'right' },
                { text: String(item.quantitySold || 0), width: 6, align: 'right' },
                { text: String(item.quantityRemaining || 0), width: 6, align: 'right' }
            ];

            report += `<L>${this.formatLine(rowData)}</L>\n\n`; // Add vertical spacing between rows
        });

        report += this.createDivider() + '\n';
        report += '\n';

        // FOOTER
        report += '<C>Samwega Inventory Management</C>\n';
        report += '\n\n\n'; // Feed lines

        return report;
    }

    async requestBluetoothPermissions() {
        if (Platform.OS === 'android') {
            try {
                if (Platform.Version >= 31) {
                    console.log('[ReceiptService] Requesting Android 12+ Bluetooth permissions');
                    const granted = await PermissionsAndroid.requestMultiple([
                        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    ]);

                    return (
                        granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
                        granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
                    );
                } else {
                    console.log('[ReceiptService] Requesting legacy location permission for Bluetooth');
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                    );
                    return granted === PermissionsAndroid.RESULTS.GRANTED;
                }
            } catch (err) {
                console.warn('[ReceiptService] Permission request failed:', err);
                return false;
            }
        }
        return true;
    }

    async connect() {
        if (this.isConnected) return true;

        try {
            // Request permissions first on Android
            const hasPermission = await this.requestBluetoothPermissions();
            if (!hasPermission) {
                console.warn('[ReceiptService] Bluetooth permissions denied');
                return false;
            }

            // Initialize AFTER permissions are granted
            await this.init();

            console.log('[ReceiptService] Scanning for printers...');
            const devices = await BLEPrinter.getDeviceList();
            console.log('[ReceiptService] Found devices:', devices);

            if (devices && devices.length > 0) {
                // Try connecting to each device until successful
                for (const device of devices) {
                    try {
                        const deviceName = device.device_name || device.name || 'Unknown';
                        console.log(`[ReceiptService] Attempting to connect to ${deviceName} (${device.inner_mac_address})`);

                        if (BLEPrinter && typeof BLEPrinter.connectPrinter === 'function') {
                            const connectPromise = BLEPrinter.connectPrinter(device.inner_mac_address);
                            const timeoutPromise = new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Connection timeout - printer may be off or out of range')), 8000)
                            );
                            
                            await Promise.race([connectPromise, timeoutPromise]);
                            
                            this.isConnected = true;
                            console.log(`[ReceiptService] Connected successfully to ${deviceName}`);
                            return true;
                        } else {
                            throw new Error('BLEPrinter.connectPrinter is not a function');
                        }
                    } catch (connErr) {
                        console.warn(`[ReceiptService] Failed to connect to ${device.device_name || 'Unknown'}:`, connErr);
                        // Continue to next device
                    }
                }

                console.warn('[ReceiptService] Could not connect to any printer');
                return false;
            } else {
                console.warn('[ReceiptService] No printers found');
                return false;
            }
        } catch (error) {
            console.error('[ReceiptService] Connection failed:', error);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Print receipt
     * @param {string} content 
     */
    async print(content) {
        console.log('[ReceiptService] Printing content:\n', content);

        if (!BLEPrinter) {
            console.error('[ReceiptService] BLEPrinter library is undefined. Native module not linked?');
            throw new Error('Printer library not loaded. Please rebuild the app (npm run android).');
        }

        try {
            // Ensure connected
            if (!this.isConnected) {
                const connected = await this.connect();
                if (!connected) {
                    throw new Error('No printer connected. Ensure Bluetooth is ON and printer is paired.');
                }
            }

            if (BLEPrinter && typeof BLEPrinter.printBill === 'function') {
                await BLEPrinter.printBill(content);
            } else {
                throw new Error('Printer native module (printBill) is not available.');
            }

        } catch (error) {
            console.error('[ReceiptService] Print failed:', error);
            this.isConnected = false; // Reset connection status on failure
            throw error;
        }
    }
}

export default new ReceiptService();
