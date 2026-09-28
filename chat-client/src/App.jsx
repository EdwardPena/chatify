import { Navigate, Route, Routes } from "react-router";
import {
  ChatPage,
  Login,
  SignUp,
  ForgotPassword,
  ResetPassword,
} from "./pages";
import { useAuthStore } from "./store/useAuthStore";
import { useEffect } from "react";
import PageLoader from "./components/PageLoader";
import { Toaster } from "react-hot-toast";

function App() {
  const { checkAuth, isCheckingAuth, authUser } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth) return <PageLoader />;

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={authUser ? <ChatPage /> : <Navigate to={"/login"} />}
        />
        <Route
          path="/login"
          element={!authUser ? <Login /> : <Navigate to={"/"} />}
        />
        <Route
          path="/signup"
          element={!authUser ? <SignUp /> : <Navigate to={"/"} />}
        />
        <Route
          path="/forgot-password"
          element={!authUser ? <ForgotPassword /> : <Navigate to={"/"} />}
        />
        <Route
          path="/reset-password/:token"
          element={!authUser ? <ResetPassword /> : <Navigate to={"/"} />}
        />
      </Routes>
      <Toaster
        toastOptions={{
          style: {
            background: "#1c2231",
            color: "#e2e8f0",
            border: "1px solid #252c3d",
          },
        }}
      />
    </>
  );
}

export default App;
