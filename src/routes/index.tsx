import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <section className="relative py-20 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10"></div>
        <div className="relative max-w-5xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-black text-white mb-6">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Custom DnD Builder
            </span>
          </h1>
          <p className="text-2xl md:text-3xl text-gray-300 mb-4 font-light">
            Create fully customizable tabletop RPG experiences
          </p>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto mb-8">
            Design your own skills, stats, materials, items, and races. 
            Then bring your characters to life in play mode.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/config"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
            >
              Start Configuring
            </Link>
            <Link
              to="/play"
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
            >
              Play Now
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-white mb-4">Configuration Mode</h2>
            <p className="text-gray-400 mb-6">
              Design every aspect of your game system:
            </p>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">•</span>
                Define custom skills with 3-letter codes
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">•</span>
                Create stats with formula-based calculations
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">•</span>
                Build materials with bonuses and tiers
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">•</span>
                Design items and equipment systems
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2">•</span>
                Configure races with skill modifiers
              </li>
            </ul>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-white mb-4">Play Mode</h2>
            <p className="text-gray-400 mb-6">
              Bring your characters to life:
            </p>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">•</span>
                Create characters with your custom system
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">•</span>
                Manage inventory and equipment
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">•</span>
                Track stats and skill progression
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">•</span>
                Roll combat skills with dice simulation
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">•</span>
                All data stored locally in your browser
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
