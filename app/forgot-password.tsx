import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { resetForgottenPassword } from '../src/auth';
import { TEAM_NAME, QUICK_LOGO_URL } from '../src/config';
import { M3, radii, spacing, typography } from '../src/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!username) {
      setError('Vul je gebruikersnaam in.');
      return;
    }
    if (!newPassword) {
      setError('Kies een nieuw wachtwoord.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens zijn.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await resetForgottenPassword(username, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Wachtwoord resetten mislukt.');
    } finally {
      setLoading(false);
    }
  };

  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 480);

  if (success) {
    return (
      <>
        <Stack.Screen options={{ title: 'Wachtwoord herstellen', headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.hero}>
            <Image
              source={{ uri: QUICK_LOGO_URL }}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.teamName}>{TEAM_NAME}</Text>
          </View>
          <View style={[styles.formCard, { width: contentWidth, alignSelf: 'center' }]}>
            <View style={styles.successChip}>
              <Text style={styles.successText}>
                Wachtwoord is gewijzigd! Je kunt nu inloggen.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace('/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Naar inloggen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Wachtwoord herstellen', headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <Image
            source={{ uri: QUICK_LOGO_URL }}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.teamName}>{TEAM_NAME}</Text>
          <Text style={styles.subtitle}>Wachtwoord herstellen</Text>
        </View>

        <View style={[styles.formCard, { width: contentWidth, alignSelf: 'center' }]}>
          <Text style={styles.label}>Gebruikersnaam</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="bijv. daniel"
              placeholderTextColor={M3.outline}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
            />
          </View>

          <Text style={styles.label}>Nieuw wachtwoord</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Minimaal 6 tekens"
              placeholderTextColor={M3.outline}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <Text style={styles.label}>Bevestig wachtwoord</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Herhaal wachtwoord"
              placeholderTextColor={M3.outline}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          {error && (
            <View style={styles.errorChip}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleReset}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={M3.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Wachtwoord opslaan</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.linkText}>
              Terug naar{' '}
              <Text style={styles.linkBold}>inloggen</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: M3.surface,
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
    opacity: 0.7,
  },
  formCard: {
    padding: spacing.lg,
    marginTop: -spacing.md,
  },
  label: {
    ...typography.labelMedium,
    color: M3.onSurfaceVariant,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },
  inputContainer: {
    backgroundColor: M3.surfaceContainerHigh,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: M3.outlineVariant,
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: M3.onSurface,
    lineHeight: 24,
  },
  errorChip: {
    backgroundColor: M3.absentContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  errorText: {
    color: M3.absent,
    fontSize: 13,
    fontWeight: '500',
  },
  successChip: {
    backgroundColor: M3.successContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  successText: {
    color: M3.success,
    fontSize: 13,
    fontWeight: '500',
  },
  button: {
    backgroundColor: M3.primary,
    height: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: M3.onPrimary,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  link: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  linkText: {
    fontSize: 14,
    color: M3.onSurfaceVariant,
  },
  linkBold: {
    color: M3.primary,
    fontWeight: '600',
  },
});
