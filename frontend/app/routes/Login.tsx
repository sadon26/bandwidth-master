import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:3001/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      login(data.token);
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
      <form
        onSubmit={handleSubmit}
        className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl w-full max-w-sm border border-white/20 shadow-xl"
      >
        <h1 className="text-3xl font-semibold text-white mb-6 text-center">
          Bandwidth Master
        </h1>

        {error && (
          <div className="text-red-300 text-sm mb-3 text-center">{error}</div>
        )}

        <label className="text-white text-sm">Email</label>
        <input
          className="w-full p-3 rounded-lg bg-white/5 border border-white/20 text-white mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="text-white text-sm">Password</label>
        <input
          type="password"
          className="w-full p-3 rounded-lg bg-white/5 border border-white/20 text-white mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="w-full bg-sky-600 hover:bg-sky-500 text-white py-3 rounded-xl font-medium"
          type="submit"
        >
          Login
        </button>
      </form>
    </div>
  );
}
