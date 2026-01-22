import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      await login(email, password);
      location.href = "/admin";
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-black p-6 rounded text-white w-80">
        <h1 className="text-xl mb-4">Admin Login</h1>
        <input
          className="w-full mb-2 p-2 text-black"
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full mb-2 p-2 text-black"
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button onClick={handleLogin} className="mt-3 w-full bg-red-600 p-2">
          Login
        </button>
      </div>
    </div>
  );
}
