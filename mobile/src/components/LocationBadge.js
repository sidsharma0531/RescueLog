import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, radius } from '../theme';

// Shows the resolved pop-up location. Depending on `status` it either
// confirms a matched site or prompts the driver to name a new one.
export default function LocationBadge({
  status,
  matchedLocation,
  address,
  manualName,
  onChangeName,
  onTapChange,
}) {
  if (status === 'loading') {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.loadingText}>Detecting location…</Text>
      </View>
    );
  }

  if (status === 'matched' && matchedLocation) {
    return (
      <View>
        <View style={styles.matchedBox}>
          <View style={styles.dot} />
          <Text style={styles.matchedName}>{matchedLocation.name}</Text>
        </View>
        <TouchableOpacity onPress={onTapChange} hitSlop={hitSlop}>
          <Text style={styles.changeLink}>Not this site? Tap to change</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const noGps = status === 'manual' || status === 'error';
  return (
    <View>
      {address ? <Text style={styles.address}>{address}</Text> : null}
      <Text style={styles.prompt}>
        {noGps
          ? "Couldn't detect GPS — type the site name"
          : "New site — what's this location called?"}
      </Text>
      <TextInput
        value={manualName}
        onChangeText={onChangeName}
        placeholder="e.g. St. Mark's Church"
        placeholderTextColor={colors.grayLight}
        style={styles.input}
      />
    </View>
  );
}

const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 15,
    color: colors.gray,
  },
  matchedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.greenLight,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.green,
    marginRight: 10,
  },
  matchedName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.greenDark,
    flexShrink: 1,
  },
  changeLink: {
    marginTop: 8,
    fontSize: 14,
    color: colors.green,
    fontWeight: '600',
  },
  address: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 6,
  },
  prompt: {
    fontSize: 15,
    color: colors.ink,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
});
