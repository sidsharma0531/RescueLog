import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

// A simple determinate progress bar. `value` / `total` set the fill width.
export default function ProgressBar({ value = 0, total = 0 }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((value / total) * 100))) : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.green,
  },
});
