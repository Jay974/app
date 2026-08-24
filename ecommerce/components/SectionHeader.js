import Link from 'next/link';

export default function SectionHeader({ title, href, cta = 'Tout voir' }) {
  return (
    <div className="flex items-center justify-between px-4 mb-2.5">
      <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
      {href && (
        <Link href={href} className="text-xs font-semibold text-brand-600">
          {cta}
        </Link>
      )}
    </div>
  );
}
