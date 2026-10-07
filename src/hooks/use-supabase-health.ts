import { useEffect, useState } from 'react';

import { checkSupabaseConnection, type SupabaseHealth } from '@/lib/supabase';

type State = { status: 'loading' } | ({ status: 'done' } & SupabaseHealth);

export function useSupabaseHealth(): State {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    checkSupabaseConnection().then((result) => {
      if (!cancelled) setState({ status: 'done', ...result });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
