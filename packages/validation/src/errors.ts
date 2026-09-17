import { type z } from 'zod';

/**
 * A single error model shared by every API module, so clients never have to
 * branch on which endpoint produced a failure.
 */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_TRANSITION'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: FieldError[];
    /** Correlates a client-visible error with the server log entry. */
    requestId?: string;
  };
}

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: FieldError[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = STATUS_BY_CODE[code];
  }

  static notFound(what = 'Resource'): ApiError {
    return new ApiError('NOT_FOUND', `${what} was not found.`);
  }

  static conflict(message: string): ApiError {
    return new ApiError('CONFLICT', message);
  }

  static validation(fields: FieldError[], message = 'Some fields need attention.'): ApiError {
    return new ApiError('VALIDATION_ERROR', message, fields);
  }

  toBody(requestId?: string): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields && this.fields.length > 0 ? { fields: this.fields } : {}),
        ...(requestId ? { requestId } : {}),
      },
    };
  }
}

/** Convert a Zod failure into the platform's field-error shape. */
export function zodToFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '_root',
    message: issue.message,
  }));
}

export function fromZodError(error: z.ZodError, message = 'Some fields need attention.'): ApiError {
  return ApiError.validation(zodToFieldErrors(error), message);
}
