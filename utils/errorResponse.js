/**
 * Custom error response class that extends the built-in Error class
 * Used to create standardized error objects with status codes
 */
class ErrorResponse extends Error {
    /**
     * Create a new ErrorResponse
     * @param {string} message Error message
     * @param {number} statusCode HTTP status code
     */
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      
      // Capture stack trace
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  module.exports = ErrorResponse;