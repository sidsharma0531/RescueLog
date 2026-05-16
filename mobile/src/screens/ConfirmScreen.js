import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';

export default function ConfirmScreen({ navigation, route }) {
  const { locationName, photoCount } = route.params || {};

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Text style={styles.check}>✓</Text>
        </View>
        <Text style={styles.title}>Pop-up logged!</Text>
        {locationName ? (
          <Text style={styles.location}>{locationName}</Text>
        ) : null}
        <Text style={styles.detail}>
          {photoCount || 0} photo{photoCount === 1 ? '' : 's'} submitted
        </Text>
        <Text style={styles.note}>
          The AI category breakdown will appear on the dashboard in about a
          minute.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.replace('Home')}
      >
        <Text style={styles.buttonText}>Back to Home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    color: colors.white,
    fontSize: 52,
    fontWeight: '800',
    lineHeight: 58,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 24,
  },
  location: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.greenDark,
    marginTop: 6,
    textAlign: 'center',
  },
  detail: {
    fontSize: 16,
    color: colors.gray,
    marginTop: 10,
  },
  note: {
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  button: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 17,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
});
