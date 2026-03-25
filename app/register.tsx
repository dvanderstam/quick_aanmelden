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
import { signUp } from '../src/auth';
import { TEAM_NAME, QUICK_LOGO_URL } from '../src/config';
import { M3, radii, spacing, typography } from '../src/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!username) {
      setError('Vul je gebruikersnaam in.');
      return;
    }
    if (!password) {
      setError('Kies een wachtwoord.');
      return;
    }
    if (password.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens zijn.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signUp(username, password);
      router.replace('/games');
    } catch (err: any) {
      setError(err.message || 'Activeren mislukt. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 480);

  return (
    <>
      <Stack.Screen options={{ title: 'Account activeren', headerShown: false }} />
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
          <Text style={styles.subtitle}>Account activeren</Text>
        </View>

        <View style={[styles.formCard, { width: contentWidth, alignSelf: 'center' }]}>
          <View style={styles.hintChip}>
            <Text style={styles.hintText}>
              Vul je gebruikersnaam in en kies een wachtwoord
            </Text>
          </View>

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

          <Text style={styles.label}>Kies een wachtwoord</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Minimaal 6 tekens"
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
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={M3.onSuccess} />
            ) : (
              <Text style={styles.buttonText}>Account activeren</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => router.back()}
          >
            <Text style={styles.linkText}>
              Al een account?{' '}
              <Text style={styles.linkBold}>Inloggen</Text>
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
  logo: {
    fontSize: 48,
    marginBottom: spacing.sm,
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
  formCard: {
    padding: spacing.lg,
    marginTop: -spacing.md,
  },
  hintChip: {
    backgroundColor: M3.secondaryContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.full,
    marginBottom: spacing.sm,
  },
  hintText: {
    fontSize: 13,
    color: M3.onSecondaryContainer,
    textAlign: 'center',
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
  button: {
    backgroundColor: M3.success,
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
