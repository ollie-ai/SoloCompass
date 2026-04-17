import SEO from '../components/SEO';

export default function Blog() {
  return (
    <div className="min-h-screen bg-base-200 pt-20 pb-16">
      <SEO title="Blog - SoloCompass" description="Travel safety insights, solo planning tips, and SoloCompass product updates." />
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl font-black text-base-content mb-4">SoloCompass Blog</h1>
        <p className="text-base-content/70 mb-8">Placeholder content: travel guides, safety updates, and product stories will appear here.</p>
        <div className="space-y-4">
          {['How to plan your first solo trip', 'Solo travel safety checklist', 'What’s new in SoloCompass'].map((title) => (
            <article key={title} className="p-5 rounded-xl border border-base-300 bg-base-100">
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="text-sm text-base-content/60 mt-1">Placeholder excerpt for upcoming editorial content.</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
