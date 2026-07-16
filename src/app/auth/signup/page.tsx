'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import { Eye, EyeOff } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';

export default function SignUpPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validation
    if (!formData.email || !formData.password || !formData.fullName) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured yet. Account creation will activate after environment setup.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          data: {
            full_name: formData.fullName,
          },
        },
      });

      if (signUpError) throw signUpError;

      // Apply referral (best-effort, non-blocking)
      try {
        const refCode = new URLSearchParams(window.location.search).get('ref');
        if (refCode && data.user?.id) {
          await fetch('/api/referral/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referralCode: refCode,
              email: formData.email,
              userId: data.user.id,
            }),
          }).catch(() => {});
        }
      } catch {
        // referral application is best-effort
      }

      if (data.session) {
        router.replace('/dashboard');
        router.refresh();
        return;
      }

      router.push('/auth/login?message=Check your email to confirm your account');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-lg border border-black/8 bg-white p-5 shadow-[0_28px_80px_rgba(0,0,0,0.10)] sm:p-8">
      <div className="mb-8 text-center">
        <BrandMark href="/" size="lg" className="mb-7 justify-center" />
        <h1 className="mb-2 break-words text-3xl font-black text-black">Create Account</h1>
        <p className="text-black/58">Start your AgentFlow AI workspace</p>
      </div>

      {error && (
        <Notice tone="danger" className="mb-4">
          {error}
        </Notice>
      )}

      <form onSubmit={handleSignUp} className="space-y-5" noValidate>
        {error && (
          <div 
            role="alert" 
            className="rounded-lg border border-[#F7CBCA]/20 bg-[#F1F7F7]/50 p-3 text-sm text-black/70"
          >
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="fullName">
            Full Name
            <span className="text-[#F7CBCA] ml-1" aria-hidden="true">*</span>
          </Label>
          <Input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Your name"
            disabled={isLoading}
            required
            aria-required="true"
            aria-invalid={!!error && !formData.fullName}
          />
          {error && !formData.fullName && (
            <p className="mt-1 text-sm text-[#F7CBCA]" role="alert">
              Full name is required
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="email">
            Email Address
            <span className="text-[#F7CBCA] ml-1" aria-hidden="true">*</span>
          </Label>
          <Input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            disabled={isLoading}
            required
            aria-required="true"
            aria-invalid={!!error && !formData.email}
          />
          {error && !formData.email && (
            <p className="mt-1 text-sm text-[#F7CBCA]" role="alert">
              Email address is required
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="password">
            Password
            <span className="text-[#F7CBCA] ml-1" aria-hidden="true">*</span>
          </Label>
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
              required
              aria-required="true"
              aria-invalid={!!error && formData.password.length < 6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute end-3 top-2.5 text-black/38 hover:text-black"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {error && formData.password.length < 6 && (
            <p className="mt-1 text-sm text-[#F7CBCA]" role="alert">
              Password must be at least 6 characters
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="confirmPassword">
            Confirm Password
            <span className="text-[#F7CBCA] ml-1" aria-hidden="true">*</span>
          </Label>
          <Input
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Confirm password"
            disabled={isLoading}
            required
            aria-required="true"
            aria-invalid={!!error && formData.confirmPassword !== formData.password}
          />
          {error && formData.confirmPassword !== formData.password && (
            <p className="mt-1 text-sm text-[#F7CBCA]" role="alert">
              Passwords do not match
            </p>
          )}
        </div>

        <Button type="submit" disabled={isLoading} size="lg" className="w-full">
          {isLoading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      <p className="mt-6 text-center leading-6 text-black/58">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-bold text-[#F7CBCA] hover:text-black">
          Sign In
        </Link>
      </p>
    </div>
  );
}
