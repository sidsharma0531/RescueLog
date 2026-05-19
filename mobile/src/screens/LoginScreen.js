import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Modal,
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
  const [pickerOpen, setPickerOpen] = useState(false);
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
    if (submitting) return;
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

  // Auto-submit as soon as a driver is picked and the 4-digit PIN is
  // complete — drivers never have to find the Log In button behind the
  // keyboard. (handleLogin is intentionally not a dependency.)
  useEffect(() => {
    if (pin.length === 4 && selectedId && !submitting) {
      handleLogin();
    }
  }, [pin, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  const selectedDriver = drivers.find((d) => d.id === selectedId);
  const selectLabel =
    drivers.length === 0
      ? 'Loading drivers…'
      : selectedDriver
        ? selectedDriver.name
        : "Who's logging in?";

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

        <Text style={styles.label}>Driver</Text>
        {loadError ? (
          <Text style={styles.loadError}>{loadError}</Text>
        ) : (
          <TouchableOpacity
            style={styles.select}
            onPress={() => drivers.length > 0 && setPickerOpen(true)}
            disabled={drivers.length === 0}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.selectText,
                !selectedDriver && styles.selectPlaceholder,
              ]}
            >
              {selectLabel}
            </Text>
            <Text style={styles.chevron}>▾</Text>
          </TouchableOpacity>
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

      {/* Driver picker — names only show when the dropdown is tapped. */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setPickerOpen(false)}
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Who's logging in?</Text>
            {drivers.map((d) => {
              const active = d.id === selectedId;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={styles.sheetRow}
                  onPress={() => {
                    setSelectedId(d.id);
                    setError('');
                    setPickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sheetRowText,
                      active && styles.sheetRowTextActive,
                    ]}
                  >
                    {d.name}
                  </Text>
                  {active && <Text style={styles.sheetCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
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
  title: { fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: 12 },
  tagline: { fontSize: 14, color: colors.gray, marginTop: 2 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 20,
    marginBottom: 8,
  },
  loadError: { color: colors.danger, fontSize: 14 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
  },
  selectText: { fontSize: 18, color: colors.ink, fontWeight: '600' },
  selectPlaceholder: { color: colors.grayLight, fontWeight: '500' },
  chevron: { fontSize: 16, color: colors.gray },
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
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 8,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray,
    textAlign: 'center',
    paddingVertical: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  sheetRowText: { fontSize: 18, color: colors.ink, fontWeight: '600' },
  sheetRowTextActive: { color: colors.green },
  sheetCheck: { fontSize: 18, color: colors.green, fontWeight: '800' },
});
