// import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) return null;
  // if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
