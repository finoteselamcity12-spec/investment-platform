import { useState } from 'react'
import AppShell from './AppShell'
import HomePage from './HomePage'
import InvestPage from './InvestPage'
import DepositPage from './DepositPage'
import HistoryPage from './HistoryPage'
import Support from './Support'
import Profile from './Profile'
import AdminPanel from './AdminPanel'
import Withdraw from '../pages/Withdraw'

export default function MainApp() {
  const [activePage, setActivePage] = useState('home')

  const renderPage = (ctx) => {
    switch (activePage) {
      case 'home':
        return <HomePage ctx={ctx} />
      case 'deposit':
        return <DepositPage ctx={ctx} />
      case 'invest':
        return <InvestPage ctx={ctx} />
      case 'history':
        return <HistoryPage ctx={ctx} />
      case 'withdraw':
        return <Withdraw />
      case 'support':
        return <Support ctx={ctx} />
      case 'profile':
        return <Profile ctx={ctx} />
      case 'admin':
        return <AdminPanel />
      default:
        return <HomePage ctx={ctx} />
    }
  }

  return (
    <AppShell activePage={activePage} setActivePage={setActivePage}>
      {renderPage}
    </AppShell>
  )
}
