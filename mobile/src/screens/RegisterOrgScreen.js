import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../services/api';
import Logo from '../components/Logo';
import { colors, radius } from '../theme';

const FIELDS = [
  {
    key: 'org_name',
    label: 'Organization name',
    required: true,
    placeholder: 'e.g. Second Servings Houston',
  },
  {
    key: 'contact_name',
    label: 'Contact name',
    required: true,
    placeholder: 'Your name',
  },
  {
    key: 'email',
    label: 'Email',
    required: true,
    placeholder: 'you@organization.org',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
  },
  {
    key: 'phone',
    label: 'Phone',
    required: false,
    placeholder: '(555) 123-4567',
    keyboardType: 'phone-pad',
  },
];

const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

export default function RegisterOrgScreen({ navigation }) {
  const [form, setForm] = useState({
    org_name: '',
    contact_name: '',
    email: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!form.org_name.trim()) {
      setError('Organization name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.createOrganization(form);
      setDone(true);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
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
            <Text style={styles.title}>Register your organization</Text>
            <Text style={styles.subtitle}>
              We&apos;ll review and approve new organizations within 24 hours.
            </Text>
          </View>

          {done ? (
            <View style={styles.doneCard}>
              <View style={styles.check}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
              <Text style={styles.doneTitle}>
                Your organization has been submitted!
              </Text>
              <Text style={styles.doneText}>
                You&apos;ll receive confirmation within 24 hours.
              </Text>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => navigation.replace('OrgSelect')}
                activeOpacity={0.85}
              >
                <Text style={styles.doneBtnText}>
                  Back to organization selection
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {FIELDS.map((f) => (
                <View key={f.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    {f.label}
                    {!f.required && (
                      <Text style={styles.fieldOptional}> (optional)</Text>
                    )}
                  </Text>
                  <TextInput
                    value={form[f.key]}
                    onChangeText={(v) => {
                      setForm((s) => ({ ...s, [f.key]: v }));
                      setError('');
                    }}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.grayLight}
                    style={styles.input}
                    keyboardType={f.keyboardType || 'default'}
                    autoCapitalize={f.autoCapitalize || 'sentences'}
                    autoCorrect={false}
                  />
                </View>
              ))}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.submit, submitting && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Text style={styles.submitText}>
                  {submitting ? 'Submitting…' : 'Submit for review'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
  brand: { alignItems: 'center', marginTop: 12, marginBottom: 24 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  field: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  fieldOptional: { fontWeight: '400', color: colors.gray },
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
  error: { color: colors.danger, fontSize: 14, marginBottom: 8 },
  submit: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  doneCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
  },
  doneTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 16,
    textAlign: 'center',
  },
  doneText: {
    fontSize: 15,
    color: colors.gray,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBtn: {
    marginTop: 24,
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  doneBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
