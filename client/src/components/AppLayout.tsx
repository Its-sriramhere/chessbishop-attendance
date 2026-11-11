import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, initials } from '../lib/format'

const mainNav = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileSpreadsheet },
]

const adminNav = [
  { to: '/schedule', label: 'Class Schedule', icon: CalendarDays },
  { to: '/batches', label: 'Batches', icon: Layers3 },
  { to: '/topics', label: 'Chess Topics', icon: BookOpen },
  { to: '/faculty', label: 'Faculty', icon: GraduationCap },
]

const titles: Record<string, string> = {
  '/dashboard': 'Overview',
  '/attendance': 'Attendance',
  '/attendance/import': 'Import attendance',
  '/students': 'Students',
  '/analytics': 'Analytics',
  '/reports': 'Reports',
  '/schedule': 'Class Schedule',
  '/batches': 'Batches',
  '/topics': 'Chess Topics',
  '/faculty': 'Faculty',
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const title = location.pathname.startsWith('/students/')
    ? 'Student Profile'
    : titles[location.pathname] ?? 'Academy'
  const isAdmin = user?.role === 'ADMIN'

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-paper">
      {open ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-ink-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col text-white transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background:
            'radial-gradient(140% 60% at 0% 0%, #1a2d55 0%, #0a1029 52%, #060a1f 100%)',
        }}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <img
            src="/chessbishop-emblem.png"
            alt="ChessBishop"
            className="h-11 w-11 rounded-xl bg-white/5 object-cover ring-1 ring-white/15"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight text-white">ChessBishop</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-300">Academy OS</p>
          </div>
          <button
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-5">
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400/80">Workspace</p>
            <div className="mt-2 space-y-1">
              {mainNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400/80">
              {isAdmin ? 'Academy setup' : 'My batches'}
            </p>
            <div className="mt-2 space-y-1">
              {adminNav
                .filter((item) => isAdmin || item.to !== '/faculty')
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600/30 text-xs font-bold text-brand-200">
                {user ? initials(user.name) : '—'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {user?.role === 'ADMIN' ? 'Administrator' : 'Faculty'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-paper/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <button
              onClick={() => setOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {isAdmin ? 'Academy workspace' : 'Faculty workspace'}
              </p>
              <h1 className="truncate font-display text-xl text-ink-900 sm:text-2xl">{title}</h1>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
                {formatDate(new Date())}
              </span>
              <Link to="/attendance" className="btn-primary !py-2">
                <ClipboardCheck className="h-4 w-4" />
                Mark attendance
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>

        <footer className="mx-auto w-full max-w-7xl px-4 pb-8 text-xs text-slate-400 sm:px-6 lg:px-8">
          ChessBishop Academy OS · Attendance, topics and learning analytics
        </footer>
      </div>
    </div>
  )
}
