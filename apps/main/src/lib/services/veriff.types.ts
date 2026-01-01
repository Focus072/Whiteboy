/**
 * Veriff API Types
 */

export interface VeriffVerificationRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  address?: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface VeriffVerificationResponse {
  status: 'PASS' | 'FAIL';
  referenceId: string;
  reasonCode?: string;
  message?: string;
}

export interface VeriffError {
  code: string;
  message: string;
}

export interface VeriffSessionResponse {
  id: string;
  status: string;
}

export interface VeriffDecisionResponse {
  status: string;
  code: number;
  decision?: {
    status: string;
    person?: {
      dateOfBirth?: string;
      age?: number;
    };
  };
  verification?: {
    id: string;
    code: number;
    status: string;
  };
}

