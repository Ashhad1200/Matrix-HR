import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'MatrixHR' }} />
        <Stack.Screen name="login" options={{ title: 'Sign In' }} />
        <Stack.Screen name="clock-in" options={{ title: 'Clock In/Out' }} />
        <Stack.Screen name="leave" options={{ title: 'Leave' }} />
        <Stack.Screen name="approvals" options={{ title: 'Approvals' }} />
      </Stack>
    </>
  );
}
