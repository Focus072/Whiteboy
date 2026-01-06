/**
 * User-friendly error messages
 * 
 * Maps technical error codes to user-friendly messages
 */

export interface UserFriendlyError {
  message: string;
  title?: string;
  action?: string;
}

const ERROR_MESSAGES: Record<string, UserFriendlyError> = {
  // Authentication errors
  INVALID_CREDENTIALS: {
    message: 'The email or password you entered is incorrect. Please try again.',
    title: 'Login Failed',
    action: 'Please check your credentials and try again.',
  },
  EMAIL_EXISTS: {
    message: 'An account with this email already exists. Please sign in instead.',
    title: 'Account Exists',
    action: 'Try signing in or use a different email address.',
  },
  ACCOUNT_DISABLED: {
    message: 'Your account has been disabled. Please contact support for assistance.',
    title: 'Account Disabled',
    action: 'Contact customer support if you believe this is an error.',
  },
  UNAUTHORIZED: {
    message: 'You must be signed in to access this page.',
    title: 'Authentication Required',
    action: 'Please sign in and try again.',
  },
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: {
    message: 'Too many requests. Please wait a moment and try again.',
    title: 'Too Many Requests',
    action: 'Please wait a few minutes before trying again.',
  },
  
  // CSRF
  INVALID_CSRF_TOKEN: {
    message: 'Your session has expired. Please refresh the page and try again.',
    title: 'Session Expired',
    action: 'Refresh the page and try again.',
  },
  
  // Validation errors
  VALIDATION_ERROR: {
    message: 'Please check your input and try again.',
    title: 'Invalid Input',
    action: 'Review the form and correct any errors.',
  },
  
  // Order errors
  AGE_VERIFICATION_FAILED: {
    message: 'Age verification failed. You must be 21 or older to purchase nicotine products.',
    title: 'Age Verification Required',
    action: 'Please ensure you meet the age requirements.',
  },
  COMPLIANCE_BLOCKED: {
    message: 'This order cannot be completed due to state restrictions. Some products may not be available in your area.',
    title: 'Order Blocked',
    action: 'Please review your order and remove restricted items.',
  },
  PO_BOX_NOT_ALLOWED: {
    message: 'We cannot ship to PO boxes. Please provide a physical address.',
    title: 'PO Box Not Allowed',
    action: 'Please update your shipping address.',
  },
  CA_FLAVOR_BAN: {
    message: 'This product is not available in California due to flavor restrictions. Only tobacco-flavored products are allowed.',
    title: 'Product Not Available',
    action: 'Please select a tobacco-flavored product instead.',
  },
  CA_SENSORY_BAN: {
    message: 'Products with sensory cooling are not available in California.',
    title: 'Product Not Available',
    action: 'Please select a different product.',
  },
  CA_UTL_REQUIRED: {
    message: 'This product is not approved for sale in California.',
    title: 'Product Not Available',
    action: 'Please select a California-approved product.',
  },
  STAKE_CALL_REQUIRED: {
    message: 'A phone verification call is required for first-time California recipients. Our team will contact you.',
    title: 'Phone Verification Required',
    action: 'Please wait for our team to contact you before your order can be shipped.',
  },
  
  // Payment errors
  PAYMENT_FAILED: {
    message: 'Your payment could not be processed. Please check your payment information and try again.',
    title: 'Payment Failed',
    action: 'Verify your card details and try again, or use a different payment method.',
  },
  PAYMENT_DECLINED: {
    message: 'Your payment was declined by your bank. Please contact your bank or use a different payment method.',
    title: 'Payment Declined',
    action: 'Contact your bank or try a different payment method.',
  },
  
  // Shipping errors
  SHIPPING_ERROR: {
    message: 'We encountered an issue processing your shipping. Please try again or contact support.',
    title: 'Shipping Error',
    action: 'Try again or contact customer support.',
  },
  
  // Product errors
  PRODUCT_NOT_FOUND: {
    message: 'The product you are looking for is no longer available.',
    title: 'Product Not Found',
    action: 'Browse our other products.',
  },
  PRODUCT_OUT_OF_STOCK: {
    message: 'This product is currently out of stock.',
    title: 'Out of Stock',
    action: 'Check back later or browse similar products.',
  },
  
  // Address errors
  ADDRESS_NOT_FOUND: {
    message: 'The address you selected could not be found.',
    title: 'Address Not Found',
    action: 'Please add a new address or select a different one.',
  },
  
  // General errors
  INTERNAL_ERROR: {
    message: 'Something went wrong on our end. We have been notified and are working to fix the issue.',
    title: 'Something Went Wrong',
    action: 'Please try again in a few moments. If the problem persists, contact support.',
  },
  NETWORK_ERROR: {
    message: 'We could not connect to our servers. Please check your internet connection and try again.',
    title: 'Connection Error',
    action: 'Check your internet connection and try again.',
  },
  TIMEOUT: {
    message: 'The request took too long to complete. Please try again.',
    title: 'Request Timeout',
    action: 'Please try again.',
  },
};

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(errorCode: string, defaultMessage?: string): UserFriendlyError {
  const error = ERROR_MESSAGES[errorCode];
  
  if (error) {
    return error;
  }
  
  // Fallback to default message or generic error
  return {
    message: defaultMessage || 'An unexpected error occurred. Please try again.',
    title: 'Error',
    action: 'Please try again or contact support if the problem persists.',
  };
}

/**
 * Format error for API response
 */
export function formatApiError(errorCode: string, technicalMessage?: string): {
  code: string;
  message: string;
  userMessage: string;
  title?: string;
  action?: string;
} {
  const userError = getUserFriendlyError(errorCode, technicalMessage);
  
  return {
    code: errorCode,
    message: technicalMessage || userError.message,
    userMessage: userError.message,
    title: userError.title,
    action: userError.action,
  };
}
