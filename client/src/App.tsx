import { Navigate, Route, Routes } from 'react-router-dom'
import AdminRoute from './components/AdminRoute'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Analytics from './pages/Analytics'
import Attendance from './pages/Attendance'
import AttendanceImport from './pages/AttendanceImport'
import Batches from './pages/Batches'
import Dashboard from './pages/Dashboard'
import Faculty from './pages/Faculty'
import Login from './pages/Login'
import Reports from './pages/Reports'
import Schedule from './pages/Schedule'
import StudentProfile from './pages/StudentProfile'
import Students from './pages/Students'
import Topics from './pages/Topics'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/students" element={<Students />} />
          <Route path="/students/:id" element={<StudentProfile />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/batches" element={<Batches />} />
          <Route path="/topics" element={<Topics />} />
          <Route element={<AdminRoute />}>
            <Route path="/faculty" element={<Faculty />} />
            <Route path="/attendance/import" element={<AttendanceImport />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
