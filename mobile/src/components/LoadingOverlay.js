import {
  Modal,
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
} from 'react-native';
import { colors, radius } from '../theme';
import ProgressBar from './ProgressBar';

// Full-screen blocking overlay shown while a submission is in flight. Pass
// `progress` ({ done, total }) to show a determinate bar + count (e.g. during
// a multi-photo upload).
export default function LoadingOverlay({ visible, message, progress }) {
  const hasProgress = progress && progress.total > 0;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.green} />
          <Text style={styles.message}>{message || 'Working…'}</Text>
          {hasProgress && (
            <View style={styles.progressWrap}>
              <ProgressBar value={progress.done} total={progress.total} />
              <Text style={styles.count}>
                {progress.done} of {progress.total} photos
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: 32,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 260,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },
  progressWrap: {
    marginTop: 18,
    width: '100%',
    alignItems: 'center',
  },
  count: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray,
  },
});
