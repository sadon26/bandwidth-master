import { Outlet } from "react-router";
import Header from "../components/Header";

const Layout = () => {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <Header />
      <Outlet />
    </div>
  );
};

export default Layout;
