import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../services/api';
import ProgressBar from '../components/ProgressBar';
import { colors, radius } from '../theme';

export default function ConfirmScreen({ navigation, route }) {
  const { popupId, locationName, photoCount, mode } = route.params || {};
  const isGleaning = mode === 'gleaning';
  const noun = mode === 'cart' ? 'Cart' : 'Pop-up';

  // Live processing progress. Starts optimistic from the submitted photo count,
  // then tracks the server's real counts as the AI works through the photos.
  const [proc, setProc] = useState({
    status: 'processing',
    total: photoCount || 0,
    done: 0,
    completed: 0,
    failed: 0,
  });

  // Poll the progress endpoint. Each call drives the next batch of analysis and
  // returns counts, so the bar advances and large uploads finish even with no
  // dashboard open. Stops when the log reaches a terminal status.
  useEffect(() => {
    if (!popupId) {
      setProc((p) => ({ ...p, status: 'complete' }));
      return undefined;
    }
    let cancelled = false;
    let timer;
    const tick = async () => {
      try {
        const d = await api.pollProcessing(popupId);
        if (cancelled) return;
        setProc((prev) => ({
          status: d.status || 'processing',
          total: d.total || prev.total,
          done: d.done ?? prev.done,
          completed: d.completed ?? prev.completed,
          failed: d.failed ?? prev.failed,
        }));
        if (!cancelled && d.status === 'processing') {
          timer = setTimeout(tick, 3500);
        }
      } catch {
        if (!cancelled) timer = setTimeout(tick, 5000); // retry on transient error
      }
    };
    // Small delay so the upload route's background drain has a head start.
    timer = setTimeout(tick, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [popupId]);

  const processing = proc.status === 'processing';
  const failedAll = proc.status === 'failed';
  const total = proc.total || photoCount || 0;

  let title = isGleaning ? 'Logged!' : `${noun} logged!`;
  let detail = `All ${total} photo${total === 1 ? '' : 's'} analyzed`;
  if (processing) {
    title = 'Submitted!';
    detail = `Analyzing ${proc.done} of ${total} photo${total === 1 ? '' : 's'}…`;
  } else if (failedAll) {
    title = "Couldn't analyze photos";
    detail = 'The upload saved, but analysis failed. Open the dashboard to retry.';
  } else if (proc.status === 'partial') {
    title = isGleaning ? 'Logged' : `${noun} logged`;
    detail = `${proc.completed} of ${total} analyzed · ${proc.failed} couldn't be read`;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={[styles.circle, failedAll && styles.circleFail]}>
          {processing ? (
            <ActivityIndicator size="large" color={colors.white} />
          ) : (
            <Text style={styles.check}>{failedAll ? '!' : '✓'}</Text>
          )}
        </View>

        <Text style={styles.title}>{title}</Text>
        {locationName ? <Text style={styles.location}>{locationName}</Text> : null}
        <Text style={styles.detail}>{detail}</Text>

        {processing && (
          <View style={styles.progressWrap}>
            <ProgressBar value={proc.done} total={total} />
            <Text style={styles.note}>
              Keep this screen open until it finishes — this can take a minute
              for large batches.
            </Text>
          </View>
        )}

        {!processing && !failedAll && (
          <Text style={styles.note}>
            The category breakdown is on the dashboard.
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.replace('Home')}
      >
        <Text style={styles.buttonText}>
          {processing ? 'Done — leave it running' : 'Back to Home'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleFail: { backgroundColor: colors.danger },
  check: { color: colors.white, fontSize: 52, fontWeight: '800', lineHeight: 58 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink, marginTop: 24, textAlign: 'center' },
  location: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.greenDark,
    marginTop: 6,
    textAlign: 'center',
  },
  detail: { fontSize: 16, color: colors.gray, marginTop: 10, textAlign: 'center' },
  progressWrap: { width: '100%', marginTop: 24, alignItems: 'center', paddingHorizontal: 8 },
  note: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  button: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 17,
    alignItems: 'center',
  },
  buttonText: { color: colors.white, fontSize: 18, fontWeight: '700' },
});
