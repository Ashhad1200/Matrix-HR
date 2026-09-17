import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { API, authHeaders, isAuthenticated } from '../lib/auth';

type TimeEntry = {
  id: string;
  date: string;
  hours: number | string;
  note?: string | null;
  project?: { key?: string } | null;
};

type TimesheetWeek = {
  entries?: TimeEntry[];
};

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentWeekStart() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return toDateInput(date);
}

export default function TimesheetsScreen() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(toDateInput(new Date()));
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const weekStart = currentWeekStart();

  async function loadEntries() {
    try {
      setError('');
      const response = await fetch(
        `${API}/timesheets/entries?weekStart=${encodeURIComponent(weekStart)}`,
        { headers: authHeaders() },
      );
      if (!response.ok) throw new Error('Unable to load timesheets');
      const data: TimesheetWeek | TimeEntry[] = await response.json();
      setEntries(Array.isArray(data) ? data : data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load timesheets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated()) loadEntries();
  }, []);

  async function submitEntry() {
    const parsedHours = Number(hours);
    if (!date || !Number.isFinite(parsedHours) || parsedHours <= 0) {
      setError('Enter a valid date and number of hours');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const response = await fetch(`${API}/timesheets/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ date, hours: parsedHours, note: note || undefined }),
      });
      if (!response.ok) throw new Error('Unable to log hours');

      setDate(toDateInput(new Date()));
      setHours('');
      setNote('');
      setShowForm(false);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log hours');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated()) {
    return <Redirect href="/login" />;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>This Week</Text>
          <Text style={styles.week}>Week of {weekStart}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowForm((visible) => !visible)}>
          <Text style={styles.addButtonText}>{showForm ? 'Cancel' : '+ Log Hours'}</Text>
        </TouchableOpacity>
      </View>

      {showForm ? (
        <View style={styles.formCard}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
          />
          <Text style={styles.label}>Hours</Text>
          <TextInput
            style={styles.input}
            value={hours}
            onChangeText={setHours}
            keyboardType="decimal-pad"
            placeholder="8"
            placeholderTextColor="#94a3b8"
          />
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="What did you work on?"
            placeholderTextColor="#94a3b8"
          />
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.disabledButton]}
            onPress={submitEntry}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>{submitting ? 'Saving...' : 'Save Entry'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {entries.length === 0 && !error ? (
        <Text style={styles.empty}>No hours logged this week</Text>
      ) : entries.map((entry) => (
        <View key={entry.id} style={styles.card}>
          <View>
            <Text style={styles.project}>{entry.project?.key ?? 'General'}</Text>
            <Text style={styles.date}>{String(entry.date).slice(0, 10)}</Text>
            {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
          </View>
          <Text style={styles.hours}>{Number(entry.hours)}h</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heading: { fontSize: 20, fontWeight: '600', color: '#0f172a' },
  week: { fontSize: 13, color: '#64748b', marginTop: 3 },
  addButton: { backgroundColor: '#2563eb', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 10 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  formCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  label: { fontSize: 13, color: '#64748b', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', marginBottom: 14 },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#2563eb', borderRadius: 9, padding: 12, alignItems: 'center' },
  disabledButton: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  project: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  date: { fontSize: 13, color: '#64748b', marginTop: 3 },
  note: { fontSize: 13, color: '#64748b', marginTop: 5 },
  hours: { fontSize: 18, fontWeight: 'bold', color: '#2563eb' },
  error: { color: '#dc2626', textAlign: 'center', marginVertical: 16 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 24 },
});
