import type { FastifyError, FastifyInstance, FastifyTypeProvider } from 'fastify';
import type { z } from 'zod';
import type { ApiError, ErrorCode } from '@team-impact/contracts';

/**
 * Routes declare contract schemas directly: `schema: { params, querystring, body, response }`.
 * Handlers then see the parsed request types and must return the response schema's input type.
 */
export interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this['schema'] extends z.ZodType ? z.output<this['schema']> : unknown;
  serializer: this['schema'] extends z.ZodType ? z.input<this['schema']> : unknown;
}

type Issues = NonNullable<ApiError['error']['issues']>;

/** Fastify only recognises `Error` instances from a custom validator, and ZodError isn't one. */
class RequestValidationError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super('Request validation failed');
  }
}

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'bad_request',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  429: 'rate_limited',
};

const apiError = (code: ErrorCode, message: string, issues?: Issues): ApiError => ({
  error: { code, message, issues },
});

/**
 * Validates requests and serializes responses with the shared Zod contracts. Request parts are
 * replaced with their parsed values, so defaults and transforms apply. Responses are parsed too,
 * which drops any field the response schema doesn't list: a handler can't leak a column by accident.
 */
export const useZodContracts = (app: FastifyInstance) => {
  app.setValidatorCompiler<z.ZodType>(({ schema }) => (data) => {
    const result = schema.safeParse(data);
    return result.success
      ? { value: result.data }
      : { error: new RequestValidationError(result.error.issues) };
  });

  app.setSerializerCompiler<z.ZodType>(
    ({ schema }) =>
      (data) =>
        JSON.stringify(schema.parse(data)),
  );

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof RequestValidationError) {
      const part = error.validationContext ?? 'request';
      const issues = error.issues.map((issue) => ({
        path: [part, ...issue.path.map((key) => (typeof key === 'symbol' ? String(key) : key))],
        message: issue.message,
      }));
      return reply.status(400).send(apiError('validation_error', error.message, issues));
    }

    const status = error.statusCode ?? 500;
    if (status < 500) {
      return reply
        .status(status)
        .send(apiError(CODE_BY_STATUS[status] ?? 'bad_request', error.message));
    }

    request.log.error(error);
    return reply.status(500).send(apiError('internal_error', 'Something went wrong'));
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send(apiError('not_found', `No route for ${request.method} ${request.url}`)),
  );

  return app.withTypeProvider<ZodTypeProvider>();
};
