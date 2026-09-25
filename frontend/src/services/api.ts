const API_BASE_URL = "http://localhost:5000";

type ApiOptions = {
    method?: string;
    body?: unknown;
};

async function apiRequest(
    endpoint: string,
    options: ApiOptions = {}
) {
    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            method: options.method || "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: options.body
                ? JSON.stringify(options.body)
                : undefined,
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Something went wrong."
        );
    }

    return data;
}


/*
 * School Registration
 */
export function registerSchool(data: {
    schoolName: string;
    email: string;
    phone: string;
    password: string;
}) {
    return apiRequest(
        "/api/auth/register",
        {
            method: "POST",
            body: data,
        }
    );
}
/* student login*/

export function loginStudent(data: {
    username: string;
    password: string;
}) {
    return apiRequest(
        "/api/auth/student-login",
        {
            method: "POST",
            body: data,
        }
    );
}

/*
 * School Login
 */
export function loginSchool(data: {
    email: string;
    password: string;
}) {
    return apiRequest(
        "/api/auth/login",
        {
            method: "POST",
            body: data,
        }
    );
}


/*
 * Check current logged-in user
 */
export function getCurrentUser() {
    return apiRequest(
        "/api/auth/me"
    );
}


/*
 * Logout
 */
export function logout() {
    return apiRequest(
        "/api/auth/logout",
        {
            method: "POST",
        }
    );
}

export function forgotPassword(data: {
    email: string;
}) {
    return apiRequest(
        "/api/auth/forgot-password",
        {
            method: "POST",
            body: data,
        }
    );
}

/*
 * Reset password using a reset token
 */
export function resetPassword(data: {
    token: string;
    newPassword: string;
}) {
    return apiRequest(
        "/api/auth/reset-password",
        {
            method: "POST",
            body: data,
        }
    );
}

/*
 * Get students belonging to the logged-in school
 */
export function getSchoolStudents() {
    return apiRequest("/api/students");
}

/*
 * Activate student
 */
export function activateStudent(studentId: number) {
    return apiRequest(
        `/api/students/${studentId}/activate`,
        {
            method: "PATCH",
        }
    );
}


/*
 * Deactivate student
 */
export function deactivateStudent(studentId: number) {
    return apiRequest(
        `/api/students/${studentId}/deactivate`,
        {
            method: "PATCH",
        }
    );
}

/*
 * Delete student
 */
export function deleteStudent(studentId: number) {
    return apiRequest(
        `/api/students/${studentId}`,
        {
            method: "DELETE",
        }
    );
}
/*
 * Create a student account


 */
export function createStudent(data: {
    studentName: string;
    username: string;
    password: string;
}) {
    return apiRequest("/api/students", {
        method: "POST",
        body: data,
    });
}

/* =========================================================
   GET STUDENT PROFILE
========================================================= */

export async function getStudentProfile() {
    const response = await fetch(
        "http://localhost:5000/api/auth/student/me",
        {
            method: "GET",
            credentials: "include",
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Unable to load student profile."
        );
    }

    return data;
}


/* =========================================================
   CHANGE STUDENT PASSWORD
========================================================= */

export async function changeStudentPassword(
    currentPassword: string,
    newPassword: string
) {
    const response = await fetch(
        "http://localhost:5000/api/auth/student/password",
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                currentPassword,
                newPassword,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Unable to change password."
        );
    }

    return data;
} 