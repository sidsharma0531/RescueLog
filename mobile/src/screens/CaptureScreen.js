import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as api from '../services/api';
import {
  getCurrentLocation,
  findNearbyLocation,
  reverseGeocode,
} from '../services/location';
import { resizeForUpload } from '../services/image';
import { getDriver } from '../services/storage';
import PhotoGrid from '../components/PhotoGrid';
import LocationBadge from '../components/LocationBadge';
import LoadingOverlay from '../components/LoadingOverlay';
import { colors, radius } from '../theme';

export default function CaptureScreen({ navigation }) {
  const [driver, setDriver] = useState(null);
  const [locationStatus, setLocationStatus] = useState('loading');
  const [coords, setCoords] = useState(null);
  const [matchedLocation, setMatchedLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [manualName, setManualName] = useState('');
  const [photos, setPhotos] = useState([]);
  const [weightEstimate, setWeightEstimate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await getDriver();
      if (!d) {
        navigation.replace('Login');
        return;
      }
      if (!cancelled) setDriver(d);

      const [gps, locsRes] = await Promise.all([
        getCurrentLocation(),
        api.getLocations().catch(() => ({ locations: [] })),
      ]);
      if (cancelled) return;

      const known = locsRes.locations || [];
      if (gps) {
        setCoords(gps);
        const match = findNearbyLocation(gps, known);
        if (match) {
          setMatchedLocation(match);
          setLocationStatus('matched');
        } else {
          const addr = await reverseGeocode(gps.latitude, gps.longitude);
          if (cancelled) return;
          setAddress(addr);
          setLocationStatus('new');
        }
      } else {
        setLocationStatus('manual');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      // Inline message, not an Alert — Apple flagged the popup as a re-prompt
      // for permission. Drivers see the message and can open Settings if they
      // choose; the app does not nag.
      setPermissionMessage(
        'Camera access is needed to take photos. You can enable it in your device Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    const uri = await resizeForUpload(asset.uri, asset.width, asset.height);
    setPhotos((prev) => [...prev, { uri }]);
    setPermissionMessage(null);
  }

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermissionMessage(
        'Photo library access is needed to upload photos. You can enable it in your device Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const assets = result.assets || [];
    if (assets.length === 0) return;
    const uris = await Promise.all(
      assets.map((a) => resizeForUpload(a.uri, a.width, a.height)),
    );
    setPhotos((prev) => [...prev, ...uris.map((uri) => ({ uri }))]);
    setPermissionMessage(null);
  }

  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function changeLocation() {
    setMatchedLocation(null);
    setLocationStatus(coords ? 'new' : 'manual');
  }

  const hasLocation = !!matchedLocation || manualName.trim().length > 0;
  const canSubmit =
    photos.length > 0 &&
    hasLocation &&
    locationStatus !== 'loading' &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Resolve the location.
      let locationId = null;
      let locationNameManual = null;
      if (matchedLocation) {
        locationId = matchedLocation.id;
      } else if (coords && manualName.trim()) {
        const created = await api.createLocation({
          name: manualName.trim(),
          address,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        locationId = created.location.id;
      } else {
        locationNameManual = manualName.trim();
      }

      // Create the pop-up log.
      const popup = await api.createPopup({
        driver_id: driver.id,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        location_id: locationId,
        location_name_manual: locationNameManual,
        driver_weight_estimate: weightEstimate ? Number(weightEstimate) : null,
        notes: notes.trim() || null,
      });

      // Upload photos — this also runs the AI pipeline server-side.
      await api.uploadPhotos(
        popup.id,
        photos.map((p) => p.uri),
      );

      navigation.replace('Confirm', {
        locationName: matchedLocation ? matchedLocation.name : manualName.trim(),
        photoCount: photos.length,
      });
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Submission failed', e.message || 'Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Pop-Up Log</Text>
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
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Location</Text>
            <LocationBadge
              status={locationStatus}
              matchedLocation={matchedLocation}
              address={address}
              manualName={manualName}
              onChangeName={setManualName}
              onTapChange={changeLocation}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Photos</Text>
              {photos.length > 0 && (
                <Text style={styles.count}>{photos.length}</Text>
              )}
            </View>
            <View style={styles.photoButtons}>
              <TouchableOpacity
                style={[styles.photoBtn, styles.photoBtnPrimary]}
                onPress={takePhoto}
                activeOpacity={0.85}
              >
                <Text style={styles.photoBtnPrimaryText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoBtn, styles.photoBtnSecondary]}
                onPress={pickFromGallery}
                activeOpacity={0.85}
              >
                <Text style={styles.photoBtnSecondaryText}>
                  Upload from Gallery
                </Text>
              </TouchableOpacity>
            </View>
            {permissionMessage ? (
              <Text style={styles.permissionMessage}>{permissionMessage}</Text>
            ) : null}
            <PhotoGrid photos={photos} onRemove={removePhoto} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your weight estimate</Text>
            <TextInput
              value={weightEstimate}
              onChangeText={(t) =>
                setWeightEstimate(t.replace(/[^0-9.]/g, '').slice(0, 7))
              }
              keyboardType="decimal-pad"
              placeholder="lbs"
              placeholderTextColor={colors.grayLight}
              style={styles.input}
            />
            <Text style={styles.hint}>The number you'd normally estimate</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional details (optional)"
              placeholderTextColor={colors.grayLight}
              style={[styles.input, styles.notesInput]}
              multiline
            />
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>Submit Pop-Up Log</Text>
          </TouchableOpacity>
          {!canSubmit && !submitting && (
            <Text style={styles.submitHint}>
              {photos.length === 0
                ? 'Take at least one photo to submit.'
                : !hasLocation
                  ? 'Confirm the location to submit.'
                  : ''}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      <LoadingOverlay
        visible={submitting}
        message={'Uploading photos…\nAI is analyzing the food.'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: 17, color: colors.green, fontWeight: '600', width: 70 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  headerSpacer: { width: 70 },
  scroll: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 12,
  },
  count: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    backgroundColor: colors.green,
    minWidth: 24,
    textAlign: 'center',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtnPrimary: { backgroundColor: colors.green },
  photoBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  photoBtnSecondary: {
    borderWidth: 2,
    borderColor: colors.green,
  },
  photoBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.green,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 14,
    color: colors.danger,
    lineHeight: 20,
    marginBottom: 12,
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
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  hint: { fontSize: 13, color: colors.gray, marginTop: 8 },
  bottomBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  submit: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 17,
    alignItems: 'center',
  },
  submitDisabled: { backgroundColor: colors.grayLight },
  submitText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  submitHint: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.gray,
    marginTop: 8,
  },
});
