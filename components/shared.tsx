'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { AlertCircle, FlameKindling, ImageOff, X } from 'lucide-react';
import Link from 'next/link';
import type { Restaurant } from '@/lib/domain';

export function Brand({ restaurant, href = '/' }: { restaurant?: Pick<Restaurant, 'name' | 'logoUrl' | 'tagline'>; href?: string }) {
  return <Link href={href} className="brand" aria-label={restaurant?.name ?? 'FourStar'}>
    <HStack className="brand-mark" hAlign="center" vAlign="center">
      {restaurant?.logoUrl ? <Photo src={restaurant.logoUrl} alt="" /> : <FlameKindling size={24} strokeWidth={2.1} />}
    </HStack>
    <VStack className="brand-type">
      <strong>{restaurant?.name ?? 'FourStar'}</strong>
      <small>{restaurant?.tagline ?? 'INDIAN KITCHEN'}</small>
    </VStack>
  </Link>;
}

export function Photo({ src, alt = '', className, eager = false }: { src: string; alt?: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState('');
  if (!src || failed === src) return <HStack className={`photo-fallback ${className ?? ''}`} hAlign="center" vAlign="center" aria-hidden="true"><ImageOff size={24} /></HStack>;
  return <img src={src} alt={alt} className={className} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(src)} />;
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <HStack as="p" className="error-notice" gap={1} align="start" role="alert"><AlertCircle size={17} />{children}</HStack>;
}

export function Popup({ title, children, close, busy, end = false }: {
  title: string; children: ReactNode; close: () => void; busy?: boolean; end?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useRef(`popup-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).current;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={dialog} className={`popup ${end ? 'popup-end' : ''}`} aria-labelledby={id}
    onCancel={event => { event.preventDefault(); if (!busy) close(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <VStack className="popup-inner">
      <HStack className="popup-head" hAlign="between" vAlign="center" gap={2}>
        <Heading level={2} id={id}>{title}</Heading>
        <Button label="Close dialog" icon={<X size={20} />} isIconOnly variant="ghost" type="button" onClick={close} isDisabled={busy} />
      </HStack>
      {children}
    </VStack>
  </dialog>;
}

export function PoweredBy() {
  return <small className="powered">Powered by <strong>Phirmy</strong></small>;
}
