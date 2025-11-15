"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  LogIn, 
  Mail, 
  Lock, 
  User, 
  BookOpen,
  Eye,
  EyeOff,
  UserPlus
} from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ 
    email: "", 
    password: "" 
  });
  const [status, setStatus] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus("Signing in...");

    try {
      const res = await fetch("http://127.0.0.1:5000/api/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          userType: "teacher"
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus("Login successful! Redirecting...");
        
        // Store login state and user info in localStorage
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userEmail", formData.email);
        localStorage.setItem("userType", "teacher");
        
        if (data.user) {
          localStorage.setItem("username", data.user.username || data.user.name || "");
          localStorage.setItem("userId", data.user._id || "");

          // Store teacher-specific info if applicable
          if (data.user.employeeId) {
            localStorage.setItem("employeeId", data.user.employeeId);
          }
        }

        // Redirect to teacher dashboard
        setTimeout(() => {
          router.push("/teacher/dashboard");
        }, 1000);
      } else {
        setStatus(data.error || "Invalid credentials");
      }
    } catch {
      setStatus("Error connecting to server");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl animate-pulse animation-delay-2000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
              <LogIn className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Teacher Login</h1>
          </div>
          <p className="text-slate-600 text-sm font-medium">Sign in to your teacher account</p>
        </div>

        {/* Sign In Form */}
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 sm:p-8 border-2 border-slate-200 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Teacher Badge */}
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-700 font-semibold">
                <BookOpen className="w-4 h-4" />
                Teacher Account
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label className="block text-slate-700 text-sm font-semibold mb-2">
                Email 
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  name="email"
                  type="email"
                  placeholder="Enter your teacher email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl pl-12 pr-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all duration-300"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-slate-700 text-sm font-semibold mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl pl-12 pr-12 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all duration-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 shadow-lg hover:shadow-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Signing In...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In as Teacher
                </>
              )}
            </button>
          </form>

          {/* Status Message */}
          {status && (
            <div className={`mt-6 p-4 rounded-xl text-center border-2 transition-all duration-300 ${
              status.includes("successful") 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : status.includes("Error") || status.includes("Invalid") 
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {status}
            </div>
          )}

          {/* Sign Up Link */}
          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={() => router.push("/signup")}
              className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-800 transition-colors font-semibold hover:scale-105 transform duration-300"
            >
              <UserPlus className="w-4 h-4" />
              Create new teacher account
            </button>
          </div>
        </div>

        {/* Demo Info */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm font-medium">
            Teacher Portal - Face Recognition Attendance System
          </p>
        </div>
      </div>
    </div>
  );
}