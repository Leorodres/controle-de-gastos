import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

/** Padroniza os erros da API no formato { error, message } (ou { error: 'validation', issues }). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const send = (status: number, body: object): void => {
      res.status(status).json(body);
    };

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // nossos próprios erros já vêm no formato certo (sem "statusCode")
      if (typeof body === 'object' && body !== null && 'error' in body && !('statusCode' in body)) {
        return send(status, body);
      }
      const raw = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      const message = Array.isArray(raw) ? raw.join('; ') : (raw ?? exception.message);
      return send(status, { error: status === 404 ? 'not_found' : status === 400 ? 'bad_request' : 'http_error', message });
    }

    const e = exception as { code?: string; status?: number; statusCode?: number; message?: string };
    // erros do Postgres
    if (e.code === '23503') return send(422, { error: 'invalid_reference', message: 'categoria ou pessoa informada não existe' });
    if (e.code === '23505') return send(409, { error: 'conflict', message: 'já existe um registro com esse nome' });
    if (e.code === '23514') return send(400, { error: 'constraint', message: 'valor viola uma regra do banco' });
    // erros "do cliente" vindos do Express (JSON malformado etc.)
    const status = e.statusCode ?? e.status;
    if (status && status >= 400 && status < 500) return send(status, { error: 'bad_request', message: e.message });

    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    send(500, { error: 'internal', message: 'erro interno' });
  }
}
