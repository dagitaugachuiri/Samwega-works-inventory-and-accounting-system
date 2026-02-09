# Implementation Plan: Unified & Accounting-Focused Reports

This plan outlines the restructuring of the Reports section in the Samwega Admin System to ensure consistency, maximize business utility, and focus on accounting-driven growth. The goal is to transition from simple PDF exports to interactive, data-rich dashboards that empower the administrator.

## 1. Unified Report Layout Structure
To achieve consistency, all reports will share a common layout component (`ReportLayout`). This ensures a familiar user experience across different data sets.

### Structure:
- **Header Section**:
  - **Report Title & Description**: Clear identifying information.
  - **Date Range Picker**: Global control for the report's time frame.
  - **Filters**: Context-specific filters (e.g., Vehicle, Warehouse, Supplier).
  - **Action Buttons**: "Export PDF/Excel" and "Print".
- **Primary Data Table**:
  - **Detailed Rows**: Granular transactional data (e.g., individual sales, expense items).
  - **Sortable Columns**: For easy organization.
  - **Table Footer Summaries**: **Critical**. Totals for relevant columns (e.g., Total Quantity, Total Amount) appear at the bottom of the table.
- **Visual Intelligence Section (Selective)**:
  - *Only* for high-level insights (e.g., "Top 5 Selling Items", "Expense Category Distribution"). These appear *after* or *alongside* the main data where relevant, not as the primary focus.
- **Executive Summary Cards**: Optional. Quick stats at the top only if essential (e.g., "Net Profit").

## 2. Detailed Report Contents & Business Application

### A. Sales Performance Report
**Focus**: Revenue Generation & Customer Preferences
- **Key Metrics (KPIs)**: Total Revenue, Total Profit (Gross), Average Order Value, Total Transactions.
- **Charts**: 
  - *Sales Trend (Line)*: Daily/Weekly revenue vs previous period.
  - *Payment Methods (Pie)*: Cash vs M-Pesa vs Credit (Crucial for cash flow management).
- **Table Data**: Transaction ID, Date, Customer/Route, Amount, Payment Method, Profit Margin.
- **Business Growth Application**: Identify peak sales periods to optimize staffing/stocking. Track payment method trends to manage cash flow and reconciliation.

### B. Profit & Loss (P&L) Report
**Focus**: True Profitability & Financial Health
- **Key Metrics (KPIs)**: Gross Revenue, Cost of Goods Sold (COGS), Total Expenses, **Net Profit**.
- **Charts**:
  - *Income vs Expenses (Bar)*: Monthly comparison of what came in vs what went out.
  - *Expense Breakdown (Donut)*: Top cost centers (e.g., Fuel, Salaries).
- **Table Data**: Income Category (Sales), Expense Category (Fuel, Maintenance, Salaries), Net Result.
- **Business Growth Application**: The "Holy Grail" of accounting. Directly tells the admin if the business is making money. Helps identify cost leaks (e.g., rising fuel costs eating into profits).

### C. Inventory Valuation & Stock Report
**Focus**: Asset Management & Capital Efficiency
- **Key Metrics (KPIs)**: Total Stock Value (Buying Price), Potential Revenue (Selling Price), Low Stock Items Count.
- **Charts**:
  - *Stock Value by Category (Bar)*: Which product categories tie up the most capital.
- **Table Data**: Product Name, SKU, Qty on Hand, Unit Cost, Total Asset Value, Reorder Status.
- **Business Growth Application**: Prevents "Dead Stock" (capital tied up in unsellable items) and "Stockouts" (missed revenue). Essential for balance sheet accuracy.

### D. Expense Analysis Report
**Focus**: Cost Control & Spending Optimization
- **Key Metrics (KPIs)**: Total Expenses, Top Expense Category, Average Daily Spend.
- **Charts**:
  - *Expense Trend (Line)*: Spending over time.
  - *Category Distribution (Pie)*: Fuel vs Repairs vs Operations.
- **Table Data**: Date, Category, Description, Amount, Approved By.
- **Business Growth Application**: highlights areas where specific costs are inflating disproportionately to revenue, allowing for immediate corrective action (e.g., investigating high vehicle maintenance costs).

### E. Supplier & Purchase Report
**Focus**: Supply Chain & Liabilities
- **Key Metrics (KPIs)**: Total Purchases, Outstanding Debts (Payables), Top Supplier by Volume.
- **Charts**:
  - *Purchases over Time (Bar)*: Restocking frequency.
- **Table Data**: Supplier Name, Invoice No, Date, Total Amount, Amount Paid, Balance Due.
- **Business Growth Application**: Manage cash outflows by tracking payables. Negotiate better terms with top suppliers based on volume data.

### F. Vehicle Performance Report
**Focus**: Asset Utilization & Route Profitability
- **Key Metrics (KPIs)**: Total Sales per Vehicle, total Mileage/Fuel Cost, Net Return per Vehicle.
- **Charts**:
  - *Performance Comparison (Bar)*: Sales per vehicle side-by-side.
- **Table Data**: Vehicle Reg, Driver, Total Sales, Stock Return Rate, Expenses.
- **Business Growth Application**: Identify high-performing routes/drivers and underperforming vehicles that may need maintenance or rerouting.

## 3. Implementation Steps
1.  **Backend Verification**: Ensure `reports.service.js` endpoints return structured JSON data for all above types, not just PDF streams.
2.  **Component Creation**: Build the reusable `ReportLayout` and `KPICard` components.
3.  **Page Implementation**: Create dedicated pages (e.g. `/reports/sales`, `/reports/profit-loss`) utilizing the unified layout.
4.  **Charts Integration**: Integrate a charting library (e.g., `recharts` or `chart.js`) for visual components.
5.  **Navigation**: Update `ReportsPage` to link to these new interactive dashboards instead of triggering immediate downloads.
