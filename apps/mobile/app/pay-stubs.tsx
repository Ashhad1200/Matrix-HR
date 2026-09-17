import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { API, authHeaders, isAuthenticated } from '../lib/auth';

type Payslip = {
  id: string;
  period?: string;
  netSalary?: number | string;
  net?: number | string;
  payslipUrl?: string | null;
  payrollRun?: { period?: string };
};

export default function PayStubsScreen() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) return;

    fetch(`${API}/employees/me/payslips`, { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load payslips');
        return response.json();
      })
      .then((data: Payslip[]) => setPayslips(data))
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
      <Text style={styles.heading}>Pay Stub History</Text>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : payslips.length === 0 ? (
        <Text style={styles.empty}>No payslips available</Text>
      ) : payslips.map((payslip) => {
        const content = (
          <>
            <View>
              <Text style={styles.period}>
                {payslip.period ?? payslip.payrollRun?.period ?? 'Payroll period'}
              </Text>
              {payslip.payslipUrl ? <Text style={styles.action}>Open payslip</Text> : null}
            </View>
            <Text style={styles.amount}>
              PKR {Number(payslip.netSalary ?? payslip.net ?? 0).toLocaleString()}
            </Text>
          </>
        );

        return payslip.payslipUrl ? (
          <TouchableOpacity
            key={payslip.id}
            style={styles.card}
            onPress={() => Linking.openURL(payslip.payslipUrl as string)}
          >
            {content}
          </TouchableOpacity>
        ) : (
          <View key={payslip.id} style={styles.card}>
            {content}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  heading: { fontSize: 20, fontWeight: '600', marginBottom: 16, color: '#0f172a' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  period: { fontSize: 15, color: '#0f172a' },
  action: { color: '#64748b', fontSize: 12, marginTop: 4 },
  amount: { fontSize: 17, fontWeight: 'bold', color: '#2563eb' },
  error: { color: '#dc2626', textAlign: 'center', marginTop: 24 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 24 },
});
