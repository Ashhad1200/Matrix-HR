'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LmsPage() {
  const [courses, setCourses] = useState<any[]>([]);

  useEffect(() => {
    api.lms.courses().then(setCourses).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Learning Management</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <Card key={c.id}>
            <CardHeader><CardTitle>{c.title}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{c.description}</p>
              <p className="mt-2 text-xs">{c._count?.enrollments} enrolled · {c.isMandatory ? 'Mandatory' : 'Optional'}</p>
            </CardContent>
          </Card>
        ))}
        {courses.length === 0 && (
          <p className="text-[hsl(var(--muted-foreground))]">No courses published yet</p>
        )}
      </div>
    </div>
  );
}
