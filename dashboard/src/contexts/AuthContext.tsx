import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setToken, clearToken, getToken } from '../lib/api'

interface AuthState {
  token: string | null
  workspaceName: string | null
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, workspaceName: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: getToken(),
    workspaceName: localStorage.getItem('tf_workspace'),
  })

  async function login(email: string, password: string) {
    const res = await api.login(email, password)
    setToken(res.token)
    localStorage.setItem('tf_workspace', res.workspace.name)
    setState({ token: res.token, workspaceName: res.workspace.name })
  }

  async function register(email: string, password: string, workspaceName: string) {
    const res = await api.register(email, password, workspaceName)
    setToken(res.token)
    localStorage.setItem('tf_workspace', res.workspace.name)
    setState({ token: res.token, workspaceName: res.workspace.name })
  }

  function logout() {
    clearToken()
    localStorage.removeItem('tf_workspace')
    setState({ token: null, workspaceName: null })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
