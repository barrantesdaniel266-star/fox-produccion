import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import TvView from './TvView.jsx'

// Pantalla de planta sin login: /?tv=TOKEN (los datos los valida /api/tv)
const tvToken = new URLSearchParams(window.location.search).get('tv')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {tvToken ? <TvView token={tvToken} /> : <App />}
  </React.StrictMode>,
)
