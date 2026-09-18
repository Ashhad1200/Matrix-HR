import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

/**
 * Every failure leaves the API in one shape — { statusCode, message, error, requestId } — and internals
 * never reach the client: no stack traces, no Prisma messages (table/column names, query fragments).
 * Unexpected errors are logged in full server-side under the same requestId the client is given, so a
 * user can quote it and an engineer can find the stack.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: any, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const requestId: string | undefined = req?.requestId;

    let status = 500;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const b = body as Record<string, any>;
        message = b.message ?? exception.message;
        error = b.error ?? error;
      }
      // Nest surfaces the body parser's raw JSON.parse text ("Unexpected token } in JSON at position 9").
      if (status === 400 && typeof message === 'string' && /JSON/.test(message)) message = 'Malformed request body';
    } else if (exception?.name === 'PrismaClientKnownRequestError') {
      switch (exception.code) {
        case 'P2002': status = 409; message = 'A record with those details already exists'; error = 'Conflict'; break;
        case 'P2025': status = 404; message = 'Record not found'; error = 'Not Found'; break;
        case 'P2003': status = 400; message = 'A referenced record does not exist'; error = 'Bad Request'; break;
        case 'P2000': case 'P2006': case 'P2011': case 'P2012': status = 400; message = 'A value is missing or invalid'; error = 'Bad Request'; break;
        default: break;
      }
    } else if (exception?.name === 'PrismaClientValidationError') {
      status = 400;
      message = 'Invalid request';
      error = 'Bad Request';
    } else if (exception?.type === 'entity.too.large') {
      status = 413;
      message = 'Request body is too large';
      error = 'Payload Too Large';
    } else if (exception?.type === 'entity.parse.failed') {
      status = 400;
      message = 'Malformed request body';
      error = 'Bad Request';
    }

    if (status >= 500) {
      this.logger.error(
        JSON.stringify({ requestId, method: req?.method, path: req?.originalUrl?.split('?')[0], status, error: exception?.message }),
        exception?.stack,
      );
    }

    res.status(status).json({ statusCode: status, message, error, ...(requestId ? { requestId } : {}) });
  }
}
