import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Link } from "react-router";
import Background from "../components/Background";
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import { MailIcon, KeyRoundIcon, LoaderIcon, MailCheckIcon } from "lucide-react";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  // once the request goes through we swap the form for a confirmation, the
  // email may take a few seconds to arrive and people tend to resubmit
  const [emailSent, setEmailSent] = useState(false);
  const { forgotPassword, isSendingResetLink } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const sent = await forgotPassword({ email });
    if (sent) setEmailSent(true);
  };

  return (
    <Background>
      <div className="w-full flex items-center justify-center p-4 bg-transparent">
        <div className="relative w-full max-w-md">
          <BorderAnimatedContainer>
            <div className="w-full p-8">
              {/* HEADING TEXT */}
              <div className="text-center mb-8">
                <KeyRoundIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <h2 className="text-2xl font-bold text-slate-200 mb-2">
                  Forgot Password
                </h2>
                <p className="text-slate-400">
                  Enter your email and we'll send you a reset link
                </p>
              </div>

              {emailSent ? (
                <div className="text-center">
                  <MailCheckIcon className="w-10 h-10 mx-auto text-brand-soft mb-4" />
                  <p className="text-slate-300">
                    Check your inbox for the reset link. It expires in 15 minutes.
                  </p>
                </div>
              ) : (
                /* FORM */
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* EMAIL INPUT */}
                  <div>
                    <label className="auth-input-label">Email</label>
                    <div className="relative">
                      <MailIcon className="auth-input-icon" />

                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="auth-input"
                        placeholder="johndoe@gmail.com"
                      />
                    </div>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <button
                    className="auth-btn"
                    type="submit"
                    disabled={isSendingResetLink}
                  >
                    {isSendingResetLink ? (
                      <LoaderIcon className="w-full h-5 animate-spin text-center" />
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>
                </form>
              )}

              <div className="mt-6 text-center">
                <Link to="/login" className="auth-link">
                  Back to Login
                </Link>
              </div>
            </div>
          </BorderAnimatedContainer>
        </div>
      </div>
    </Background>
  );
}

export default ForgotPassword;
