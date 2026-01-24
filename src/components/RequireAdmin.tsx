import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

interface Props {
  children: ReactNode;
}

const ADMIN_EMAIL = "pavlemitrovic01@gmail.com";

export default function RequireAdmin({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="p-6">Učitavanje...</p>;
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
