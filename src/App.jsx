import { Outlet } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout.jsx'

export default function App() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
