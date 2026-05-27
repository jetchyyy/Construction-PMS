import React from 'react';
import { FiPrinter, FiX } from 'react-icons/fi';
import { format } from 'date-fns';

const PayrollReceipt = ({ config, payroll, employee, onClose, isPreview = false }) => {
  const dateGenerated = format(new Date(), 'PPP p');
  
  const fmt = (n) => '₱' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const data = isPreview ? {
    companyName: 'Your Construction Company',
    employeeName: 'Juan Dela Cruz',
    role: 'Senior Foreman',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-15',
    daysPresent: 12,
    daysHalf: 1,
    totalOT: 8,
    regularPay: 12500,
    otPay: 1500,
    grossPay: 14000,
    caDeduction: 1000,
    netPay: 13000,
  } : {
    companyName: employee.companyName,
    employeeName: employee.employeeName,
    role: employee.role,
    periodStart: payroll.periodStart,
    periodEnd: payroll.periodEnd,
    daysPresent: employee.daysPresent,
    daysHalf: employee.daysHalf,
    totalOT: employee.totalOT,
    regularPay: employee.regularPay,
    otPay: employee.otPay,
    grossPay: employee.grossPay,
    caDeduction: employee.caDeduction,
    netPay: employee.netPay,
  };

  const formatPeriod = (start, end) => {
    try {
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} - ${end}`;
      return `${format(s, 'MM/dd/yy')} - ${format(e, 'MM/dd/yy')}`;
    } catch {
      return `${start} - ${end}`;
    }
  };

  const receiptHeader = config?.header || data.companyName;
  const receiptSubheader = config?.subheader || 'Payroll Receipt';
  const receiptFooter = config?.footer || 'This is a computer-generated payroll receipt and does not require a physical signature.';

  const renderedHtml = `
    <div class="receipt-ticket">
      <div class="receipt-header">
        <h1 class="company-name">${receiptHeader}</h1>
        <p class="document-title">${receiptSubheader}</p>
      </div>
      
      <div class="divider"></div>
      
      <div class="receipt-meta">
        <div class="meta-row">
          <span class="meta-label">Employee:</span>
          <span class="meta-value">${data.employeeName}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Role:</span>
          <span class="meta-value">${data.role || 'Worker'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Period:</span>
          <span class="meta-value">${formatPeriod(data.periodStart, data.periodEnd)}</span>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <div class="section-title">Earnings Breakdown</div>
      <table class="receipt-table">
        <tbody>
          <tr>
            <td>Regular Pay (${data.daysPresent}${data.daysHalf > 0 ? `+${data.daysHalf}½` : ''}d)</td>
            <td class="amount">${fmt(data.regularPay)}</td>
          </tr>
          <tr>
            <td>Overtime Pay (${data.totalOT} hrs)</td>
            <td class="amount">${fmt(data.otPay)}</td>
          </tr>
          <tr class="total-row">
            <td>Gross Earnings</td>
            <td class="amount">${fmt(data.grossPay)}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="divider"></div>
      
      <div class="section-title">Deductions</div>
      <table class="receipt-table">
        <tbody>
          <tr>
            <td class="deduction-label">Cash Advance</td>
            <td class="amount deduction-amount">-${fmt(data.caDeduction)}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="divider"></div>
      
      <div class="net-pay-section">
        <div class="net-pay-label">Total Net Payout</div>
        <div class="net-pay-value">${fmt(data.netPay)}</div>
      </div>
      
      <div class="divider"></div>
      
      <div class="receipt-footer">
        <p>${receiptFooter}</p>
        <p class="timestamp">Generated on ${dateGenerated}</p>
        <p class="thank-you">Thank you for your hard work!</p>
      </div>
    </div>
  `;

  // Standard style bundle used both in live web preview and the printed window.
  const styleStyles = `
    .receipt-ticket {
      width: 160px;
      margin: 0;
      padding: 10px 2px;
      background: #ffffff;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 9px;
      line-height: 1.3;
      color: #000000;
      box-sizing: border-box;
      text-align: left;
      word-wrap: break-word;
      word-break: break-word;
    }
    
    .receipt-header {
      text-align: center;
      margin-bottom: 6px;
    }
    
    .company-name {
      margin: 0;
      color: #000000;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      word-wrap: break-word;
      word-break: break-word;
      line-height: 1.2;
    }
    
    .document-title {
      margin: 2px 0 0;
      color: #000000;
      font-size: 8px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .divider {
      border-top: 1px dashed #000000;
      margin: 6px 0;
      height: 0;
    }
    
    .receipt-meta {
      margin: 4px 0;
    }
    
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2.5px;
      gap: 6px;
    }
    
    .meta-label {
      font-weight: 600;
      color: #000000;
      flex-shrink: 0;
    }
    
    .meta-value {
      text-align: right;
      word-wrap: break-word;
      word-break: break-word;
      color: #000000;
    }
    
    .section-title {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #000000;
      margin: 5px 0 2px;
      letter-spacing: 0.3px;
    }
    
    .receipt-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 3px;
    }
    
    .receipt-table td {
      padding: 1.5px 0;
      font-size: 9px;
      vertical-align: top;
      color: #000000;
    }
    
    .receipt-table .amount {
      text-align: right;
      font-weight: 600;
      white-space: nowrap;
      color: #000000;
      padding-left: 6px;
    }
    
    .receipt-table .total-row td {
      font-weight: 700;
      border-top: 1px dashed #000000;
      padding-top: 3px;
      margin-top: 1px;
      color: #000000;
    }
    
    .receipt-table .total-row .amount {
      font-size: 9.5px;
    }

    .deduction-label {
      color: #000000 !important;
    }

    .deduction-amount {
      color: #000000 !important;
    }
    
    .net-pay-section {
      text-align: center;
      padding: 3px 0;
    }
    
    .net-pay-label {
      font-size: 8px;
      font-weight: 700;
      color: #000000;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    
    .net-pay-value {
      font-size: 14px;
      font-weight: 800;
      color: #000000;
      margin-top: 1px;
    }
    
    .receipt-footer {
      text-align: center;
      font-size: 7.5px;
      color: #000000;
      margin-top: 6px;
      word-wrap: break-word;
      word-break: break-word;
    }
    
    .receipt-footer p {
      margin: 2px 0;
      line-height: 1.25;
    }
    
    .receipt-footer .timestamp {
      font-style: italic;
      margin-top: 4px;
      color: #000000;
    }
    
    .receipt-footer .thank-you {
      font-weight: 700;
      margin-top: 3px;
      text-transform: uppercase;
      color: #000000;
    }
  `;

  const handlePrint = () => {
    let iframe = document.getElementById('receipt-print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Receipt - ${data.employeeName}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              width: 58mm;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            ${styleStyles}
            
            @media print {
              @page {
                size: 58mm auto;
                margin: 0;
              }
              html, body {
                width: 58mm !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .receipt-ticket {
                width: 42mm !important;
                max-width: 42mm !important;
                margin: 0 !important;
                padding: 2mm 0 2mm 1mm !important;
                box-sizing: border-box !important;
              }
            }
          </style>
        </head>
        <body>
          ${renderedHtml}
        </body>
      </html>
    `);
    doc.close();

    // Give standard fonts/styling 250ms to mount inside the iframe, then trigger print
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
  };

  return (
    <div className="receipt-container">
      {!isPreview && (
        <div className="receipt-actions no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}><FiX /> Close</button>
          <button className="btn btn-primary" onClick={handlePrint}><FiPrinter /> Print Receipt</button>
        </div>
      )}
      
      <div className="receipt-ticket-wrapper">
        <div className="receipt-preview" style={{ transform: isPreview ? 'scale(0.95)' : 'none', transformOrigin: 'top center' }} dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .receipt-container {
          background: ${isPreview ? 'transparent' : 'var(--bg-alt, #f8fafc)'};
          padding: ${isPreview ? '0' : '24px'};
          border-radius: 16px;
          border: ${isPreview ? 'none' : '1px solid var(--border-light)'};
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .receipt-ticket-wrapper {
          background: #ffffff;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          position: relative;
          overflow: hidden;
          margin: 10px auto;
        }

        ${styleStyles}

        @media print {
          .no-print { display: none !important; }
          .receipt-container { padding: 0; border: none; background: white; }
          .receipt-ticket-wrapper { border: none; box-shadow: none; margin: 0; }
        }
      `}} />
    </div>
  );
};

export default PayrollReceipt;
