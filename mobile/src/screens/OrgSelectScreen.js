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
import { saveOrg, getOrg, getDriver } from '../services/storage';
import Logo from '../components/Logo';
import { colors, radius } from '../theme';

export default function OrgSelectScreen({ navigation }) {
  const [checking, setChecking] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // On launch: if both org + driver are stored, jump to Home; if just an
  // org is stored, jump to Login. Otherwise show the org picker.
  useEffect(() => {
    (async () => {
      const [d, o] = await Promise.all([getDriver(), getOrg()]);
      if (d && o) navigation.replace('Home');
      else if (o) navigation.replace('Login');
      else setChecking(false);
    })();
  }, [navigation]);

  // Load approved orgs once we're showing the picker.
  useEffect(() => {
    if (checking) return;
    api
      .getOrganizations()
      .then((r) => setOrgs(r.organizations || []))
      .catch((e) => setLoadError(e.message));
  }, [checking]);

  async function pickOrg(org) {
    setSubmitting(true);
    await saveOrg({
      id: org.id,
      name: org.name,
      capture_mode: org.capture_mode === 'cart' ? 'cart' : 'popup',
    });
    setPickerOpen(false);
    navigation.replace('Login');
  }

  const filtered = orgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()),
  );

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
          <Logo size={60} />
          <Text style={styles.title}>RescueLog</Text>
          <Text style={styles.tagline}>
            Built for food rescue organizations
          </Text>
        </View>

        <Text style={styles.label}>Organization</Text>
        {loadError ? (
          <Text style={styles.loadError}>{loadError}</Text>
        ) : (
          <TouchableOpacity
            style={styles.select}
            onPress={() => orgs.length > 0 && setPickerOpen(true)}
            disabled={orgs.length === 0}
            activeOpacity={0.7}
          >
            <Text style={[styles.selectText, styles.selectPlaceholder]}>
              {orgs.length === 0
                ? 'Loading organizations…'
                : 'Select your organization'}
            </Text>
            <Text style={styles.chevron}>▾</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => navigation.navigate('RegisterOrg')}
          activeOpacity={0.85}
        >
          <Text style={styles.registerBtnText}>
            Register a new organization
          </Text>
        </TouchableOpacity>
      </ScrollView>

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
            <Text style={styles.sheetTitle}>Select your organization</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search…"
              placeholderTextColor={colors.grayLight}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <ScrollView
              style={styles.sheetList}
              keyboardShouldPersistTaps="handled"
            >
              {filtered.length === 0 ? (
                <Text style={styles.sheetEmpty}>
                  No organizations match.
                </Text>
              ) : (
                filtered.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={styles.sheetRow}
                    onPress={() => pickOrg(o)}
                    disabled={submitting}
                  >
                    <Text style={styles.sheetRowText}>{o.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
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
  header: { alignItems: 'center', marginTop: 32, marginBottom: 36 },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: 12 },
  tagline: {
    fontSize: 14,
    color: colors.gray,
    marginTop: 4,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 8,
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
  registerBtn: {
    marginTop: 16,
    borderWidth: 2,
    borderColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  registerBtnText: { color: colors.green, fontSize: 16, fontWeight: '700' },
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
    maxHeight: '75%',
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
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 8,
    marginBottom: 8,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  sheetList: { paddingHorizontal: 4 },
  sheetEmpty: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    paddingVertical: 16,
  },
  sheetRow: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  sheetRowText: { fontSize: 18, color: colors.ink, fontWeight: '600' },
});
