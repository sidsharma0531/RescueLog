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
import { resizeForUpload } from '../services/image';
import { uploadPhotosToStorage } from '../services/upload';
import { getDriver, getOrg } from '../services/storage';
import PhotoGrid from '../components/PhotoGrid';
import LoadingOverlay from '../components/LoadingOverlay';
import { colors, radius } from '../theme';

// Cart Mode capture (Second Mile beta): the cart is weighed on a scale, so the
// volunteer enters that ground-truth weight and snaps a photo; the AI provides
// the category breakdown of the cart. Reuses the same upload + AI pipeline as
// the pop-up flow (services/api + services/upload).
export default function CartCaptureScreen({ navigation }) {
  const [driver, setDriver] = useState(null);
  const [org, setOrg] = useState(null);
  const [householdId, setHouseholdId] = useState('');
  const [scaleWeight, setScaleWeight] = useState('');
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // {done,total}|null
  const [permissionMessage, setPermissionMessage] = useState(null);

  useEffect(() => {
    (async () => {
      const [d, o] = await Promise.all([getDriver(), getOrg()]);
      if (!d) {
        navigation.replace('Login');
        return;
      }
      setDriver(d);
      setOrg(o);
    })();
  }, [navigation]);

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
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

  const weightNum = Number(scaleWeight);
  const hasWeight = Number.isFinite(weightNum) && weightNum > 0;
  const canSubmit = hasWeight && photos.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setUploadProgress({ done: 0, total: photos.length });
    try {
      const siteName = org?.name || 'Cart';

      // Create the cart log — mode 'cart', the scale weight (ground truth), and
      // the optional household id.
      const popup = await api.createPopup({
        driver_id: driver.id,
        organization_id: org?.id || null,
        mode: 'cart',
        scale_weight_lbs: weightNum,
        household_id: householdId.trim() || null,
        location_name_manual: siteName,
        notes: notes.trim() || null,
      });

      const uploaded = await uploadPhotosToStorage(
        photos.map((p) => p.uri),
        popup.id,
        (done, total) => setUploadProgress({ done, total }),
      );
      setUploadProgress(null); // uploads done — AI now categorizes the cart
      await api.submitPhotos(popup.id, uploaded);

      navigation.replace('Confirm', {
        popupId: popup.id,
        mode: 'cart',
        locationName: siteName,
        photoCount: photos.length,
      });
    } catch (e) {
      setSubmitting(false);
      setUploadProgress(null);
      Alert.alert('Submission failed', e.message || 'Please try again.');
    }
  }

  // The overlay shows a live count + bar while uploading; the message stays
  // simple. Processing progress is shown on the Confirm screen after upload.
  const overlayMessage = uploadProgress ? 'Uploading photos…' : 'Submitting…';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Cart Log</Text>
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
            <Text style={styles.cardTitle}>Household ID</Text>
            <TextInput
              value={householdId}
              onChangeText={setHouseholdId}
              placeholder="e.g. 1042 (optional)"
              placeholderTextColor={colors.grayLight}
              style={styles.input}
            />
            <Text style={styles.hint}>
              Who received this cart. Optional — helps you report per household.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scale weight</Text>
            <TextInput
              value={scaleWeight}
              onChangeText={(t) =>
                setScaleWeight(t.replace(/[^0-9.]/g, '').slice(0, 7))
              }
              keyboardType="decimal-pad"
              placeholder="lbs"
              placeholderTextColor={colors.grayLight}
              style={styles.input}
            />
            <Text style={styles.hint}>
              The cart&apos;s weight from your scale. This is the total — the AI
              just breaks it down by food type.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Cart photo</Text>
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
            <Text style={styles.submitText}>Submit Cart Log</Text>
          </TouchableOpacity>
          {!canSubmit && !submitting && (
            <Text style={styles.submitHint}>
              {!hasWeight
                ? 'Enter the scale weight to submit.'
                : photos.length === 0
                  ? 'Take a photo of the cart to submit.'
                  : ''}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      <LoadingOverlay
        visible={submitting}
        message={overlayMessage}
        progress={uploadProgress}
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
  hint: { fontSize: 13, color: colors.gray, marginTop: 8, lineHeight: 19 },
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
