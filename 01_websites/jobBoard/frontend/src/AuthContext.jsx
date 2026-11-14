// The context alone, in its own file: AuthProvider fills it, the pages read it.
import { createContext } from 'react'

// null by default: the value received by a component that reads the context outside the Provider.
export const AuthContext = createContext(null)