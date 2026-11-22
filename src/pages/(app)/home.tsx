/** /home is the template's app entry; Casebook's home is the case list. */
import { Navigate } from 'react-router-dom'

export default function HomeRedirect() {
  return <Navigate to="/cases" replace />
}
