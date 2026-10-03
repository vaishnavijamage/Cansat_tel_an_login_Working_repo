import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import "./App.css";

import TelemetryTestDashboard from "./TelemetryTestDashboard";

import Login from "./components/Login";
import Register from "./components/Register";
import VerifyOTP from "./components/VerifyOTP";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";

import SchoolDashboard from "./pages/SchoolDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

import ProtectedSchoolRoute from "./components/ProtectedSchoolRoute";
import ProtectedStudentRoute from "./components/ProtectedStudentRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";


function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* =========================================
                    DEFAULT
        ========================================= */}

        <Route
          path="/"
          element={<TelemetryTestDashboard />}
        />


        {/* =========================================
                    AUTHENTICATION
        ========================================= */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/login/student"
          element={<Login />}
        />

        <Route
          path="/login/school"
          element={<Login />}
        />

        <Route
          path="/login/admin"
          element={<AdminLogin />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/verify-otp"
          element={<VerifyOTP />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />


        {/* =========================================
                    SCHOOL DASHBOARD
        ========================================= */}

        <Route
          path="/school"
          element={
            <ProtectedSchoolRoute>
              <SchoolDashboard />
            </ProtectedSchoolRoute>
          }
        />


        {/* =========================================
                    STUDENT DASHBOARD
        ========================================= */}

        <Route
          path="/student"
          element={
            <ProtectedStudentRoute>
              <StudentDashboard />
            </ProtectedStudentRoute>
          }
        />


        <Route
          path="/dashboard"
          element={<Navigate to="/school" replace />}
        />

        <Route
          path="/student-dashboard"
          element={<Navigate to="/student" replace />}
        />

        <Route
          path="/admin-login"
          element={<Navigate to="/login/admin" replace />}
        />


        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminDashboard />
            </ProtectedAdminRoute>
          }
        />


        {/* =========================================
                    TEMPORARY TELEMETRY TEST
        ========================================= */}
        <Route
          path="/telemetry-test"
          element={<TelemetryTestDashboard />}
        />

        {/* =========================================
                    UNKNOWN ROUTES
        ========================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;