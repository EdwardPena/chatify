import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Link } from "react-router";
import Background from "../components/Background";
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import GoogleSignInButton from "../components/GoogleSignInButton";
import {
  MessageCircleIcon,
  LockIcon,
  UserIcon,
  LoaderIcon,
} from "lucide-react";


function Login() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const { login, isLogginIn } = useAuthStore();

  const handleSubmit = (e) => {
    e.preventDefault();
    login(formData);
  };

  return (
    <Background>
      <div className="w-full flex items-center justify-center p-4 bg-transparent">
        <div className="relative w-full max-w-6xl md:h-[800px] h-[650px]">
          <BorderAnimatedContainer>
            <div className="w-full flex flex-col md:flex-row">
              {/* FORM CLOUMN - LEFT SIDE */}
              <div className="md:w-1/2 p-8 flex items-center justify-center md:border-r border-edge">
                <div className="w-full max-w-md">
                  {/* HEADING TEXT */}
                  <div className="text-center mb-8">
                    <MessageCircleIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-200 mb-2">
                      Welcome Back
                    </h2>
                    <p className="text-slate-400">Login to access to your account</p>
                  </div>

                  {/* FORM */}
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* USERNAME INPUT */}
                    <div>
                      <label className="auth-input-label">Username</label>
                      <div className="relative">
                        <UserIcon className="auth-input-icon" />

                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) =>
                            setFormData({ ...formData, username: e.target.value })
                          }
                          className="auth-input"
                          placeholder="johndoe"
                        />
                      </div>
                    </div>

                    {/* PASSWORD INPUT */}
                    <div>
                      <label className="auth-input-label">Password</label>
                      <div className="relative">
                        <LockIcon className="auth-input-icon" />

                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({ ...formData, password: e.target.value })
                          }
                          className="auth-input"
                          placeholder="Enter your password"
                        />
                      </div>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button
                      className="auth-btn"
                      type="submit"
                      disabled={isLogginIn}
                    >
                      {isLogginIn ? (
                        <LoaderIcon className="w-full h-5 animate-spin text-center" />
                      ) : (
                        "Sign In"
                      )}
                    </button>
                  </form>

                  <GoogleSignInButton />

                  <div className="mt-6 text-center space-y-3">
                    <Link to="/signup" className="auth-link">
                      Don't have an accont? Sign Up
                    </Link>
                    <div>
                      <Link
                        to="/forgot-password"
                        className="text-sm text-slate-400 hover:text-brand-soft transition-colors"
                      >
                        Forgot your password?
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* FORM ILLUSTRATION - RIGHT SIDE */}
              <div className="hidden md:w-1/2 md:flex items-center justify-center p-6 bg-gradient-to-bl from-surface-2/40 to-transparent">
                <div>
                  <img
                    src="/login.png"
                    alt="People using mobile devices"
                    className="w-full h-auto object-contain"
                  />
                  <div className="mt-6 text-center">
                    <h3 className="text-xl font-medium text-brand-soft">
                      Connect anytime, anywhere
                    </h3>

                    <div className="mt-4 flex justify-center gap-4">
                      <span className="auth-badge">Free</span>
                      <span className="auth-badge">Easy Setup</span>
                      <span className="auth-badge">Private</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </BorderAnimatedContainer>
        </div>
      </div>
    </Background>
  );
}

export default Login;
