import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { API, authHeaders, isAuthenticated } from '../lib/auth';

type LeaveBalance = {
  id: string;
  policy: { name: string };
  entitled: number;
  used: number;
  pending: number;
};

export default function LeaveScreen() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) return;

    fetch(`${API}/leave/balances`, { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load leave balances');
        return response.json();
      })
      .then((data: LeaveBalance[]) => setBalances(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Leave Balance</Text>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : balances.length === 0 ? (
        <Text style={styles.empty}>No leave balances available</Text>
      ) : balances.map((balance) => (
        <View key={balance.id} style={styles.card}>
          <Text style={styles.name}>{balance.policy.name}</Text>
          <Text style={styles.days}>
            {balance.entitled - balance.used - balance.pending} days
          </Text>
        </View>
      ))}
      <Text style={styles.note}>Apply for leave via web app or WhatsApp</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  heading: { fontSize: 20, fontWeight: '600', marginBottom: 16, color: '#0f172a' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0' },
  name: { fontSize: 15, color: '#0f172a' },
  days: { fontSize: 18, fontWeight: 'bold', color: '#2563eb' },
  error: { color: '#dc2626', textAlign: 'center', marginTop: 24 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 24 },
  note: { textAlign: 'center', color: '#64748b', marginTop: 24, fontSize: 13 },
});
