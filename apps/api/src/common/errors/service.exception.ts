export class ServiceException extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly code = 'SERVICE_ERROR'
  ) {
    super(message);
  }
}

export class NotFoundServiceException extends ServiceException {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationServiceException extends ServiceException {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class ConflictServiceException extends ServiceException {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class UnauthorizedServiceException extends ServiceException {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
  }
}
