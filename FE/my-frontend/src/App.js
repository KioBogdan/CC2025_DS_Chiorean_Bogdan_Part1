import React, { useState } from "react";
import "./App.css";
import { signIn, signOut, fetchAuthSession, confirmSignIn } from "aws-amplify/auth";

function decodeJwtPayload(token) {
  const payload = token.split(".")[1];
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(json);
}

function App() {
  const [message, setMessage] = useState(""); // backend message

  // Auth state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [claims, setClaims] = useState(null);

  // New password challenge state
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const connectToBackend = () => {
    const apiBaseUrl = process.env.REACT_APP_LOCAL_URL; //change with LOCAL_URL if local testing, otherwise REACT_APP_UI_AZURE_URL

    fetch(`${apiBaseUrl}/api/connect`)
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.json();
      })
      .then((data) => setMessage(data.message))
      .catch((error) => {
        console.error("Error connecting to backend:", error);
        setMessage("Failed to connect to backend.");
      });
  };

  const loadSessionAndClaims = async () => {
    const session = await fetchAuthSession({ forceRefresh: true });
    const idToken = session.tokens?.idToken?.toString(); 
    console.log("JWT (use in Swagger as Bearer):", idToken); //only if needed for local testing

    const apiBaseUrl = process.env.REACT_APP_LOCAL_URL; //change with LOCAL_URL if local testing, otherwise REACT_APP_UI_AZURE_URL

    if (!idToken) {
      setAuthStatus("Signed in, but still no ID token (unexpected).");
      return;
    }

    const payload = decodeJwtPayload(idToken);

    setClaims({
      email: payload.email,
      groups: payload["cognito:groups"] || [],
      deviceId: payload["custom:device_id"] || null,
      issuer: payload.iss,
      exp: payload.exp,
    });
    
    console.log("apiBaseUrl runtime:", apiBaseUrl);
    console.log("profile url:", `${apiBaseUrl}/api/profile`);

    fetch(`${apiBaseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((r) => r.json())
      .then((data) => console.log("Backend /api/profile:", data))
      .catch((err) => console.error("Profile call failed:", err));
    setAuthStatus("Signed in");

  };

  const handleLogin = async () => {
    try {
      setAuthStatus("Signing in...");

      console.log("Env check:", {
        region: process.env.REACT_APP_AWS_REGION,
        poolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
        clientId: process.env.REACT_APP_COGNITO_CLIENT_ID,
      });

      const res = await signIn({ username: email, password });
      console.log("signIn result:", res);
      console.log("nextStep:", res?.nextStep);

      // Cognito created users often require setting a new password on first sign-in
      if (res?.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        setNeedsNewPassword(true);
        setAuthStatus("New password required. Enter a new password and confirm.");
        return;
      }

      // Otherwise, tokens should be available
      await loadSessionAndClaims();
    } catch (e) {
      console.error("Login error:", e);
      setAuthStatus(`Login failed: ${e?.message || e}`);
    }
  };

  const handleConfirmNewPassword = async () => {
    try {
      setAuthStatus("Setting new password...");

      if (!newPassword) {
        setAuthStatus("Please enter a new password.");
        return;
      }

      await confirmSignIn({ challengeResponse: newPassword });

      // Challenge complete — now tokens should exist
      setNeedsNewPassword(false);
      setNewPassword("");
      await loadSessionAndClaims();
    } catch (e) {
      console.error("Confirm new password error:", e);
      setAuthStatus(`Confirm failed: ${e?.message || e}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setClaims(null);
      setAuthStatus("Signed out");
      setNeedsNewPassword(false);
      setNewPassword("");
    } catch (e) {
      console.error(e);
      setAuthStatus(`Sign out failed: ${e?.message || e}`);
    }
  };

  return (
    <div className="App">
      <header className="App-header" style={{ gap: 16 }}>
        <h1>Part 1 - Test connection</h1>

        {/* Existing backend test */}
        <button onClick={connectToBackend}>Connect backend</button>
        {message && <p>{message}</p>}

        <hr style={{ width: "80%" }} />

        {/* Cognito auth test (no Hosted UI) */}
        <h2>P3 - Cognito Auth Test</h2>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ padding: 8 }}
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={{ padding: 8 }}
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleLogin}>Sign in</button>
          <button onClick={handleLogout}>Sign out</button>
        </div>

        {/* Only show this when Cognito requires new password on first login */}
        {needsNewPassword && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              style={{ padding: 8 }}
              placeholder="New password (e.g. NewPassw0rd!234)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button onClick={handleConfirmNewPassword}>Confirm new password</button>
          </div>
        )}

        {authStatus && <p>{authStatus}</p>}

        {claims && (
          <pre
            style={{
              width: "80%",
              textAlign: "left",
              background: "#f6f6f6",
              color: "#111",
              padding: 12,
              borderRadius: 8,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(claims, null, 2)}
          </pre>
        )}
      </header>
    </div>
  );
}

export default App;
