'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import { Eye, EyeOff } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';

export default function SignInPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState('/dashboard');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    const loadMessage = async () => {
      await Promise.resolve();
      const params = new URLSearchParams(window.location.search);
      const nextPath = params.get('redirectTo');

      setMessage(params.get('message'));

      if (nextPath?.startsWith('/') && !nextPath.startsWith('//')) {
        setRedirectTo(nextPath);
      }
    };

    loadMessage();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured yet. Sign in will activate after environment setup.');
      setIsLoading(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) throw signInError;

      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError(null);
    setMessage(null);

    if (!formData.email) {
      setError('Enter your email address first');
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured yet. Password reset will activate after environment setup.');
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(formData.email, {
      redirectTo: `${window.location.origin}/auth/login`,
    });

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage('Password reset email sent. Check your inbox.');
  };

  return (
    <div className="w-full max-w-md rounded-lg border border-black/8 bg-white p-5 shadow-[0_28px_80px_rgba(0,0,0,0.10)] sm:p-8">
      <div className="mb-8 text-center">
        <BrandMark href="/" size="lg" className="mb-7 justify-center" />
        <h1 className="mb-2 break-words text-3xl font-black text-black">Welcome Back</h1>
        <p className="text-black/58">Sign in to your AgentFlow AI workspace</p>
      </div>

      {message && (
        <Notice tone="success" className="mb-4">
          {message}
        </Notice>
      )}

      {error && (
        <Notice tone="danger" className="mb-4">
          {error}
        </Notice>
      )}

      <form onSubmit={handleSignIn} className="space-y-5">
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            disabled={isLoading}
          />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="password" className="mb-0">Password</Label>
            <button
              type="button"
              onClick={handlePasswordReset}
              className="text-sm font-bold text-[#F7CBCA] hover:text-black"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              className="pe-11"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute end-3 top-2.5 text-black/38 hover:text-black"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <Button type="submit" disabled={isLoading} size="lg" className="w-full">
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <p className="mt-6 text-center leading-6 text-black/58">
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="font-bold text-[#F7CBCA] hover:text-black">
          Create one
        </Link>
      </p>
    </div>
  );
}
