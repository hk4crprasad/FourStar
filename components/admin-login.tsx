'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Center } from '@astryxdesign/core/Center';
import { Heading } from '@astryxdesign/core/Heading';
import { VStack } from '@astryxdesign/core/Stack';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { jsonRequest } from '@/lib/client';
import type { Restaurant } from '@/lib/domain';
import { Brand, ErrorNotice, PoweredBy } from './shared';

export function AdminLogin({ restaurant }: { restaurant?: Restaurant }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!email || !password) { setError('Enter your staff email and password.'); return; }
    setBusy(true);
    setError('');
    try {
      await jsonRequest('/api/admin/session', 'POST', { email: email.trim(), password });
      window.location.assign('/admin');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
      setBusy(false);
    }
  }

  return <Center role="main" className="login-main" axis="both" padding={6}>
    <VStack className="login-panel" gap={4}>
      <Brand restaurant={restaurant} />
      <VStack className="single-panel" gap={3}>
        <LockKeyhole className="text-lime" size={23} />
        <Heading level={1}>Staff sign in</Heading>
        <p className="muted">Manage orders and your restaurant menu.</p>
        <form className="form-stack" onSubmit={submit}>
          <TextInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" isRequired />
          <TextInput label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" isRequired />
          <ErrorNotice>{error}</ErrorNotice>
          <Button className="solid-button" label="Sign in" type="submit" size="lg" isLoading={busy} />
        </form>
      </VStack>
      <Link className="text-action self-start" href="/"><ArrowLeft size={16} /> Back to menu</Link>
      <PoweredBy />
    </VStack>
  </Center>;
}
