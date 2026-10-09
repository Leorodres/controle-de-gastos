import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'

// Ponto de entrada: monta o componente <App /> dentro de <div id="root"> do index.html.
// StrictMode só atua em desenvolvimento: renderiza duas vezes de propósito para revelar bugs.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
