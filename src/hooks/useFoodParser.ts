import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ParsedFoodItem } from '../types/database';

export function useFoodParser() {
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<{ items: ParsedFoodItem[]; raw_input: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parse = useCallback(async (input: string) => {
    setParsing(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return null;
      }

      const res = await fetch('/api/nutrition/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ input }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Failed to parse food');
        return null;
      }

      const data = await res.json();
      setResult(data);
      return data;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setParsing(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { parse, parsing, result, error, clear };
}
