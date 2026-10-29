/**
 * Turns "who did what" into a plain sentence for the activity log,
 * e.g. "Nancy removed 12 x Ordinary nails (stock 40 -> 28)".
 *
 * It reads only what the request and the response already contain, so it never needs an
 * extra database read, and it must never throw: anything missing falls back to a simpler sentence.
 */

const money = (n) => `KES ${(Number(n) || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
const pick = (...vals) => vals.find(v => v !== undefined && v !== null && v !== '');
const count = (n, word) => `${n} ${word}${Number(n) === 1 ? '' : 's'}`;
const LAYER = ['carton', 'box', 'piece'];

function describeActivity({ action, resource, req, data, actor, lookups = {} }) {
    const body = (req && req.body) || {};
    const d = (data && typeof data === 'object') ? data : {};
    const id = req && req.params && req.params.id;
    const key = `${resource}:${action}`;
    const extra = {};
    let text = null;
    // invoice the stock was received on (looked up by the logger when the request carried an invoiceId)
    const inv = lookups.invoice || null;
    const onInvoice = inv ? ` on invoice ${inv.invoiceNumber}${inv.supplierName ? ' (' + inv.supplierName + ')' : ''}` : (body.invoiceId ? ' on an invoice' : '');
    if (inv) extra.invoiceNumber = inv.invoiceNumber;
    if (body.invoiceId) extra.invoiceId = body.invoiceId;

    switch (key) {
        // ---------------- products / stock ----------------
        case 'inventory:ADJUST_STOCK': {
            const adj = Number(body.adjustment);
            const name = pick(d.productName, d.name, 'a product');
            if (!adj) break;
            extra.productName = name;
            extra.quantity = adj; // + added, - removed
            text = `${adj > 0 ? 'added' : 'removed'} ${Math.abs(adj)} x ${name}${onInvoice}`;
            if (body.reason) text += ` (${String(body.reason).replace(/_/g, ' ')})`;
            if (typeof d.stock === 'number') {
                extra.before = d.stock - adj;
                extra.after = d.stock;
                text += `, stock ${extra.before} -> ${extra.after}`;
            }
            break;
        }
        case 'inventory:REPLENISH': {
            const qty = Number(body.quantity);
            const name = pick(d.productName, d.name, 'a product');
            if (!qty) break;
            const layer = LAYER[body.layerIndex] || null;
            extra.productName = name;
            extra.quantity = qty;
            extra.unit = layer || 'piece';
            if (body.buyingPrice) extra.buyingPrice = Number(body.buyingPrice);
            text = `received ${layer ? count(qty, layer) : qty} of ${name}${onInvoice}`;
            if (body.buyingPrice) text += ` at ${money(body.buyingPrice)}`;
            if (typeof d.stock === 'number') { extra.after = d.stock; text += `, stock now ${d.stock}`; }
            break;
        }
        case 'inventory:CREATE': text = `added a new product: ${pick(d.productName, body.productName, body.name, 'unnamed')}`; break;
        case 'inventory:UPDATE': text = `edited product ${pick(d.productName, body.productName, id, '')}`.trim(); break;
        case 'inventory:DELETE': text = `deleted product ${pick(d.productName, id, '')}`.trim(); break;
        case 'inventory:BULK_IMPORT':
            text = `imported products (${(d.success || []).length} added, ${(d.failed || []).length} failed)`; break;

        // ---------------- invoices ----------------
        case 'invoice:CREATE':
            text = `created invoice ${pick(d.invoiceNumber, body.invoiceNumber, '')} for ${pick(d.supplierName, 'a supplier')}`.replace(/\s+/g, ' '); break;
        case 'invoice:UPDATE': text = `edited invoice ${pick(d.invoiceNumber, body.invoiceNumber, id, '')}`.trim(); break;
        case 'invoice:RECORD_PAYMENT':
            text = `recorded a ${money(body.amount)}${body.paymentMethod ? ' ' + body.paymentMethod : ''} payment on invoice ${pick(d.invoiceNumber, id, '')}`.trim();
            extra.amount = Number(body.amount) || null; break;
        case 'invoice:REVERSE':
            text = `reversed invoice ${pick(d.invoiceNumber, id, '')}${body.reason ? ': ' + body.reason : ''}`.trim(); break;
        case 'invoice:DELETE': text = `deleted invoice ${pick(d.invoiceNumber, id, '')}`.trim(); break;
        case 'invoice:REMOVE_ITEMS':
            text = `removed ${count((body.adjustmentIds || body.ids || []).length || 'some', 'item')} from invoice ${pick(d.invoiceNumber, id, '')}`.trim(); break;
        case 'invoice:CLEANUP':
            text = `ran invoice clean-up "${body.action}"${body.dryRun === false ? ` (${d.count || 0} changed)` : ' (preview only)'}`; break;

        // ---------------- suppliers ----------------
        case 'supplier:CREATE': text = `added supplier ${pick(d.name, body.name, '')}`.trim(); break;
        case 'supplier:UPDATE': text = `edited supplier ${pick(d.name, body.name, id, '')}`.trim(); break;
        case 'supplier:DELETE': text = `deleted supplier ${pick(d.name, id, '')}`.trim(); break;
        case 'supplier:RECALCULATE': text = `rebuilt supplier totals from invoices${d.invoices !== undefined ? ` (${d.invoices} invoices)` : ''}`; break;

        // ---------------- expenses ----------------
        case 'expense:CREATE':
            text = `recorded a ${money(pick(d.amount, body.amount))} ${pick(d.category, body.category, '')} expense${pick(d.vehicleName, body.vehicleName) ? ' for ' + pick(d.vehicleName, body.vehicleName) : ''}`.replace(/\s+/g, ' '); break;
        case 'expense:CREATE_BATCH': text = `recorded a batch of expenses`; break;
        case 'expense:APPROVE':
            text = `${pick(body.status, d.status) === 'rejected' ? 'rejected' : 'approved'} a ${money(d.amount)} ${pick(d.category, '')} expense${d.vehicleName ? ' for ' + d.vehicleName : ''}`.replace(/\s+/g, ' '); break;
        case 'expense:UPDATE': text = `edited an expense${d.category ? ' (' + d.category + ')' : ''}`; break;
        case 'expense:DELETE': text = `deleted an expense`; break;

        // ---------------- sales ----------------
        case 'sale:CREATE':
            text = `recorded sale ${pick(d.receiptNumber, '')} of ${money(pick(d.totalAmount, d.total))}`.replace(/\s+/g, ' '); extra.amount = Number(pick(d.totalAmount, d.total)) || null; break;
        case 'sale:VOID':
            text = `reversed sale ${pick(d.receiptNumber, id, '')}${body.reason ? ': ' + body.reason : ''}`.trim(); break;
        case 'sale:DELETE': text = `deleted sale ${pick(d.receiptNumber, id, '')}`.trim(); break;
        case 'sale:DELETE_BATCH': text = `deleted several sales`; break;
        case 'sale:UPDATE': case 'sale:UPDATE_ITEM': text = `edited sale ${pick(d.receiptNumber, id, '')}`.trim(); break;

        // ---------------- stock to / from vehicles ----------------
        case 'transfer:CREATE': {
            const n = (body.items || []).length;
            const to = pick(d.vehicleName, body.vehicleName, 'a vehicle');
            extra.from = 'Main store'; extra.to = to;
            text = `issued ${count(n || 'some', 'item')} from the store to ${to}`; break;
        }
        case 'transfer:RETURN': {
            const from = pick(d.vehicleName, body.vehicleName, 'a vehicle');
            extra.from = from; extra.to = 'Main store';
            text = `returned stock from ${from} to the store`; break;
        }
        case 'transfer:APPROVE': text = `approved a stock transfer${d.vehicleName ? ' to ' + d.vehicleName : ''}`; break;
        case 'transfer:CONFIRM': text = `confirmed receiving a stock transfer${d.vehicleName ? ' on ' + d.vehicleName : ''}`; break;

        // ---------------- vehicles ----------------
        case 'vehicle:CREATE': text = `added vehicle ${pick(d.vehicleName, body.vehicleName, body.registrationNumber, '')}`.trim(); break;
        case 'vehicle:UPDATE': text = `edited vehicle ${pick(d.vehicleName, body.vehicleName, id, '')}`.trim(); break;
        case 'vehicle:DELETE': text = `deleted vehicle ${pick(d.vehicleName, id, '')}`.trim(); break;
        case 'vehicle:ASSIGN_USER': text = `assigned ${pick(d.assignedUserName, d.assignedDriverName, 'a person')} to ${pick(d.vehicleName, 'a vehicle')}`; break;

        // ---------------- team ----------------
        case 'user:CREATE': text = `created a ${String(pick(d.role, body.role, 'user')).replace('_', ' ')} account for ${pick(d.username, body.username, '')}`.trim(); break;
        case 'user:DELETE': text = `deleted the user ${pick(d.username, d.email, id, '')}`.trim(); break;
        case 'user:UPDATE': {
            const who = pick(d.username, body.username, id, 'a user');
            if (body.isDisabled === true) text = `disabled ${who}`;
            else if (body.isDisabled === false) text = `re-enabled ${who}`;
            else if (body.role) text = `changed ${who}'s role to ${String(body.role).replace('_', ' ')}`;
            else text = `updated ${who}`;
            break;
        }
        case 'user:VERIFY': text = `${body.isVerified === false ? 'deactivated' : 'activated'} ${pick(d.username, id, 'a user')}`; break;
        case 'user:ASSIGN_VEHICLE': text = `${body.vehicleId ? 'assigned a vehicle to' : 'unassigned the vehicle of'} ${pick(d.username, id, 'a user')}`; break;

        // ---------------- reconciliation / reports ----------------
        case 'reconciliation:CREATE': text = `started a stock reconciliation`; break;
        case 'reconciliation:APPROVE': text = `approved a stock reconciliation`; break;
        default: break;
    }

    if (!text && String(action).startsWith('GENERATE_')) {
        text = `generated a ${String(resource).replace(/_/g, ' ')}`;
    }
    if (!text) return null;
    return { description: `${actor} ${text}`, extra };
}

module.exports = { describeActivity };
