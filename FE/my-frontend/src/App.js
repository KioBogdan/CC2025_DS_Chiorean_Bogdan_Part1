import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { signIn, signOut, fetchAuthSession, confirmSignIn } from "aws-amplify/auth";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

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
  const [message, setMessage] = useState("");

  // Auth state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [claims, setClaims] = useState(null);

  // New password challenge state
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Final dashboard state
  const [devices, setDevices] = useState([]); // admin list
  const [selectedDevice, setSelectedDevice] = useState("");
  const [latestRecords, setLatestRecords] = useState([]);
  const [trendSeries, setTrendSeries] = useState([]);
  const [deviceCounts, setDeviceCounts] = useState([]);
  const [dashStatus, setDashStatus] = useState("");

  const apiBaseUrl = useMemo(() => {
    return process.env.REACT_APP_AZURE_URL || process.env.REACT_APP_LOCAL_URL;
  }, []);

  const connectToBackend = () => {
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

  async function apiGet(path) {
    const session = await fetchAuthSession({ forceRefresh: true });
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) throw new Error("No token. Please sign in again.");

    const res = await fetch(`${apiBaseUrl}${path}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`API ${res.status}: ${txt}`);
    }
    return res.json();
  }

  const loadSessionAndClaims = async () => {
    const session = await fetchAuthSession({ forceRefresh: true });
    const idToken = session.tokens?.idToken?.toString();

    console.log("JWT (use in Swagger as Bearer):", idToken);

    if (!idToken) {
      setAuthStatus("Signed in, but still no ID token (unexpected).");
      return;
    }

    const payload = decodeJwtPayload(idToken);

    const groups = payload["cognito:groups"] || [];
    const isAdmin = Array.isArray(groups) && groups.includes("admin");
    const deviceId = payload["custom:device_id"] || null;

    setClaims({
      email: payload.email,
      groups,
      deviceId,
      issuer: payload.iss,
      exp: payload.exp,
      isAdmin,
    });

    // Best default selection:
    // - admin: blank until they choose (or we can pick first device once loaded)
    // - user: force their assigned device
    if (!isAdmin && deviceId) {
      setSelectedDevice(deviceId);
    }

    // sanity call
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
        apiBaseUrl,
      });

      const res = await signIn({ username: email, password });
      console.log("signIn result:", res);
      console.log("nextStep:", res?.nextStep);

      if (res?.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        setNeedsNewPassword(true);
        setAuthStatus("New password required. Enter a new password and confirm.");
        return;
      }

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

      // clear dashboard state
      setDevices([]);
      setSelectedDevice("");
      setLatestRecords([]);
      setTrendSeries([]);
      setDeviceCounts([]);
      setDashStatus("");
    } catch (e) {
      console.error(e);
      setAuthStatus(`Sign out failed: ${e?.message || e}`);
    }
  };

  // Load device list for admins after login
  useEffect(() => {
    const run = async () => {
      if (!claims?.isAdmin) return;
      try {
        setDashStatus("Loading devices...");
        const data = await apiGet("/api/devices");
        const list = data.devices || [];
        setDevices(list);

        // pick first device by default if none selected
        if (!selectedDevice && list.length > 0) setSelectedDevice(list[0]);
        setDashStatus("");
      } catch (e) {
        console.error(e);
        setDashStatus(`Failed to load devices: ${e.message}`);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims?.isAdmin]);

  const loadLatest = async () => {
    try {
      setDashStatus("Loading latest table...");
      const q = selectedDevice ? `?device_id=${encodeURIComponent(selectedDevice)}&limit=200` : "?limit=200";
      const data = await apiGet(`/api/latest${q}`);
      setLatestRecords(data.records || []);
      setDashStatus("");
    } catch (e) {
      console.error(e);
      setDashStatus(`Latest load failed: ${e.message}`);
    }
  };

  const loadTrend = async () => {
    try {
      setDashStatus("Loading trend...");
      const q = selectedDevice
        ? `?device_id=${encodeURIComponent(selectedDevice)}&bucket=day`
        : "?bucket=day";
      const data = await apiGet(`/api/trend${q}`);
      setTrendSeries(data.series || []);
      setDashStatus("");
    } catch (e) {
      console.error(e);
      setDashStatus(`Trend load failed: ${e.message}`);
    }
  };

  const loadCounts = async () => {
    try {
      setDashStatus("Loading device counts...");
      const data = await apiGet("/api/device-counts");
      setDeviceCounts(data.devices || []);
      setDashStatus("");
    } catch (e) {
      console.error(e);
      setDashStatus(`Counts load failed: ${e.message}`);
    }
  };

  const showDashboard = Boolean(claims);

  return (
    <div className="App">
      <header className="App-header" style={{ gap: 16 }}>
        <h1>Cloud Computing Project</h1>

        {/* Existing backend test */}
        <button onClick={connectToBackend}>Connect backend</button>
        {message && <p>{message}</p>}

        <hr style={{ width: "80%" }} />

        {/* Auth */}
        <h2>Auth (AWS Cognito)</h2>

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

        {/* FINAL DASHBOARD */}
        {showDashboard && (
          <>
            <hr style={{ width: "80%" }} />
            <h2>Final Project Dashboard</h2>

            {/* Device selector */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 14 }}>
                Device:
              </div>

              {claims?.isAdmin ? (
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  style={{ padding: 8, minWidth: 220 }}
                >
                  {devices.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ padding: 8, background: "#f6f6f6", color: "#111", borderRadius: 6 }}>
                  {selectedDevice || "(no device assigned)"}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={loadLatest}>Load Latest Table</button>
              <button onClick={loadTrend}>Load Trend</button>
              <button onClick={loadCounts}>Load Device Counts</button>
            </div>

            {dashStatus && <p>{dashStatus}</p>}

            {/* 1) Latest table */}
            {latestRecords.length > 0 && (
              <div style={{ width: "90%", maxWidth: 1100, background: "#fff", color: "#111", padding: 12, borderRadius: 12 }}>
                <h3 style={{ marginTop: 0 }}>Latest Dataset (Table)</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["timestamp", "metric_value", "item_id", "qty", "unit_price", "store"].map((h) => (
                          <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {latestRecords.map((r, idx) => (
                        <tr key={idx}>
                          <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.timestamp}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.metric_value}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.item_id}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.qty}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.unit_price}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.store}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2) Trend line chart */}
            {trendSeries.length > 0 && (
              <div style={{ width: "90%", maxWidth: 1100, background: "#fff", color: "#111", padding: 12, borderRadius: 12 }}>
                <h3 style={{ marginTop: 0 }}>Historical Trend (Line)</h3>
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={trendSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="total_value" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 3) Device counts bar chart */}
            {deviceCounts.length > 0 && (
              <div style={{ width: "90%", maxWidth: 1100, background: "#fff", color: "#111", padding: 12, borderRadius: 12 }}>
                <h3 style={{ marginTop: 0 }}>Records per Device (Bar)</h3>
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={deviceCounts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="device_id" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="record_count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </header>
    </div>
  );
}

export default App;
