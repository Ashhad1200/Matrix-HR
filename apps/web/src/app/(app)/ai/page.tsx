'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AiPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');
    setSource('');
    try {
      const res = await api.ai.ask(question);
      setAnswer(res.answer);
      setSource(res.source || '');
    } catch (err: any) {
      setAnswer(err?.message || 'Sorry, I could not process your question.');
    } finally {
      setLoading(false);
    }
  }

  async function askSuggested(q: string) {
    setQuestion(q);
    setLoading(true);
    setAnswer('');
    setSource('');
    try {
      const res = await api.ai.ask(q);
      setAnswer(res.answer);
      setSource(res.source || '');
    } catch (err: any) {
      setAnswer(err?.message || 'Sorry, I could not process your question.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ask MatrixHR</h1>
      <Card>
        <CardHeader><CardTitle>HR Assistant</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAsk} className="flex gap-2">
            <Input
              placeholder="What is my leave balance?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>{loading ? '...' : 'Ask'}</Button>
          </form>
          {answer && (
            <div className="space-y-2">
              <div className="rounded-lg bg-[hsl(var(--muted))] p-4 whitespace-pre-wrap">{answer}</div>
              {source === 'gemini' && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Powered by Google Gemini</p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {['What is my leave balance?', 'How do I apply for maternity leave?', 'How does attendance work?'].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => askSuggested(q)}
                disabled={loading}
                className="rounded-full border border-[hsl(var(--border))] px-3 py-1 text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
