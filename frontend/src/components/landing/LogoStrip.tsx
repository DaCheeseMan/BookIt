const LOGOS = [
  'Acme Corp',
  'Greenfield FC',
  'Lakeside Marina',
  'TechHub Berlin',
  'Nordic Saunas',
  'City Arena',
]

export function LogoStrip() {
  return (
    <section
      className="bg-white border-y border-slate-100 py-10 sm:py-12"
      aria-label="Trusted organisations"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-slate-400 uppercase tracking-widest mb-8">
          Join organisations already using BookIt
        </p>
        <ul
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12"
          role="list"
          aria-label="Organisation logos"
        >
          {LOGOS.map((name) => (
            <li key={name}>
              <span className="text-slate-300 font-bold text-lg sm:text-xl tracking-tight select-none">
                {name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
