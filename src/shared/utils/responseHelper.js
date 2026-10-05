/**
 * Standardized JSON API Response Helper
 */

const responseHelper = {
  success: (res, data = {}, message = 'Success', status = 200) => {
    return res.status(status).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  },

  created: (res, data = {}, message = 'Resource created') => {
    return responseHelper.success(res, data, message, 201);
  },

  error: (res, message = 'Internal Server Error', status = 500, errors = null) => {
    return res.status(status).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  },

  badRequest: (res, message = 'Bad Request', errors = null) => {
    return responseHelper.error(res, message, 400, errors);
  },

  unauthorized: (res, message = 'Unauthorized access') => {
    return responseHelper.error(res, message, 401);
  },

  forbidden: (res, message = 'Forbidden') => {
    return responseHelper.error(res, message, 403);
  },

  notFound: (res, message = 'Resource not found') => {
    return responseHelper.error(res, message, 404);
  }
};

module.exports = responseHelper;
