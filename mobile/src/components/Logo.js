import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Reusable brand mark — green rounded square with a stylized leaf shape.
export default function Logo({ size = 60 }) {
  const inner = Math.round(size * 0.43);
  const innerRadius = Math.round(size * 0.27);
  const outerRadius = Math.round(size * 0.27);
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: outerRadius },
      ]}
    >
      <View
        style={[
          styles.leaf,
          {
            width: inner,
            height: inner,
            borderTopLeftRadius: innerRadius,
            borderBottomRightRadius: innerRadius,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaf: { backgroundColor: colors.white },
});
