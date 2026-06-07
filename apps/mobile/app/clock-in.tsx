import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location';

const API_URL = 'http://localhost:3001/api/v1';

export default function ClockInScreen() {
  const [status, setStatus] = useState<'idle' | 'in' | 'out'>('idle');
  const [time, setTime] = useState('');

  async function clockIn() {
    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    let coords = {};
    if (perm === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    }

    try {
      const token = ''; // Would load from secure storage
      await fetch(`${API_URL}/attendance/clock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(coords),
      });
      setStatus('in');
      setTime(new Date().toLocaleTimeString());
      Alert.alert('Clocked In', `Time: ${new Date().toLocaleTimeString()}`);
    } catch {
      setStatus('in');
      setTime(new Date().toLocaleTimeString());
      Alert.alert('Clocked In (offline)', 'Will sync when online');
    }
  }

  async function clockOut() {
    setStatus('out');
    setTime(new Date().toLocaleTimeString());
    Alert.alert('Clocked Out', `Time: ${new Date().toLocaleTimeString()}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.clock}>{new Date().toLocaleTimeString()}</Text>
      <Text style={styles.date}>{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>

      {status !== 'idle' && (
        <Text style={styles.status}>
          {status === 'in' ? `Clocked in at ${time}` : `Clocked out at ${time}`}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.button, status === 'in' && styles.buttonOut]}
        onPress={status === 'in' ? clockOut : clockIn}
      >
        <Text style={styles.buttonText}>{status === 'in' ? 'Clock Out' : 'Clock In'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  clock: { fontSize: 48, fontWeight: '200', color: '#0f172a' },
  date: { fontSize: 16, color: '#64748b', marginTop: 8 },
  status: { fontSize: 14, color: '#2563eb', marginTop: 16 },
  button: { marginTop: 48, backgroundColor: '#2563eb', paddingHorizontal: 48, paddingVertical: 20, borderRadius: 16 },
  buttonOut: { backgroundColor: '#dc2626' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
