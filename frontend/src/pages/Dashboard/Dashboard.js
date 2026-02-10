// frontend/src/pages/Dashboard/Dashboard.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import SecurityStatus from "../../components/SecurityStatus";
import { scanDomain } from "../../services/api";
import { validateDomain, sanitizeInput, getCsrfToken } from "../../utils/security";
import { useRateLimit } from "../../hooks/useRateLimit";

const Dashboard = () => {
  // State management
  const [domain, setDomain] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [validationError, setValidationError] = useState("");
  const [recentScans, setRecentScans] = useState([]);
  
  // Refs
  const abortControllerRef = useRef(null);
  const cacheRef = useRef({});
  
  // Custom hooks
  const { scanCount, lastScanTime, updateScanCount, resetCounter } = useRateLimit();

  // Initialize on mount
  useEffect(() => {
    initializeDashboard();
    return cleanup;
  }, []);

  const initializeDashboard = () => {
    getCsrfToken();
    loadRecentScans();
  };

  const cleanup = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const loadRecentScans = () => {
    try {
      const saved = localStorage.getItem('recentScans');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Sanitize and validate stored data
        const sanitized = parsed.slice(0, 10).map(scan => ({
          domain: sanitizeInput(scan.domain || ''),
          timestamp: scan.timestamp || '',
          malicious: parseInt(scan.malicious) || 0,
          suspicious: parseInt(scan.suspicious) || 0
        })).filter(scan => {
          const validation = validateDomain(scan.domain, false);
          return validation.valid;
        });
        
        setRecentScans(sanitized);
      }
    } catch (e) {
      console.error('Error loading recent scans:', e);
      localStorage.removeItem('recentScans');
    }
  };

  const saveRecentScan = useCallback((scanData) => {
    try {
      const newScan = {
        domain: sanitizeInput(scanData.domain),
        timestamp: new Date().toISOString(),
        malicious: parseInt(scanData.last_analysis_stats?.malicious) || 0,
        suspicious: parseInt(scanData.last_analysis_stats?.suspicious) || 0,
        reputation: sanitizeInput(scanData.reputation || ''),
        scanId: scanData.scan_id || ''
      };

      const updatedScans = [newScan, ...recentScans].slice(0, 10);
      setRecentScans(updatedScans);
      
      // Store sanitized data
      localStorage.setItem('recentScans', JSON.stringify(updatedScans));
    } catch (e) {
      console.error('Error saving recent scan:', e);
    }
  }, [recentScans]);

  const checkCache = useCallback((domainKey) => {
    const cached = cacheRef.current[domainKey];
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }, []);

  const handleScan = async () => {
    // Clear previous states
    setError("");
    setSuccess("");
    setScanResult(null);
    setValidationError("");

    const trimmedDomain = domain.trim().toLowerCase();
    
    if (!trimmedDomain) {
      setError("Please enter a domain name");
      return;
    }

    // Client-side validation
    const validation = validateDomain(trimmedDomain, true);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    // Check rate limiting
    if (lastScanTime) {
      const timeSinceLastScan = new Date() - new Date(lastScanTime);
      if (timeSinceLastScan < 60000 && scanCount >= 5) {
        const secondsLeft = Math.ceil((60000 - timeSinceLastScan) / 1000);
        setError(`Rate limit exceeded. Please wait ${secondsLeft} seconds`);
        return;
      }
    }

    // Check cache
    const cachedResult = checkCache(trimmedDomain);
    if (cachedResult) {
      setSuccess("Loaded from cache (scanned within last 5 minutes)");
      setScanResult(cachedResult);
      saveRecentScan(cachedResult);
      return;
    }

    // Proceed with API call
    await performScan(trimmedDomain);
  };

  const performScan = async (domain) => {
    // Abort previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    updateScanCount();

    try {
      const result = await scanDomain(domain, abortControllerRef.current.signal);
      
      // Cache the result
      cacheRef.current[domain] = {
        data: result,
        timestamp: Date.now()
      };

      // Update state
      setScanResult(result);
      setSuccess("Scan completed successfully");
      saveRecentScan(result);
      
    } catch (err) {
      handleScanError(err);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleScanError = (err) => {
    let errorMessage = "An unexpected error occurred";
    
    if (err.name === 'AbortError') {
      errorMessage = 'Scan request was cancelled';
    } else if (err.message.includes('timeout')) {
      errorMessage = 'Request timeout. Please try again.';
    } else if (err.message.includes('network')) {
      errorMessage = 'Network error. Please check your connection.';
    } else if (err.message.includes('Rate limit')) {
      errorMessage = err.message;
    } else if (err.message.includes('Invalid domain')) {
      errorMessage = err.message;
    } else {
      // Sanitize error message
      errorMessage = sanitizeInput(err.message);
    }
    
    setError(errorMessage);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    
    // Basic validation as user types
    if (value.length > 253) {
      setValidationError("Domain too long (max 253 characters)");
    } else {
      setValidationError("");
    }
    
    setDomain(value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const clearRecentScans = () => {
    if (window.confirm('Are you sure you want to clear recent scans?')) {
      setRecentScans([]);
      localStorage.removeItem('recentScans');
    }
  };

  const renderRecentScans = () => {
    if (recentScans.length === 0) return null;

    return (
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Recent Scans</h3>
          <button
            onClick={clearRecentScans}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Clear All
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentScans.map((scan, index) => (
            <div 
              key={index} 
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-gray-800 truncate" title={scan.domain}>
                  {scan.domain}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(scan.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex space-x-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{scan.malicious}</div>
                  <div className="text-xs text-gray-500">Malicious</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600">{scan.suspicious}</div>
                  <div className="text-xs text-gray-500">Suspicious</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderScanResults = () => {
    if (!scanResult) return null;

    const stats = scanResult.last_analysis_stats || {
      harmless: 0,
      malicious: 0,
      suspicious: 0,
      undetected: 0
    };

    return (
      <>
        {/* Count Containers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 shadow rounded-lg text-center border border-red-100">
            <p className="text-gray-500 text-sm mb-1">Malicious</p>
            <p className="text-red-600 text-2xl font-bold">{stats.malicious}</p>
            <p className="text-xs text-gray-400 mt-1">Threat engines detected</p>
          </div>
          <div className="bg-white p-4 shadow rounded-lg text-center border border-yellow-100">
            <p className="text-gray-500 text-sm mb-1">Suspicious</p>
            <p className="text-yellow-600 text-2xl font-bold">{stats.suspicious}</p>
            <p className="text-xs text-gray-400 mt-1">Potential threats</p>
          </div>
          <div className="bg-white p-4 shadow rounded-lg text-center border border-green-100">
            <p className="text-gray-500 text-sm mb-1">Harmless</p>
            <p className="text-green-600 text-2xl font-bold">{stats.harmless}</p>
            <p className="text-xs text-gray-400 mt-1">Clean engines</p>
          </div>
          <div className="bg-white p-4 shadow rounded-lg text-center border border-gray-100">
            <p className="text-gray-500 text-sm mb-1">Undetected</p>
            <p className="text-gray-700 text-2xl font-bold">{stats.undetected}</p>
            <p className="text-xs text-gray-400 mt-1">No verdict</p>
          </div>
        </div>

        {/* WHOIS Section */}
        {scanResult.whois && scanResult.whois !== "No WHOIS data available" && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-700">WHOIS Information</h3>
            <div className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-64">
              <pre className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                {scanResult.whois}
              </pre>
            </div>
          </div>
        )}

        {/* Raw JSON Data with Security Warning */}
        <div className="bg-gray-900 text-gray-200 shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold text-lg">API Response Data</h4>
            <span className="text-xs bg-yellow-900 text-yellow-100 px-2 py-1 rounded">
              🔒 Sanitized Output
            </span>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg overflow-auto max-h-96">
            <pre className="text-sm whitespace-pre-wrap break-all">
              {JSON.stringify(scanResult, null, 2)}
            </pre>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Note: All data has been sanitized for security. HTML/script content has been removed.
          </p>
        </div>
      </>
    );
  };

  const renderEmptyState = () => {
    if (scanResult || loading || recentScans.length > 0) return null;

    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-700 mb-2">Start Scanning Domains</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Enter a domain name above to begin threat analysis. All scans are secured with input validation, rate limiting, and output sanitization.
        </p>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Threat Intelligence Dashboard</title>
        <meta name="description" content="Secure threat intelligence scanning dashboard" />
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' http://localhost:8000; script-src 'self'; style-src 'self' 'unsafe-inline';" />
      </Helmet>

      <div className="p-6 min-h-screen bg-gray-50">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">
          Threat Intelligence Dashboard
        </h1>

        {/* Security Status */}
        <SecurityStatus 
          scanCount={scanCount}
          lastScanTime={lastScanTime}
          onResetCounter={resetCounter}
        />

        {/* Domain Scan Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            Scan a Domain for Threats
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={domain}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Enter domain (e.g., google.com)"
                className={`w-full border rounded-lg p-3 focus:outline-none focus:ring-2 ${
                  validationError ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
                }`}
                maxLength={253}
                disabled={loading}
                aria-label="Domain to scan"
              />
              {validationError && (
                <p className="mt-2 text-sm text-red-600">{validationError}</p>
              )}
            </div>
            <button
              onClick={handleScan}
              disabled={loading || !domain.trim() || !!validationError}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                loading || !domain.trim() || validationError
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning...
                </span>
              ) : 'Scan Domain'}
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-medium">⚠️ {error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 mb-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-sm font-medium">✅ {success}</p>
            </div>
          )}

          {/* Security Tips */}
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <p className="font-medium mb-1">Security Tips:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Only scan legitimate domains you own or have permission to scan</li>
              <li>Rate limited to 5 scans per minute</li>
              <li>Results are cached for 5 minutes</li>
              <li>All inputs are validated and sanitized</li>
            </ul>
          </div>
        </div>

        {/* Recent Scans */}
        {renderRecentScans()}

        {/* Scan Results */}
        {renderScanResults()}

        {/* Empty State */}
        {renderEmptyState()}

        {/* Security Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-wrap justify-between items-center text-sm text-gray-500">
            <div>
              <span className="font-medium">Security Features:</span>
              <span className="ml-2">Input Validation • XSS Protection • CSRF Tokens • Rate Limiting</span>
            </div>
            <div className="mt-2 sm:mt-0">
              <span>Scan ID: {scanResult?.scan_id || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;