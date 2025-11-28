import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  layout("routes/Layout.tsx", [
    index("routes/Library.tsx"),
    route("/player/:mediaId", "routes/Player.tsx"),
    route("/compress/:mediaId", "routes/Compress.tsx"),
    route("/*", "routes/404.tsx"),
  ]),
  route("/login", "routes/Login.tsx"),
  route("/upload", "routes/Upload.tsx"),
] satisfies RouteConfig;
