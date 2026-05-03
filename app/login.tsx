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
import { signIn } from '../src/auth';
import { QUICK_LOGO_URL } from '../src/config';
import { M3, radii, spacing, typography } from '../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (loading) return;

    if (!username || !password) {
      setError('Vul je gebruikersnaam en wachtwoord in.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signIn(username, password);
      router.replace('/games');
    } catch (err: any) {
      setError(err.message || 'Inloggen mislukt. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 480);

  return (
    <>
      <Stack.Screen options={{ title: 'Inloggen', headerShown: false }} />
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
          <Text style={styles.subtitle}>Aanmelden voor wedstrijden</Text>
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

          <Text style={styles.label}>Wachtwoord</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={M3.outline}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {error && (
            <View style={styles.errorChip}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={M3.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Inloggen</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => router.push('/forgot-password')}
          >
            <Text style={styles.linkText}>
              Wachtwoord vergeten?{' '}
              <Text style={styles.linkBold}>Herstel je wachtwoord</Text>
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
    paddingTop: 44,
    paddingBottom: 24,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  logoImage: {
    width: 120,
    height: 120,
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
