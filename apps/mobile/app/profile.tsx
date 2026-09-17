import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { API, authHeaders, isAuthenticated, signOut } from '../lib/auth';

type Profile = {
  email?: string;
  employee?: {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    employeeCode?: string;
    department?: { name?: string } | null;
    designation?: { name?: string } | null;
  } | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) return;

    fetch(`${API}/auth/me`, { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load profile');
        return response.json();
      })
      .then((data: Profile) => setProfile(data))
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

  const employee = profile?.employee;
  const fields = [
    { label: 'Email', value: employee?.email ?? profile?.email },
    { label: 'Department', value: employee?.department?.name },
    { label: 'Designation', value: employee?.designation?.name },
    { label: 'Employee Code', value: employee?.employeeCode },
  ];

  function handleSignOut() {
    signOut();
    router.replace('/login');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>My Profile</Text>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.name}>
            {[employee?.firstName, employee?.lastName].filter(Boolean).join(' ') || 'Employee'}
          </Text>
          {fields.map((field) => (
            <View key={field.label} style={styles.row}>
              <Text style={styles.label}>{field.label}</Text>
              <Text style={styles.value}>{field.value || 'Not provided'}</Text>
            </View>
          ))}
        </View>
      )}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  heading: { fontSize: 20, fontWeight: '600', marginBottom: 16, color: '#0f172a' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  name: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  row: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  label: { fontSize: 12, color: '#64748b', marginBottom: 3 },
  value: { fontSize: 15, color: '#0f172a' },
  error: { color: '#dc2626', textAlign: 'center', marginTop: 24 },
  signOutButton: { backgroundColor: '#dc2626', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  signOutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
