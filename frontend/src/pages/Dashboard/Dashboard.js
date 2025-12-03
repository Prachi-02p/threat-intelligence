// import React, { useState } from "react";

// const Dashboard = () => {
//   const [domain, setDomain] = useState("");
//   const [result, setResult] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const handleScan = async () => {
//     if (!domain) return alert("Please enter a domain name");

//     setLoading(true);
//     setError("");
//     setResult(null);

//     try {
//       const res = await fetch(`http://127.0.0.1:8000/scan?domain=${domain}`);
//       const data = await res.json();

//       if (res.ok) {
//         setResult(data);
//       } else {
//         setError(data.error || "Failed to fetch data");
//       }
//     } catch (err) {
//       setError("Unable to connect to backend");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
//       {/* Title */}
//       <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
//         Threat Intelligence Dashboard
//       </h1>

//       {/* Domain Scan Section */}
//       <div className="bg-white p-6 rounded-2xl shadow mb-6">
//         <h2 className="text-lg font-semibold mb-3 text-gray-700">
//           Scan a Domain for Threats
//         </h2>
//         <div className="flex flex-col sm:flex-row gap-3">
//           <input
//             type="text"
//             placeholder="Enter domain (e.g., google.com)"
//             value={domain}
//             onChange={(e) => setDomain(e.target.value)}
//             className="flex-1 border rounded-lg p-2 focus:outline-none focus:ring focus:ring-blue-300"
//           />
//           <button
//             onClick={handleScan}
//             className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition"
//           >
//             {loading ? "Scanning..." : "Scan"}
//           </button>
//         </div>

//         {error && (
//           <p className="text-red-600 mt-3 text-sm font-medium">{error}</p>
//         )}

//         {result && (
//           <div className="mt-4 bg-gray-50 p-4 rounded-xl border">
//             <h3 className="text-lg font-semibold mb-2 text-gray-700">
//               Scan Result for: <span className="text-blue-600">{domain}</span>
//             </h3>

//             {result.error ? (
//               <p className="text-red-500">{result.error}</p>
//             ) : (
//               <pre className="text-sm bg-gray-100 p-3 rounded-lg overflow-auto max-h-64">
//                 {JSON.stringify(result, null, 2)}
//               </pre>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Overview Cards */}
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//         <div className="bg-white rounded-2xl shadow p-4 md:p-6">
//           <h2 className="text-gray-500 text-sm">Active Threats</h2>
//           <p className="text-2xl font-semibold text-red-600">32</p>
//         </div>
//         <div className="bg-white rounded-2xl shadow p-4 md:p-6">
//           <h2 className="text-gray-500 text-sm">Resolved Incidents</h2>
//           <p className="text-2xl font-semibold text-green-600">128</p>
//         </div>
//         <div className="bg-white rounded-2xl shadow p-4 md:p-6">
//           <h2 className="text-gray-500 text-sm">Ongoing Alerts</h2>
//           <p className="text-2xl font-semibold text-yellow-500">12</p>
//         </div>
//         <div className="bg-white rounded-2xl shadow p-4 md:p-6">
//           <h2 className="text-gray-500 text-sm">New Reports</h2>
//           <p className="text-2xl font-semibold text-blue-600">8</p>
//         </div>
//       </div>

//       {/* Charts Section */}
//       <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
//         <div className="bg-white p-4 rounded-2xl shadow">
//           <h3 className="text-lg font-semibold mb-2 text-gray-700">
//             Threats Over Time
//           </h3>
//           <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
//             [Chart Placeholder]
//           </div>
//         </div>

//         <div className="bg-white p-4 rounded-2xl shadow">
//           <h3 className="text-lg font-semibold mb-2 text-gray-700">
//             Region-wise Threats
//           </h3>
//           <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
//             [Chart Placeholder]
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Dashboard;


import React, { useState } from "react";

function ThreatDashboard() {
  const [domain, setDomain] = useState("");
  const [stats, setStats] = useState({
    harmless: 0,
    malicious: 0,
    suspicious: 0,
    undetected: 0
  });
  const [whois, setWhois] = useState("No WHOIS data available");
  const [rawData, setRawData] = useState(null);

  const handleScan = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/scan?domain=${domain}`);
      const data = await response.json();
      console.log(data);

      if (data.last_analysis_stats) {
        setStats(data.last_analysis_stats);
      }

      if (data.whois && data.whois !== "Not available") {
        setWhois(data.whois);
      } else {
        setWhois("No WHOIS data available");
      }

      setRawData(data);
    } catch (error) {
      console.error("Error fetching scan:", error);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Threat Intelligence Dashboard</h2>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Enter domain to scan"
          className="border p-2 rounded flex-grow"
        />
        <button
          onClick={handleScan}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Scan
        </button>
      </div>

      {/* Count Containers */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-white shadow rounded text-center">
          <p className="text-gray-500">Malicious</p>
          <p className="text-red-600 text-xl font-bold">{stats.malicious}</p>
        </div>
        <div className="p-4 bg-white shadow rounded text-center">
          <p className="text-gray-500">Suspicious</p>
          <p className="text-yellow-600 text-xl font-bold">{stats.suspicious}</p>
        </div>
        <div className="p-4 bg-white shadow rounded text-center">
          <p className="text-gray-500">Harmless</p>
          <p className="text-green-600 text-xl font-bold">{stats.harmless}</p>
        </div>
        <div className="p-4 bg-white shadow rounded text-center">
          <p className="text-gray-500">Undetected</p>
          <p className="text-gray-700 text-xl font-bold">{stats.undetected}</p>
        </div>
      </div>

      {/* WHOIS Section */}
      <div className="p-4 bg-gray-100 rounded mb-6">
        <h3 className="font-semibold">WHOIS Information</h3>
        <pre className="text-sm text-gray-600 mt-2">{whois}</pre>
      </div>

      {/* Raw JSON Data */}
      {rawData && (
        <div className="bg-gray-900 text-gray-200 p-4 rounded">
          <h4 className="font-semibold mb-2">Raw API Response</h4>
          <pre className=" whitespace-pre-wrap break-all"> {JSON.stringify(rawData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default ThreatDashboard;
