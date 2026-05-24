import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../services/api';
import { saveDriver, getOrg } from '../services/storage';
import Logo from '../components/Logo';
import { colors, radius } from '../theme';

const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

export default function JoinOrgScreen({ navigation }) {
  const [org, setOrg] = useState(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getOrg().then((o) => {
      if (!o) navigation.replace('OrgSelect');
      else setOrg(o);
    });
  }, [navigation]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Enter your name.');
      return;
    }
    if (pin.length < 4) {
      setError('Create a 4-digit PIN.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.register(org.id, name.trim(), pin);
      await saveDriver(res.driver);
      navigation.replace('Home');
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (!org) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={hitSlop}
        >
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Logo size={52} />
            <Text style={styles.subtitle}>Joining</Text>
            <Text style={styles.orgName}>{org.name}</Text>
          </View>

          <Text style={styles.fieldLabel}>Your name</Text>
          <TextInput
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError('');
            }}
            placeholder="First name (or how your team knows you)"
            placeholderTextColor={colors.grayLight}
            style={styles.input}
            autoCorrect={false}
          />

          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
            Create a 4-digit PIN
          </Text>
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
            style={[styles.submit, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>
              {submitting ? 'Creating account…' : 'Create account'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: 17, color: colors.green, fontWeight: '600', width: 70 },
  headerSpacer: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },
  brand: { alignItems: 'center', marginTop: 16, marginBottom: 28 },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orgName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 4,
    textAlign: 'center',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  pinInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 22,
    letterSpacing: 8,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  error: { color: colors.danger, fontSize: 14, marginTop: 12 },
  submit: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontSize: 18, fontWeight: '700' },
});
