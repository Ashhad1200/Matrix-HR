import { Injectable } from '@nestjs/common';
// pdfkit's CJS export is the class itself, not `{ default: Class }` — a
// TS default import compiles to `require('pdfkit').default`, which is
// undefined. require() it directly instead.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

export type PayslipData = {
  tenantName: string;
  period: string;
  employeeName: string;
  employeeCode: string;
  designation?: string;
  department?: string;
  breakdown: {
    baseSalary?: number;
    unpaidDeduction?: number;
    taxableEarnings?: number;
    gross: number;
    tax: number;
    eobiEmployee?: number;
    pfEmployee?: number;
    postTaxDeductions?: number;
    net: number;
  };
};

@Injectable()
export class PayslipPdfService {
  /** Renders a single payslip as a PDF buffer. Kept deliberately simple —
   * one page, no external template engine — since the goal here is a real
   * generated/archived document, not a design system. */
  generate(data: PayslipData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (n?: number) => `Rs ${Number(n ?? 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
      const line = () => doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke().moveDown(0.5);
      const row = (label: string, value: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11);
        doc.text(label, 50, doc.y, { continued: true, width: 300 });
        doc.text(value, { align: 'right' });
      };

      doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(data.tenantName);
      doc.font('Helvetica').fontSize(12).fillColor('#64748b').text(`Payslip — ${data.period}`);
      doc.moveDown();
      line();

      doc.fillColor('#0f172a');
      row('Employee', `${data.employeeName} (${data.employeeCode})`, true);
      if (data.designation) row('Designation', data.designation);
      if (data.department) row('Department', data.department);
      doc.moveDown();
      line();

      doc.font('Helvetica-Bold').fontSize(13).text('Earnings');
      doc.moveDown(0.3);
      if (data.breakdown.baseSalary != null) row('Base Salary', money(data.breakdown.baseSalary));
      if (data.breakdown.unpaidDeduction) row('Unpaid Absence Deduction', `-${money(data.breakdown.unpaidDeduction)}`);
      if (data.breakdown.taxableEarnings) row('Allowances / Bonus', money(data.breakdown.taxableEarnings));
      row('Gross Pay', money(data.breakdown.gross), true);
      doc.moveDown();
      line();

      doc.font('Helvetica-Bold').fontSize(13).text('Deductions');
      doc.moveDown(0.3);
      row('Income Tax', money(data.breakdown.tax));
      if (data.breakdown.eobiEmployee) row('EOBI', money(data.breakdown.eobiEmployee));
      if (data.breakdown.pfEmployee) row('Provident Fund', money(data.breakdown.pfEmployee));
      if (data.breakdown.postTaxDeductions) row('Loans / Advances / Other', money(data.breakdown.postTaxDeductions));
      doc.moveDown();
      line();

      doc.font('Helvetica-Bold').fontSize(15).fillColor('#2563eb');
      row('Net Pay', money(data.breakdown.net), true);
      doc.fillColor('#0f172a');

      doc.moveDown(2);
      doc.font('Helvetica').fontSize(9).fillColor('#94a3b8')
        .text('This is a system-generated payslip. Figures are calculated by MatrixHR and have not been independently audited.', { width: 495 });

      doc.end();
    });
  }
}
