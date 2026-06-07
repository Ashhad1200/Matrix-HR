import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function LeaveScreen() {
  const balances = [
    { name: 'Annual Leave', remaining: 12 },
    { name: 'Casual Leave', remaining: 8 },
    { name: 'Sick Leave', remaining: 6 },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Leave Balance</Text>
      {balances.map((b) => (
        <View key={b.name} style={styles.card}>
          <Text style={styles.name}>{b.name}</Text>
          <Text style={styles.days}>{b.remaining} days</Text>
        </View>
      ))}
      <Text style={styles.note}>Apply for leave via web app or WhatsApp</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  heading: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0' },
  name: { fontSize: 15, color: '#0f172a' },
  days: { fontSize: 18, fontWeight: 'bold', color: '#2563eb' },
  note: { textAlign: 'center', color: '#64748b', marginTop: 24, fontSize: 13 },
});
