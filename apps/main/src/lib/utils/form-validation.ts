/**
 * Real-time form validation utilities
 */

import { useState, useCallback } from 'react';

export interface ValidationRule {
  test: (value: string) => boolean;
  message: string;
}

export interface FieldValidation {
  value: string;
  rules: ValidationRule[];
  touched?: boolean;
}

export function validateField(value: string, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    if (!rule.test(value)) {
      return rule.message;
    }
  }
  return null;
}

// Common validation rules
export const validationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    test: (value) => value.trim().length > 0,
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    test: (value) => value.length >= min,
    message: message || `Must be at least ${min} characters`,
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    test: (value) => value.length <= max,
    message: message || `Must be no more than ${max} characters`,
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    test: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
    message,
  }),

  phone: (message = 'Please enter a valid phone number'): ValidationRule => ({
    test: (value) => {
      const phoneRegex = /^[\d\s\-\(\)]+$/;
      return phoneRegex.test(value) && value.replace(/\D/g, '').length >= 10;
    },
    message,
  }),

  zipCode: (message = 'Please enter a valid ZIP code'): ValidationRule => ({
    test: (value) => {
      const zipRegex = /^\d{5}(-\d{4})?$/;
      return zipRegex.test(value);
    },
    message,
  }),

  cardNumber: (message = 'Please enter a valid card number'): ValidationRule => ({
    test: (value) => {
      const digits = value.replace(/\D/g, '');
      return digits.length >= 13 && digits.length <= 19;
    },
    message,
  }),

  expirationDate: (message = 'Please enter a valid expiration date (MM/YY)'): ValidationRule => ({
    test: (value) => {
      const match = value.match(/^(\d{2})\/(\d{2})$/);
      if (!match) return false;
      const month = parseInt(match[1], 10);
      const year = parseInt(match[2], 10);
      const currentYear = new Date().getFullYear() % 100;
      const currentMonth = new Date().getMonth() + 1;
      if (month < 1 || month > 12) return false;
      if (year < currentYear || (year === currentYear && month < currentMonth)) return false;
      return true;
    },
    message,
  }),

  cvv: (message = 'Please enter a valid CVV'): ValidationRule => ({
    test: (value) => {
      const digits = value.replace(/\D/g, '');
      return digits.length === 3 || digits.length === 4;
    },
    message,
  }),

  dateOfBirth: (message = 'You must be 21 or older'): ValidationRule => ({
    test: (value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        return age - 1 >= 21;
      }
      return age >= 21;
    },
    message,
  }),

  noPoBox: (message = 'PO Boxes are not allowed for nicotine products'): ValidationRule => ({
    test: (value) => {
      const poBoxRegex = /(p\.?\s*o\.?\s*box|po\s*box|post\s*office\s*box)/i;
      return !poBoxRegex.test(value);
    },
    message,
  }),
};

/**
 * Use this hook for real-time form validation
 */
export function useFieldValidation(
  initialValue: string,
  rules: ValidationRule[],
  validateOnChange = true
) {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(() => {
    const validationError = validateField(value, rules);
    setError(validationError);
    return validationError === null;
  }, [value, rules]);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    if (validateOnChange && touched) {
      validate();
    }
  }, [touched, validateOnChange, validate]);

  const handleBlur = useCallback(() => {
    setTouched(true);
    validate();
  }, [validate]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setTouched(false);
    setError(null);
  }, [initialValue]);

  return {
    value,
    error,
    touched,
    isValid: error === null,
    handleChange,
    handleBlur,
    validate,
    reset,
  };
}
