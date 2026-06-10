'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Globe2, Calculator } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function EorPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [quoteForm, setQuoteForm] = useState({ country: 'PK', salary: '2000' });
  const [quote, setQuote] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    api.eor.countries()
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load EOR catalog'));
  }, []);

  const regions = useMemo(
    () => [...new Set((data?.countries ?? []).map((c: any) => c.region))].sort() as string[],
    [data],
  );

  const filtered = useMemo(
    () =>
      (data?.countries ?? []).filter(
        (c: any) =>
          (!region || c.region === region) &&
          (!search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase() === search.toLowerCase()),
      ),
    [data, search, region],
  );

  const getQuote = async () => {
    setQuoting(true);
    try {
      setQuote(await api.eor.quote(quoteForm.country, Number(quoteForm.salary)));
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setQuoting(false);
    }
  };

  if (error && !data) return <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>;
  if (!data) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Hiring (EOR)"
        backHref="/settings"
        backLabel="Settings"
        description={`Hire compliantly in ${data.total} countries through employer-of-record partners`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit lg:order-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-brand-600" /> Cost Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Country</label>
              <select
                className="input-base"
                value={quoteForm.country}
                onChange={(e) => setQuoteForm({ ...quoteForm, country: e.target.value })}
              >
                {(data.countries as any[]).map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Monthly salary (USD)</label>
              <Input
                type="number"
                min="1"
                value={quoteForm.salary}
                onChange={(e) => setQuoteForm({ ...quoteForm, salary: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={getQuote} disabled={quoting}>
              {quoting ? 'Calculating…' : 'Get Quote'}
            </Button>

            {quote && (
              <div className="space-y-2 rounded-xl border border-brand-300 bg-brand-50 p-4 text-sm animate-rise dark:border-brand-800 dark:bg-brand-950">
                <div className="flex justify-between"><span>Gross salary</span><span className="font-semibold tabular-nums">{formatCurrency(quote.monthlySalary, 'USD')}</span></div>
                <div className="flex justify-between"><span>Employer costs ({quote.country.employerCostPct}%)</span><span className="font-semibold tabular-nums">{formatCurrency(quote.employerCosts, 'USD')}</span></div>
                <div className="flex justify-between"><span>EOR fee</span><span className="font-semibold tabular-nums">{formatCurrency(quote.eorFee, 'USD')}</span></div>
                <div className="flex justify-between border-t border-brand-300 pt-2 text-base dark:border-brand-800">
                  <span className="font-semibold">Total / month</span>
                  <span className="font-display font-bold tabular-nums">{formatCurrency(quote.totalMonthlyCost, 'USD')}</span>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{quote.note}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2 lg:order-1">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search countries…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <select className="input-base w-auto" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">All regions</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="max-h-[520px] overflow-y-auto">
                <table className="data-table">
                  <thead className="sticky top-0 bg-[hsl(var(--card))]">
                    <tr><th>Country</th><th>Region</th><th>Currency</th><th>Employer Cost</th><th>EOR Fee /mo</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((c: any) => (
                      <tr key={c.code}>
                        <td className="font-medium">
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                            {c.code}
                          </span>
                          {c.name}
                        </td>
                        <td className="text-[hsl(var(--muted-foreground))]">{c.region}</td>
                        <td>{c.currency}</td>
                        <td className="tabular-nums">{c.employerCostPct}%</td>
                        <td className="tabular-nums">${c.monthlyFee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <p className="p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">No countries match</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
