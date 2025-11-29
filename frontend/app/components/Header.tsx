import clsx from "clsx";
import { Link } from "react-router";
import { useAuth } from "~/context/AuthContext";

export default function Header({ darkMode }: { darkMode?: boolean }) {
  const { logout } = useAuth();

  const logoutUser = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <header className="mb-6 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-linear-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow">
          BWM
        </div>
        <div>
          <h1 className="text-xl font-bold">Bandwidth Master</h1>
          <div className="text-xs text-slate-500">
            Smart media compression & playback
          </div>
        </div>
      </Link>

      <nav className="flex items-center gap-3">
        <Link
          to="/"
          className={clsx(
            "text-sm hover:text-sky-600",
            darkMode ? "text-white" : "text-slate-700"
          )}
        >
          Dashboard
        </Link>
        <Link
          to="/"
          className={clsx(
            "text-sm ",
            darkMode
              ? "text-white hover:text-red-600"
              : "text-slate-700 hover:text-red-600"
          )}
          onClick={logoutUser}
        >
          Logout
        </Link>
      </nav>
    </header>
  );
}
