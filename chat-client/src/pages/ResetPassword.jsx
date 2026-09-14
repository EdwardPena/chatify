import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Link, useNavigate, useParams } from "react-router";
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import { LockIcon, KeyRoundIcon, LoaderIcon } from "lucide-react";
import toast from "react-hot-toast";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const { resetPassword, isResettingPassword } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // catching the mismatch here saves a round trip, the server still checks
    // the length of the password it receives
    if (formData.password !== formData.confirmPassword) {
      return toast.error("Passwords do not match");
    }

    const done = await resetPassword(token, { password: formData.password });
    if (done) navigate("/login");
  };

  return (
    <div className="w-full flex items-center justify-center p-4 bg-slate-900">
      <div className="relative w-full max-w-md">
        <BorderAnimatedContainer>
          <div className="w-full p-8">
            {/* HEADING TEXT */}
            <div className="text-center mb-8">
              <KeyRoundIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <h2 className="text-2xl font-bold text-slate-200 mb-2">
                New Password
              </h2>
              <p className="text-slate-400">Choose a password to get back in</p>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* PASSWORD INPUT */}
              <div>
                <label className="auth-input-label">New Password</label>
                <div className="relative">
                  <LockIcon className="auth-input-icon" />

                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="input"
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>

              {/* CONFIRM PASSWORD INPUT */}
              <div>
                <label className="auth-input-label">Confirm Password</label>
                <div className="relative">
                  <LockIcon className="auth-input-icon" />

                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="input"
                    placeholder="Repeat your password"
                  />
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                className="auth-btn"
                type="submit"
                disabled={isResettingPassword}
              >
                {isResettingPassword ? (
                  <LoaderIcon className="w-full h-5 animate-spin text-center" />
                ) : (
                  "Update Password"
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="auth-link">
                Back to Login
              </Link>
            </div>
          </div>
        </BorderAnimatedContainer>
      </div>
    </div>
  );
}

export default ResetPassword;
