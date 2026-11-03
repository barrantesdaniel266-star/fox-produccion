import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Sitio público (mallasfox.com o /web en el dominio del sistema): sin login ni sistema interno
const WebPublica = lazy(() => import('./web/WebPublica.jsx'))
const esWeb = /^(www\.)?mallasfox\./i.test(window.location.hostname) || window.location.pathname.startsWith('/web')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {esWeb ? <Suspense fallback={null}><WebPublica /></Suspense> : <App />}
  </React.StrictMode>,
)
