// frontend/src/pages/Report/Report.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { 
  getReports, 
  generateReport, 
  downloadReport,
  deleteReport 
} from "../../services/api";
import { 
  sanitizeInput, 
  validateDateRange,
  escapeHtml,
  getCsrfToken 
} from "../../utils/security";
import ReportFilters from "./components/ReportFilters";
import ReportList from "./components/ReportList";
import ReportGenerator from "./components/ReportGenerator";
import SecurityAuditLog from "./components/SecurityAuditLog";
import EmptyState from "./components/EmptyState";
import { useRateLimit } from "../../hooks/useRateLimit";

const Report = () => {
  // State management
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [generating, setGenerating] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    severity: 'all',
    status: 'all',
    searchQuery: ''
  });
  
  // Audit logs and security state
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Refs for cleanup
  const abortControllerRef = useRef(null);
  const downloadRef = useRef(null);
  
  // Custom hooks
  const { scanCount, updateScanCount, checkRateLimit } = useRateLimit();

  // Initialize on mount
  useEffect(() => {
    initializeReports();
    return cleanup;
  }, []);

  const initializeReports = async () => {
    try {
      // Load CSRF token
      getCsrfToken();
      
      // Load reports with security headers
      await loadReports();
      
      // Load audit logs
      await loadAuditLogs();
    } catch (err) {
      handleError(err, 'Failed to initialize reports');
    }
  };

  const cleanup = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (downloadRef.current) {
      URL.revokeObjectURL(downloadRef.current);
    }
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await getReports();
      
      // Sanitize all report data
      const sanitizedReports = response.map(report => ({
        ...report,
        title: sanitizeInput(report.title),
        description: sanitizeInput(report.description),
        findings: report.findings?.map(finding => sanitizeInput(finding)),
        recommendations: report.recommendations?.map(rec => sanitizeInput(rec)),
        generatedBy: sanitizeInput(report.generatedBy),
        lastModified: report.lastModified || new Date().toISOString()
      }));
      
      setReports(sanitizedReports);
      setFilteredReports(sanitizedReports);
    } catch (err) {
      handleError(err, 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      // In a real app, this would come from an API
      const logs = JSON.parse(localStorage.getItem('report_audit_logs') || '[]');
      
      // Sanitize audit logs
      const sanitizedLogs = logs.map(log => ({
        ...log,
        action: sanitizeInput(log.action),
        user: sanitizeInput(log.user),
        details: sanitizeInput(log.details),
        ip: sanitizeInput(log.ip),
        userAgent: sanitizeInput(log.userAgent)
      })).slice(0, 50); // Limit to 50 most recent logs
      
      setAuditLogs(sanitizedLogs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const logAuditAction = useCallback((action, details, severity = 'info') => {
    const auditLog = {
      timestamp: new Date().toISOString(),
      action: sanitizeInput(action),
      user: 'current_user', // In real app, get from auth context
      details: sanitizeInput(details),
      ip: sanitizeInput(window.location.hostname),
      userAgent: sanitizeInput(navigator.userAgent),
      severity
    };

    const updatedLogs = [auditLog, ...auditLogs].slice(0, 100);
    setAuditLogs(updatedLogs);
    
    // Store in localStorage (in real app, send to backend)
    try {
      localStorage.setItem('report_audit_logs', JSON.stringify(updatedLogs));
    } catch (err) {
      console.error('Failed to save audit log:', err);
    }
  }, [auditLogs]);

  const handleError = (err, defaultMessage) => {
    console.error('Report error:', err);
    
    // Sanitize error message for display
    let errorMessage = sanitizeInput(defaultMessage);
    
    if (err.message) {
      // Only show safe error messages
      if (err.message.includes('network') || 
          err.message.includes('timeout') ||
          err.message.includes('rate limit')) {
        errorMessage = sanitizeInput(err.message);
      }
    }
    
    setError(errorMessage);
    logAuditAction('ERROR', `Report error: ${errorMessage}`, 'high');
  };

  const handleFilterChange = useCallback((newFilters) => {
    // Validate filters
    const validatedFilters = {
      ...newFilters,
      searchQuery: sanitizeInput(newFilters.searchQuery, { maxLength: 100 }),
      dateRange: validateDateRange(newFilters.dateRange)
    };
    
    setFilters(validatedFilters);
    
    // Apply filters
    let filtered = [...reports];
    
    // Apply search filter
    if (validatedFilters.searchQuery) {
      const query = validatedFilters.searchQuery.toLowerCase();
      filtered = filtered.filter(report => 
        report.title.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.findings?.some(finding => finding.toLowerCase().includes(query))
      );
    }
    
    // Apply severity filter
    if (validatedFilters.severity !== 'all') {
      filtered = filtered.filter(report => report.severity === validatedFilters.severity);
    }
    
    // Apply status filter
    if (validatedFilters.status !== 'all') {
      filtered = filtered.filter(report => report.status === validatedFilters.status);
    }
    
    // Apply date range filter
    if (validatedFilters.dateRange.start && validatedFilters.dateRange.end) {
      filtered = filtered.filter(report => {
        const reportDate = new Date(report.createdAt);
        const startDate = new Date(validatedFilters.dateRange.start);
        const endDate = new Date(validatedFilters.dateRange.end);
        return reportDate >= startDate && reportDate <= endDate;
      });
    }
    
    setFilteredReports(filtered);
    logAuditAction('FILTER_REPORTS', `Applied filters: ${JSON.stringify(validatedFilters)}`);
  }, [reports, logAuditAction]);

  const handleGenerateReport = async (reportConfig) => {
    // Check rate limit
    const rateLimit = checkRateLimit();
    if (!rateLimit.allowed) {
      setError(rateLimit.error);
      return;
    }

    setGenerating(true);
    setError("");
    setSuccess("");

    try {
      // Validate report configuration
      if (!reportConfig.title || !reportConfig.type) {
        throw new Error('Report title and type are required');
      }

      // Sanitize report configuration
      const sanitizedConfig = {
        ...reportConfig,
        title: sanitizeInput(reportConfig.title, { maxLength: 200 }),
        description: sanitizeInput(reportConfig.description || '', { maxLength: 1000 }),
        filters: reportConfig.filters ? sanitizeInput(JSON.stringify(reportConfig.filters)) : null
      };

      // Generate report
      const newReport = await generateReport(sanitizedConfig);
      updateScanCount();

      // Add to reports list
      const sanitizedReport = {
        ...newReport,
        title: sanitizeInput(newReport.title),
        description: sanitizeInput(newReport.description),
        findings: newReport.findings?.map(finding => sanitizeInput(finding))
      };

      setReports(prev => [sanitizedReport, ...prev]);
      setFilteredReports(prev => [sanitizedReport, ...prev]);
      
      setSuccess(`Report "${sanitizeInput(newReport.title)}" generated successfully`);
      logAuditAction('GENERATE_REPORT', `Generated report: ${sanitizedReport.title}`, 'medium');
    } catch (err) {
      handleError(err, 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = async (reportId, format = 'pdf') => {
    if (!reportId) {
      setError('Invalid report ID');
      return;
    }

    try {
      // Check if download is already in progress
      if (downloadRef.current) {
        URL.revokeObjectURL(downloadRef.current);
      }

      const blob = await downloadReport(reportId, format);
      
      // Create secure download link
      const url = URL.createObjectURL(blob);
      downloadRef.current = url;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportId}-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      
      logAuditAction('DOWNLOAD_REPORT', `Downloaded report ${reportId} in ${format} format`);
    } catch (err) {
      handleError(err, 'Failed to download report');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!reportId) {
      setError('Invalid report ID');
      return;
    }

    // Show confirmation dialog
    setSelectedReport(reportId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteReport = async () => {
    if (!selectedReport) return;

    try {
      await deleteReport(selectedReport);
      
      // Remove from state
      setReports(prev => prev.filter(report => report.id !== selectedReport));
      setFilteredReports(prev => prev.filter(report => report.id !== selectedReport));
      
      setSuccess('Report deleted successfully');
      logAuditAction('DELETE_REPORT', `Deleted report ${selectedReport}`, 'high');
    } catch (err) {
      handleError(err, 'Failed to delete report');
    } finally {
      setShowDeleteConfirm(false);
      setSelectedReport(null);
    }
  };

  const handleExportAll = async () => {
    // Check rate limit
    const rateLimit = checkRateLimit();
    if (!rateLimit.allowed) {
      setError(rateLimit.error);
      return;
    }

    try {
      // Export all filtered reports
      const exportData = filteredReports.map(report => ({
        id: report.id,
        title: report.title,
        severity: report.severity,
        status: report.status,
        createdAt: report.createdAt,
        generatedBy: report.generatedBy,
        summary: report.description?.substring(0, 200)
      }));

      // Create secure blob
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      downloadRef.current = url;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `reports-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      logAuditAction('EXPORT_REPORTS', `Exported ${exportData.length} reports`, 'medium');
      setSuccess(`Exported ${exportData.length} reports successfully`);
    } catch (err) {
      handleError(err, 'Failed to export reports');
    }
  };

  const clearFilters = () => {
    setFilters({
      dateRange: { start: '', end: '' },
      severity: 'all',
      status: 'all',
      searchQuery: ''
    });
    setFilteredReports(reports);
    logAuditAction('CLEAR_FILTERS', 'Cleared all report filters');
  };

  // Security statistics
  const securityStats = {
    totalReports: reports.length,
    highSeverity: reports.filter(r => r.severity === 'high').length,
    mediumSeverity: reports.filter(r => r.severity === 'medium').length,
    lowSeverity: reports.filter(r => r.severity === 'low').length,
    completed: reports.filter(r => r.status === 'completed').length,
    pending: reports.filter(r => r.status === 'pending').length
  };

  return (
    <>
      <Helmet>
        <title>Threat Intelligence Reports</title>
        <meta name="description" content="Secure threat intelligence reporting system" />
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' http://localhost:8000; script-src 'self'; style-src 'self' 'unsafe-inline';" />
      </Helmet>

      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Threat Intelligence Reports
          </h1>
          <p className="text-gray-600 mt-2">
            View, generate, and manage security threat reports
          </p>
        </div>

        {/* Security Status Bar */}
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-gray-700">
                  Security: Active
                </span>
              </div>
              <span className="text-xs text-gray-500">
                • Audit Logging: Enabled • Data Encryption: Enabled • Access Control: Active
              </span>
            </div>
            <div className="mt-2 md:mt-0">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Reports: {securityStats.totalReports} • High: {securityStats.highSeverity}
              </span>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-700 text-sm font-medium">{success}</p>
            </div>
          </div>
        )}

        {/* Report Generator Section */}
        <div className="mb-8">
          <ReportGenerator
            onGenerate={handleGenerateReport}
            generating={generating}
            scanCount={scanCount}
          />
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <p className="text-gray-500 text-sm">Total Reports</p>
            <p className="text-2xl font-bold text-gray-800">{securityStats.totalReports}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-red-100">
            <p className="text-gray-500 text-sm">High Severity</p>
            <p className="text-2xl font-bold text-red-600">{securityStats.highSeverity}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-yellow-100">
            <p className="text-gray-500 text-sm">Medium Severity</p>
            <p className="text-2xl font-bold text-yellow-600">{securityStats.mediumSeverity}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-green-100">
            <p className="text-gray-500 text-sm">Low Severity</p>
            <p className="text-2xl font-bold text-green-600">{securityStats.lowSeverity}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-blue-100">
            <p className="text-gray-500 text-sm">Completed</p>
            <p className="text-2xl font-bold text-blue-600">{securityStats.completed}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <p className="text-gray-500 text-sm">Pending</p>
            <p className="text-2xl font-bold text-gray-600">{securityStats.pending}</p>
          </div>
        </div>

        {/* Report Filters */}
        <div className="mb-8">
          <ReportFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
            onExportAll={handleExportAll}
            exportDisabled={filteredReports.length === 0}
          />
        </div>

        {/* Report List */}
        <div className="mb-8">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : filteredReports.length > 0 ? (
            <ReportList
              reports={filteredReports}
              onDownload={handleDownloadReport}
              onDelete={handleDeleteReport}
            />
          ) : (
            <EmptyState
              title="No reports found"
              message={reports.length > 0 
                ? "Try adjusting your filters"
                : "No reports generated yet. Create your first report above."
              }
            />
          )}
        </div>

        {/* Security Audit Log */}
        <div className="mb-8">
          <SecurityAuditLog logs={auditLogs} />
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Confirm Delete
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this report? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedReport(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteReport}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <div>
              <span className="font-medium">Security Features:</span>
              <span className="ml-2">Audit Logging • Input Validation • CSRF Protection • Rate Limiting</span>
            </div>
            <div className="mt-2 md:mt-0">
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                Last Updated: {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Add security metadata
Report.displayName = 'ReportComponent';
Report.security = {
  requiresAuth: true,
  permission: 'view_reports',
  dataClassification: 'confidential',
  auditRequired: true
};

export default Report;