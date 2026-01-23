import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const ADMIN_EMAIL = "pavlemitrovic01@gmail.com";

type Props = {
  children: React.ReactNode;
};

export default function RequireAdmin({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && user.email === ADMIN_EMAIL) {
      setAuthorized(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    checkAdmin();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Unauthorized</div>
      </div>
    );
  }

  return <>{children}</>;
}