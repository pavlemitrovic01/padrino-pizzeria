import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";


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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAdmin();
  }, []);

  if (loading) {
    return <p className="p-6">Provera admin pristupa...</p>;
  }

  if (!authorized) {
    return (
      <div className="p-6 text-red-600">
        Nemate pristup admin panelu.
      </div>
    );
  }

  return <>{children}</>;
}

