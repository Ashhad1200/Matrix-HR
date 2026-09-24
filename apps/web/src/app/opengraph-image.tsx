import { ImageResponse } from 'next/og';

export const alt = 'MatrixHR: everything HR does ends up on a payslip';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Share card in the page's own language: the headline beside a payslip fragment.
export default function OpengraphImage() {
  const row = (label: string, value: string, debit = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #d3ddd7', fontSize: 24 }}>
      <span>{label}</span>
      <span style={{ color: debit ? '#9b3b2a' : '#0b1f19' }}>{value}</span>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#f2f5f1', color: '#0b1f19', padding: 72, gap: 56 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 700 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', width: 34, gap: 4 }}>
              <div style={{ width: 15, height: 15, borderRadius: 4, background: '#166548' }} />
              <div style={{ width: 15, height: 15, borderRadius: 4, background: 'rgba(22,101,72,0.3)' }} />
              <div style={{ width: 15, height: 15, borderRadius: 4, background: 'rgba(22,101,72,0.3)' }} />
              <div style={{ width: 15, height: 15, borderRadius: 4, background: 'rgba(22,101,72,0.6)' }} />
            </div>
            MatrixHR
          </div>
          <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 0.98, letterSpacing: -3 }}>Everything HR does ends up on a payslip.</div>
          <div style={{ fontSize: 26, color: '#4a5e57' }}>HR and payroll for growing companies in Pakistan</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 430, background: '#fff', padding: 36, borderRadius: 6, boxShadow: '0 30px 60px -20px rgba(8,37,28,0.3)' }}>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 14 }}>Payslip, September</div>
          {row('Basic salary', '285,000')}
          {row('Income tax', '−32,917', true)}
          {row('EOBI, 1%', '−2,850', true)}
          {row('Provident fund, 8%', '−22,800', true)}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, borderTop: '3px solid #0b1f19', paddingTop: 16 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>Net pay</span>
            <span style={{ fontSize: 44, fontWeight: 800 }}>226,433</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
