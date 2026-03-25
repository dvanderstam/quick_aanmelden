import { useEffect, useState } from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../src/supabase';
import { Session } from '@supabase/supabase-js';
import { getCurrentPlayer } from '../src/auth';
import { QUICK_LOGO_URL } from '../src/config';
import { M3 } from '../src/theme';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Re-check the password flag and disclaimer whenever session or the current route changes
  useEffect(() => {
    if (!session) {
      setMustChangePassword(false);
      setDisclaimerAccepted(true);
      return;
    }
    setMustChangePassword(null); // mark as loading so nav guard waits
    setDisclaimerAccepted(null);
    getCurrentPlayer().then((player) => {
      setMustChangePassword(player?.must_change_password ?? false);
      setDisclaimerAccepted(player?.disclaimer_accepted ?? false);
    });
  }, [session, segments]);

  useEffect(() => {
    if (session === undefined) return; // session still loading
    if (session && mustChangePassword === null) return; // password flag still loading
    if (session && disclaimerAccepted === null) return; // disclaimer flag still loading

    const authPages = ['login', 'register', 'change-password', 'disclaimer', 'forgot-password'];
    const onAuthPage = authPages.includes(segments[0] as string);

    if (!session && !onAuthPage) {
      router.replace('/login');
    } else if (session && mustChangePassword && segments[0] !== 'change-password') {
      router.replace('/change-password');
    } else if (session && !mustChangePassword && !disclaimerAccepted && segments[0] !== 'disclaimer') {
      router.replace('/disclaimer');
    } else if (session && !mustChangePassword && disclaimerAccepted && onAuthPage) {
      router.replace('/games');
    }
  }, [session, segments, mustChangePassword, disclaimerAccepted]);

  return (
    <Stack
      screenOptions={({ route }) => {
        const isSubScreen = route.name.includes('/');
        return {
          headerStyle: { backgroundColor: M3.surface },
          headerTintColor: M3.primary,
          headerTitleStyle: { fontWeight: '600', color: M3.onSurface },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerTitle: () => (
            <Image
              source={{ uri: QUICK_LOGO_URL }}
              style={{ width: 32, height: 32 }}
              resizeMode="contain"
            />
          ),
          headerLeft: () =>
            isSubScreen ? (
              <TouchableOpacity onPress={() => router.replace('/games')}>
                <MaterialCommunityIcons name="home" size={28} color={M3.primary} />
              </TouchableOpacity>
            ) : null,
        };
      }}
    />
  );
}
