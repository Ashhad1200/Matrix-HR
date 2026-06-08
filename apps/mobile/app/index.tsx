import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Link } from 'expo-router';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>M</Text>
        <Text style={styles.title}>MatrixHR</Text>
        <Text style={styles.subtitle}>Employee Self-Service</Text>
      </View>

      <View style={styles.grid}>
        <Link href="/clock-in" asChild>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardTitle}>Clock In/Out</Text>
            <Text style={styles.cardDesc}>Geo-fenced attendance</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/leave" asChild>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardTitle}>Leave</Text>
            <Text style={styles.cardDesc}>Apply & view balance</Text>
          </TouchableOpacity>
        </Link>
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>Payslips</Text>
          <Text style={styles.cardDesc}>Download PDF</Text>
        </TouchableOpacity>
        <Link href="/approvals" asChild>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardTitle}>Approvals</Text>
            <Text style={styles.cardDesc}>Manager inbox</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { alignItems: 'center', padding: 32, backgroundColor: '#2563eb' },
  logo: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#fff', color: '#2563eb', fontSize: 24, fontWeight: 'bold', textAlign: 'center', lineHeight: 48 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 12 },
  subtitle: { color: '#dbeafe', fontSize: 14, marginTop: 4 },
  grid: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  cardDesc: { fontSize: 13, color: '#64748b', marginTop: 4 },
});
