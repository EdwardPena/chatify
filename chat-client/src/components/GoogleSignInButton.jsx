import { GoogleLogin } from "@react-oauth/google";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";

// shared by login and signup, google treats both as the same action
function GoogleSignInButton() {
  const { googleLogin } = useAuthStore();

  return (
    <div className="mt-6">
      {/* DIVIDER */}
      <div className="flex items-center gap-3 mb-6">
        <span className="h-px flex-1 bg-slate-700" />
        <span className="text-xs text-slate-400">OR</span>
        <span className="h-px flex-1 bg-slate-700" />
      </div>

      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={(response) => googleLogin(response.credential)}
          onError={() => toast.error("Google sign in failed")}
          theme="filled_black"
          shape="pill"
          width="320"
        />
      </div>
    </div>
  );
}

export default GoogleSignInButton;
