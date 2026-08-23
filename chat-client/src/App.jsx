import { Route, Routes } from "react-router";
import { ChatPage, Login, SignUp } from "./pages";
import Background from "./components/Background";
import { useAuthStore } from "./store/useAuthStore";

function App() {
  const { authUser, isLoggedIn, login, isLoading } = useAuthStore();

  console.log("auth user: ", authUser);
  console.log("isLoggedIn: ", isLoggedIn);
  console.log("isLoading: ", isLoading);

  return (
    <Background>
      <button onClick={login} className="z-10">
        Login
      </button>

      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
      </Routes>
    </Background>
  );
}

export default App;
