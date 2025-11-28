import { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  token: string | null;
  login: (t: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  login: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>("");

  useEffect(() => {
    if (localStorage.getItem("bwm_token")) {
      setToken(localStorage.getItem("bwm_token"));
    }
  }, []);

  function login(t: string) {
    setToken(t);
    localStorage.setItem("bwm_token", t);
  }

  function logout() {
    setToken(null);
    localStorage.removeItem("bwm_token");
  }

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
