import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/25">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-gray-900">WAHA</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
              <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
              <a href="#universities" className="hover:text-blue-600 transition-colors">Universities</a>
              <a href="#resources" className="hover:text-blue-600 transition-colors">Resources</a>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-sm font-medium text-gray-600 hover:text-gray-950 transition-colors">عربية</button>
            <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-950 transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-600/20">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold mb-8 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          Now available for MENA universities
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-6">
          From First Idea <br />
          <span className="text-blue-600">to Final Publication</span>
        </h1>

        <p className="text-gray-600 text-lg md:text-xl font-normal max-w-2xl mx-auto mb-10 leading-relaxed">
          WAHA guides you through every step of your research journey — intelligent analysis, document building, and citation management at the highest academic standards.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-blue-600/25 text-base flex items-center justify-center gap-3"
          >
            <span>Start Your Research</span>
            <span>&rarr;</span>
          </Link>
          <Link
            href="/demo"
            className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-2xl border border-gray-200 transition-all text-base flex items-center justify-center gap-3 shadow-sm"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Watch Demo</span>
          </Link>
        </div>

        {/* Trusted Universities */}
        <div className="pt-10 border-t border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-8">
            TRUSTED BY TOP UNIVERSITIES
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 text-gray-500 font-bold text-base md:text-lg opacity-80">
            <span>KAUST</span>
            <span>King Saud University</span>
            <span>Cairo University</span>
            <span>AUB</span>
            <span>Univ. of Sharjah</span>
          </div>
        </div>
      </main>
    </div>
  );
}