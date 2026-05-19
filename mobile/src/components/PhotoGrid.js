import { View, Image, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

// Thumbnail grid of captured photos, each with a delete control.
export default function PhotoGrid({ photos, onRemove }) {
  if (!photos || photos.length === 0) {
    return (
      <Text style={styles.empty}>No photos yet. Tap above to start.</Text>
    );
  }

  return (
    <View style={styles.grid}>
      {photos.map((photo, i) => (
        <View key={`${photo.uri}-${i}`} style={styles.cell}>
          <Image source={{ uri: photo.uri }} style={styles.image} />
          <TouchableOpacity
            style={styles.remove}
            onPress={() => onRemove(i)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.removeText}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: 15,
    color: colors.gray,
    paddingVertical: 16,
    lineHeight: 21,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  cell: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 4,
  },
  image: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  remove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: colors.white,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '600',
  },
});
