import axios from 'axios'

// API base: use env in production (e.g. Railway), same-origin /api when not set
const apiBaseURL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api')

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 60000, // Increased timeout to 60 seconds for longer operations
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for adding auth tokens
api.interceptors.request.use(
  (config) => {
    // Get token from auth store instead of localStorage
    const authStore = JSON.parse(localStorage.getItem('auth-storage') || '{}')
    const token = authStore.state?.token
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    // Don't transform blob responses, as we need the raw data
    if (response.config.responseType === 'blob') {
      return response
    }
    
    return response.data // Return just the data part for JSON responses
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access - clear auth store
      localStorage.removeItem('auth-storage')
      window.location.href = '/login'
    }
    
    // For development, log the error
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// API endpoints
export const apiService = {
  // System endpoints
  getStatus: () => api.get('/status'),
  getHealth: () => api.get('/health'),
  testDatabase: () => api.get('/db-test'),

  // User endpoints
  getUsers: () => api.get('/users'),
  getUser: (id) => api.get(`/users/${id}`),
  getAssignableUsers: () => api.get('/users/assignable'),
  createUser: (userData) => api.post('/users', userData),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/users/${id}`),
  geocodeAllAddresses: () => api.post('/users/geocode-all'),
  getGeocodingProgress: () => api.get('/users/geocode-progress'),
  importMembersCSV: (file) => {
    console.log('🌐 API importMembersCSV called with file:', file.name, 'size:', file.size)
    
    // Create FormData object and append file
    const formData = new FormData()
    formData.append('file', file)
    
    // Log the FormData contents for debugging
    console.log('FormData created with file:', {
      name: file.name,
      type: file.type,
      size: file.size
    })
    
    // For debugging only - log form data entries
    console.log('FormData entries:')
    for (let pair of formData.entries()) {
      console.log(pair[0], pair[1])
    }
    
    // Use fetch API directly for maximum compatibility with file uploads
    return new Promise((resolve, reject) => {
      // Add extensive logging
      console.log('📤 Starting CSV import using fetch API')
      console.log('🔑 Authorization header:', `Bearer ${JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token || 'dev-token-valid'}`.substring(0, 20) + '...')
      
      // Get base URL from api instance's baseURL to ensure consistency
      const baseURL = api.defaults.baseURL || '/api';
      const importURL = baseURL.replace(/\/api$/, '') + '/api/users/import';
      
      console.log('🌐 Using import URL:', importURL);
      
      fetch(importURL, {
        method: 'POST',
        body: formData,
        headers: {
          // Important: DO NOT set Content-Type header for multipart/form-data
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token || 'dev-token-valid'}`
        },
        mode: 'cors',
        credentials: 'same-origin',
        // Set longer timeout for large CSV files
        timeout: 60000
      })
      .then(response => {
        console.log('Fetch response status:', response.status)
        console.log('Fetch response headers:', {
          'content-type': response.headers.get('content-type'),
          'content-length': response.headers.get('content-length')
        })
        
        if (!response.ok) {
          return response.text().then(errorText => {
            console.error('Error response text:', errorText)
            try {
              // Try to parse as JSON if possible
              const errorData = JSON.parse(errorText)
              throw new Error(JSON.stringify(errorData))
            } catch (e) {
              // If not JSON, use the raw text
              throw new Error(errorText || 'Unknown error occurred')
            }
          })
        }
        
        return response.text().then(text => {
          console.log('Response text (first 500 chars):', text.substring(0, 500))
          try {
            // Try to parse as JSON
            return JSON.parse(text)
          } catch (e) {
            console.error('Failed to parse response as JSON:', e)
            console.error('Raw response:', text)
            
            // Try to determine if the response might be HTML error page
            if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
              throw new Error('Server returned HTML instead of JSON. Server might be in error state.')
            }
            
            // Try to extract error message if present
            const errorMatch = text.match(/error[^:]*:(.*?)(?:\n|$)/i);
            if (errorMatch && errorMatch[1]) {
              throw new Error('Server error: ' + errorMatch[1].trim())
            }
            
            throw new Error('Invalid JSON response from server')
          }
        })
      })
      .then(data => {
        console.log('Import successful:', data)
        resolve({ data }) // Match axios response format
      })
      .catch(error => {
        console.error('Import failed:', error)
        console.error('Error name:', error.name)
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
        
        // Handle network errors specifically
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          console.error('Network error detected - server connection issue');
          const networkError = new Error('CSV import failed: Network error - cannot connect to server. Please ensure the backend server is running and try again.');
          networkError.originalError = error;
          networkError.isNetworkError = true;
          reject(networkError);
          return;
        }
        
        // Try to extract and log more details from the error
        if (error.message && error.message.includes('{')) {
          try {
            const errorData = JSON.parse(error.message)
            console.error('Parsed error data:', errorData)
          } catch (e) {
            console.error('Error parsing error message as JSON:', e)
          }
        }
        
        // Provide more context in the error
        const enhancedError = new Error(`CSV import failed: ${error.message || 'Unknown error'}`)
        enhancedError.originalError = error
        reject(enhancedError)
      })
    })
  },
  exportMembersCSV: () => {
    console.log('🌐 API exportMembersCSV called')
    
    // Use the configured API instance with correct baseURL and auth
    return api.get('/users/export/csv', {
      responseType: 'blob',
      headers: {
        'Accept': 'text/csv'
      }
    }).then(response => {
      console.log('📥 Export response received:', {
        status: response.status,
        headers: response.headers
      })
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition']
      let filename = 'members-export.csv'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }
      
      // Get the blob data
      const blob = new Blob([response.data], { type: 'text/csv' })
      
      // Check if we got valid CSV data (should be larger than fallback sample)
      if (blob.size < 100) {
        console.error('❌ Export received suspiciously small data:', blob.size, 'bytes')
        throw new Error('Invalid response data')
      }
      
      console.log('✅ Export successful:', {
        filename,
        blobSize: blob.size,
        blobType: blob.type
      })
      
      // Return blob and filename
      return { blob, filename }
    }).catch(error => {
      console.error('❌ Export failed:', error)
      
      // Show more specific error info
      if (error.response) {
        console.error('Error details:', {
          status: error.response.status,
          statusText: error.response.statusText
        })
      }
      
      // Throw the error instead of silently falling back to sample data
      throw error
    })
  },
  exportMembersPDF: () => {
    // This function is no longer used since PDF generation is done client-side
    // We'll keep it for future server-side implementation if needed
    console.log('exportMembersPDF called - using client-side generation instead')
    throw new Error('PDF export is handled on the client-side')
  },

  // Maintenance endpoints
  getMaintenanceImportLogs: () => api.get('/maintenance/import-logs'),
  clearMaintenanceImportLogs: () => api.post('/maintenance/clear-import-logs'),
  
  // Settings endpoints
  getSettings: () => api.get('/settings'),
  getSetting: (key) => api.get(`/settings/${key}`),
  updateSettings: (settings) => {
    console.log('API updateSettings called with data keys:', Object.keys(settings))
    
    // Create a new sanitized settings object for the request
    const sanitizedSettings = { ...settings }
    
    // Ensure logo data is properly handled
    if (sanitizedSettings.club_logo_data) {
      console.log('Club logo data present, length:', sanitizedSettings.club_logo_data.length)
      
      // Ensure it's a string (not an object or anything else)
      if (typeof sanitizedSettings.club_logo_data !== 'string') {
        console.error('Logo data is not a string, converting to string')
        
        // Try to convert to string if possible
        try {
          sanitizedSettings.club_logo_data = String(sanitizedSettings.club_logo_data)
        } catch (e) {
          console.error('Failed to convert logo data to string, removing it', e)
          delete sanitizedSettings.club_logo_data
        }
      }
    }
    
    // Add content-type header for large payloads
    const config = {
      headers: {
        'Content-Type': 'application/json'
      }
    }
    
    return api.put('/settings', sanitizedSettings, config)
  },
  updateSetting: (key, value) => api.put(`/settings/${key}`, { value }),

  // Auth endpoints
  sendLoginLink: (email) => api.post('/auth/send-login-link', { email }),
  validateToken: (token) => api.post('/auth/validate-token', { token }),
  
  // Email endpoints
  testEmail: (emailData) => api.post('/email/test-reminder', emailData),
  testSMTPConfig: (smtpData) => api.post('/email/test-smtp', smtpData),

  // Schedule endpoints
  getCurrentSchedule: () => api.get('/schedules/current'),
  getNextSchedule: () => api.get('/schedules/next'),
  createNextSchedule: (scheduleData) => api.post('/schedules/next', scheduleData),
  updateAssignment: (assignmentId, assignmentData) => api.put(`/schedules/assignments/${assignmentId}`, assignmentData),
  promoteSchedule: () => api.post('/schedules/promote'),
}

export default api
