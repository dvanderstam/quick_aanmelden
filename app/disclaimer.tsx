import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { acceptDisclaimer } from '../src/auth';
import { TEAM_NAME, QUICK_LOGO_URL } from '../src/config';
import { DISCLAIMER_TEXT } from '../src/DisclaimerFooter';
import { M3, radii, spacing, typography } from '../src/theme';

export default function DisclaimerScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 480);

  const handleAccept = async () => {
    await acceptDisclaimer();
    router.replace('/games');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Disclaimer', headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.hero}>
          <Image
            source={{ uri: QUICK_LOGO_URL }}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.teamName}>{TEAM_NAME}</Text>
          <Text style={styles.subtitle}>Disclaimer</Text>
        </View>

        <View style={[styles.card, { width: contentWidth, alignSelf: 'center' }]}>
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
          </View>

          <Text style={styles.instruction}>
            Door op "Akkoord" te klikken ga je akkoord met bovenstaande disclaimer.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={handleAccept}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Akkoord</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: M3.surface,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    backgroundColor: '#1E5FA0',
    paddingTop: 72,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  logoImage: {
    width: 160,
    height: 160,
    marginBottom: spacing.sm,
  },
  teamName: {
    ...typography.headlineMedium,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.titleMedium,
    color: '#FFFFFF',
  },
  card: {
    padding: spacing.lg,
    marginTop: -spacing.md,
  },
  disclaimerBox: {
    backgroundColor: M3.surfaceContainerHigh,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: M3.outlineVariant,
  },
  disclaimerText: {
    fontSize: 14,
    color: M3.onSurface,
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  instruction: {
    fontSize: 13,
    color: M3.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: M3.primary,
    height: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  buttonText: {
    color: M3.onPrimary,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
