import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';
import { getDriver, getOrg, clearDriver } from '../services/storage';
import { colors, radius } from '../theme';

const STATUS_COLORS = {
  complete: colors.green,
  processing: colors.orange,
  partial: colors.orange,
  failed: colors.danger,
};

const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function HomeScreen({ navigation }) {
  const [driver, setDriver] = useState(null);
  const [org, setOrg] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [d, o] = await Promise.all([getDriver(), getOrg()]);
    if (!d) {
      navigation.replace('Login');
      return;
    }
    setDriver(d);
    setOrg(o);
    try {
      const res = await api.getRecentPopups(d.id, 5);
      setRecent(res.popups || []);
    } catch {
      /* the recent list is non-critical — ignore */
    }
    setLoading(false);
    setRefreshing(false);
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function handleLogout() {
    clearDriver().then(() => navigation.replace('Login'));
  }

  // The big button follows the org's capture mode: cart orgs (Second Mile) get
  // the Cart Log flow, gleaning orgs (Glean Kentucky) get the simple "New Log"
  // trip flow, everyone else keeps the pop-up flow.
  const isCart = org?.capture_mode === 'cart';
  const isGleaning = org?.capture_mode === 'gleaning';
  const captureRoute = isCart ? 'CartCapture' : isGleaning ? 'GleaningCapture' : 'Capture';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.green}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.hi}>Hi, {driver?.name || 'there'}</Text>
            <Text style={styles.sub}>
              {isCart
                ? 'Ready to log a cart?'
                : isGleaning
                  ? 'Ready to log a trip?'
                  : 'Ready to log a pop-up?'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} hitSlop={hitSlop}>
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.bigButton}
          onPress={() => navigation.navigate(captureRoute)}
          activeOpacity={0.85}
        >
          <Text style={styles.bigButtonText}>
            {isCart ? 'New Cart Log' : isGleaning ? 'New Log' : 'New Pop-Up Log'}
          </Text>
          <Text style={styles.bigButtonSub}>
            {isCart
              ? 'Weigh the cart, then snap a photo of it'
              : isGleaning
                ? 'Snap photos of the recovered produce'
                : 'Snap photos of the food on the tables'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Your recent logs</Text>

        {loading ? (
          <ActivityIndicator color={colors.green} style={styles.loading} />
        ) : recent.length === 0 ? (
          <Text style={styles.empty}>
            {isCart
              ? 'No carts logged yet. Your submitted carts will show up here.'
              : isGleaning
                ? 'No logs yet. Your submitted logs will show up here.'
                : 'No logs yet. Your submitted pop-ups will show up here.'}
          </Text>
        ) : (
          recent.map((p) => (
            <View key={p.id} style={styles.logCard}>
              <View style={styles.logTop}>
                <Text style={styles.logLocation} numberOfLines={1}>
                  {p.location?.name || p.location_name_manual || 'Unknown site'}
                </Text>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        STATUS_COLORS[p.status] || colors.grayLight,
                    },
                  ]}
                />
              </View>
              <Text style={styles.logMeta}>
                {formatDate(p.logged_at)}
                {p.ai_total_weight != null
                  ? `   ·   ${p.ai_total_weight} lbs (AI)`
                  : `   ·   ${p.status}`}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 24,
  },
  hi: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 15, color: colors.gray, marginTop: 2 },
  logout: { fontSize: 15, color: colors.gray, fontWeight: '600' },
  bigButton: {
    backgroundColor: colors.green,
    borderRadius: radius.lg,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bigButtonText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  bigButtonSub: {
    color: colors.greenLight,
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 28,
    marginBottom: 10,
  },
  loading: { marginTop: 16, alignSelf: 'flex-start' },
  empty: {
    fontSize: 15,
    color: colors.gray,
    lineHeight: 21,
  },
  logCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  logTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logLocation: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    flexShrink: 1,
    marginRight: 10,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  logMeta: { fontSize: 14, color: colors.gray, marginTop: 4 },
});
