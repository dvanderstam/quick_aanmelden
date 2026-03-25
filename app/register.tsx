import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { signUp, getUnclaimedPlayers } from '../src/auth';
import { Player } from '../src/types';
import { TEAM_NAME } from '../src/config';

export default function RegisterScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUnclaimedPlayers()
      .then(setPlayers)
      .catch(() => setError('Kon spelers niet laden.'))
      .finally(() => setLoadingPlayers(false));
  }, []);

  const handleRegister = async () => {
    if (!selectedId) {
      setError('Selecteer je naam.');
      return;
    }
    if (!email || !password) {
      setError('Vul je e-mail en wachtwoord in.');
      return;
    }
    if (password.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens zijn.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signUp(email.trim(), password, selectedId);
      router.replace('/games');
    } catch (err: any) {
      setError(err.message || 'Registratie mislukt. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Registreren', headerShown: false }} />
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.teamName}>{TEAM_NAME}</Text>
          <Text style={styles.subtitle}>Account aanmaken</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Wie ben jij?</Text>

          {loadingPlayers ? (
            <ActivityIndicator
              size="small"
              color="#1a3a5c"
              style={{ marginVertical: 20 }}
            />
          ) : (
            <View style={styles.playerList}>
              {players.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.playerCard,
                    selectedId === item.id && styles.playerCardSelected,
                  ]}
                  onPress={() => setSelectedId(item.id)}
                >
                  <View style={styles.playerRow}>
                    <View
                      style={[
                        styles.avatar,
                        selectedId === item.id && styles.avatarSelected,
                      ]}
                    >
                      <Text style={styles.avatarText}>
                        {item.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.playerName,
                        selectedId === item.id && styles.playerNameSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {selectedId === item.id && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[styles.label, { marginTop: 20 }]}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="jouw@email.nl"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={styles.label}>Wachtwoord</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Minimaal 6 tekens"
            placeholderTextColor="#999"
            secureTextEntry
            autoComplete="new-password"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Registreren</Text>
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
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  header: {
    backgroundColor: '#1a3a5c',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#b0c4de',
  },
  form: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a3a5c',
    marginBottom: 12,
  },
  playerList: {
    gap: 6,
  },
  playerCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  playerCardSelected: {
    borderColor: '#1a3a5c',
    backgroundColor: '#e8eef5',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarSelected: {
    backgroundColor: '#1a3a5c',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  playerName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  playerNameSelected: {
    color: '#1a3a5c',
    fontWeight: 'bold',
  },
  checkmark: {
    fontSize: 20,
    color: '#1a3a5c',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  error: {
    color: '#c0392b',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1a3a5c',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  linkText: {
    fontSize: 15,
    color: '#666',
  },
  linkBold: {
    color: '#1a3a5c',
    fontWeight: 'bold',
  },
});
