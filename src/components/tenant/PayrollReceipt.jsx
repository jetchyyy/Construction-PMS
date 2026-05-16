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

  const receiptHeader = config?.header || data.companyName;
  const receiptSubheader = config?.subheader || 'Payroll Receipt';
  const receiptFooter = config?.footer || 'This is a computer-generated payroll receipt and does not require a physical signature.';

  const renderedHtml = `
    <div style="font-family: 'Inter', sans-serif; padding: 32px; border: 1px solid #e2e8f0; max-width: 600px; margin: auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="margin: 0; color: #1e293b; font-size: 24px;">${receiptHeader}</h1>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">${receiptSubheader}</p>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
        <div>
          <label style="display: block; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Employee</label>
          <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${data.employeeName}</div>
          <div style="font-size: 13px; color: #64748b;">${data.role || 'Worker'}</div>
        </div>
        <div style="text-align: right;">
          <label style="display: block; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Payroll Period</label>
          <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${data.periodStart} - ${data.periodEnd}</div>
        </div>
      </div>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #f1f5f9;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Earnings Breakdown</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Regular Pay (${data.daysPresent}${data.daysHalf > 0 ? `+${data.daysHalf}½` : ''} days)</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">${fmt(data.regularPay)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Overtime Pay (${data.totalOT} hrs)</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">${fmt(data.otPay)}</td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="padding: 12px 0 0 0; font-weight: 700; color: #1e293b;">Gross Earnings</td>
            <td style="padding: 12px 0 0 0; text-align: right; font-weight: 700; color: #1e293b; font-size: 16px;">${fmt(data.grossPay)}</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #fff1f2; padding: 20px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #ffe4e6;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #991b1b; border-bottom: 1px solid #fecaca; padding-bottom: 8px;">Deductions</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #991b1b;">Cash Advance Deductions</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #991b1b;">-${fmt(data.caDeduction)}</td>
          </tr>
        </table>
      </div>
      
      <div style="border-top: 2px dashed #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Net Payout</div>
          <div style="font-size: 28px; font-weight: 800; color: #16a34a;">${fmt(data.netPay)}</div>
        </div>
        <div style="text-align: right; font-size: 11px; color: #94a3b8;">
          <div>Generated on</div>
          <div style="font-weight: 600;">${dateGenerated}</div>
        </div>
      </div>
      
      <div style="margin-top: 32px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">${receiptFooter}</p>
        <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">Thank you for your hard work!</p>
      </div>
    </div>
  `;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${data.employeeName}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
          <style>
            body { margin: 0; padding: 20px; background: white; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${renderedHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="receipt-container">
      {!isPreview && (
        <div className="receipt-actions no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}><FiX /> Close</button>
          <button className="btn btn-primary" onClick={handlePrint}><FiPrinter /> Print Receipt</button>
        </div>
      )}
      <div className="receipt-preview" style={{ transform: isPreview ? 'scale(0.85)' : 'none', transformOrigin: 'top center' }} dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      
      <style dangerouslySetInnerHTML={{ __html: `
        .receipt-container {
          background: ${isPreview ? 'transparent' : 'var(--bg-alt, #f8fafc)'};
          padding: ${isPreview ? '0' : '24px'};
          border-radius: 16px;
          border: ${isPreview ? 'none' : '1px solid var(--border-light)'};
        }
        @media print {
          .no-print { display: none !important; }
          .receipt-container { padding: 0; border: none; background: white; }
        }
      `}} />
    </div>
  );
};


export default PayrollReceipt;
