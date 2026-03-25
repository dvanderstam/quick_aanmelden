import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/supabase';
import { Session } from '@supabase/supabase-js';
import { getCurrentPlayer } from '../src/auth';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [mustChangePassword, setMustChangePassword] = useState(false);
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

  useEffect(() => {
    if (!session) {
      setMustChangePassword(false);
      return;
    }
    getCurrentPlayer().then((player) => {
      setMustChangePassword(player?.must_change_password ?? false);
    });
  }, [session]);

  useEffect(() => {
    if (session === undefined) return; // still loading

    const authPages = ['login', 'register', 'change-password'];
    const onAuthPage = authPages.includes(segments[0] as string);

    if (!session && !onAuthPage) {
      router.replace('/login');
    } else if (session && mustChangePassword && segments[0] !== 'change-password') {
      router.replace('/change-password');
    } else if (session && !mustChangePassword && onAuthPage) {
      router.replace('/games');
    }
  }, [session, segments, mustChangePassword]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1a3a5c' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    />
  );
}
