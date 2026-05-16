import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../services/api';
import { saveDriver, getDriver } from '../services/storage';
import { colors, radius } from '../theme';

export default function LoginScreen({ navigation }) {
  const [checking, setChecking] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already logged in? Skip straight to Home.
  useEffect(() => {
    getDriver().then((d) => {
      if (d) navigation.replace('Home');
      else setChecking(false);
    });
  }, [navigation]);

  // Load the driver list once the login screen is actually showing.
  useEffect(() => {
    if (checking) return;
    api
      .getDrivers()
      .then((res) => setDrivers(res.drivers || []))
      .catch((e) => setLoadError(e.message));
  }, [checking]);

  async function handleLogin() {
    if (!selectedId) {
      setError('Select your name first.');
      return;
    }
    if (pin.length < 4) {
      setError('Enter your 4-digit PIN.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.login(selectedId, pin);
      await saveDriver(res.driver);
      navigation.replace('Home');
    } catch (e) {
      setError(e.message || 'Login failed.');
      setPin('');
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <View style={styles.logoLeaf} />
          </View>
          <Text style={styles.title}>RescueLog</Text>
          <Text style={styles.tagline}>AI-powered food rescue tracking</Text>
        </View>

        <Text style={styles.label}>Who's logging in?</Text>
        {loadError ? (
          <Text style={styles.loadError}>{loadError}</Text>
        ) : drivers.length === 0 ? (
          <ActivityIndicator color={colors.green} style={styles.driversLoading} />
        ) : (
          <View style={styles.driverList}>
            {drivers.map((d) => {
              const active = d.id === selectedId;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.driverRow, active && styles.driverRowActive]}
                  onPress={() => {
                    setSelectedId(d.id);
                    setError('');
                  }}
                >
                  <Text
                    style={[styles.driverName, active && styles.driverNameActive]}
                  >
                    {d.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>4-digit PIN</Text>
        <TextInput
          value={pin}
          onChangeText={(t) => {
            setPin(t.replace(/[^0-9]/g, '').slice(0, 4));
            setError('');
          }}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          placeholder="••••"
          placeholderTextColor={colors.grayLight}
          style={styles.pinInput}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Logging in…' : 'Log In'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Built for Second Servings Houston</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  scroll: { padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginTop: 24, marginBottom: 28 },
  logoMark: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLeaf: {
    width: 26,
    height: 26,
    borderTopLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: colors.white,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 12,
  },
  tagline: { fontSize: 14, color: colors.gray, marginTop: 2 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 20,
    marginBottom: 8,
  },
  driversLoading: { marginVertical: 16, alignSelf: 'flex-start' },
  loadError: { color: colors.danger, fontSize: 14 },
  driverList: { gap: 8 },
  driverRow: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
  },
  driverRowActive: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  driverName: { fontSize: 18, color: colors.ink, fontWeight: '600' },
  driverNameActive: { color: colors.greenDark },
  pinInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 22,
    letterSpacing: 8,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  error: { color: colors.danger, fontSize: 14, marginTop: 12 },
  button: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  footer: {
    textAlign: 'center',
    color: colors.grayLight,
    fontSize: 12,
    marginTop: 28,
  },
});
