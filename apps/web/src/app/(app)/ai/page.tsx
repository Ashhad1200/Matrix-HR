'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AiPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.ai.ask(question);
      setAnswer(res.answer);
    } catch {
      setAnswer('Sorry, I could not process your question.');
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
            <div className="rounded-lg bg-[hsl(var(--muted))] p-4 whitespace-pre-wrap">{answer}</div>
          )}
          <div className="flex flex-wrap gap-2">
            {['What is my leave balance?', 'How do I apply for maternity leave?', 'How does attendance work?'].map((q) => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className="rounded-full border border-[hsl(var(--border))] px-3 py-1 text-sm hover:bg-[hsl(var(--muted))]"
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
