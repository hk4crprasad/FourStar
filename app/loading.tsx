import { LoaderCircle } from 'lucide-react';

export default function Loading() {
  return <main className="loading-screen" role="status"><LoaderCircle className="animate-spin" size={28} /> Loading FourStar…</main>;
}
