import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function ApprovalsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/approvals/inbox`, {
      headers: { Authorization: 'Bearer demo-token' },
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items || d || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Pending Approvals</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>No pending items</Text>
      ) : (
        items.map((item: any) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.title}>{item.employee?.firstName} {item.employee?.lastName}</Text>
            <Text style={styles.meta}>{item.type || 'Leave'} · {item.status}</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.approve}><Text style={styles.btnText}>Approve</Text></TouchableOpacity>
              <TouchableOpacity style={styles.reject}><Text style={styles.btnText}>Reject</Text></TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#0f172a' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 32 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  title: { fontSize: 16, fontWeight: '600' },
  meta: { color: '#64748b', marginTop: 4, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  approve: { backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  reject: { backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
});
