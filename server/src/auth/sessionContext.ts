import { ApiError } from "../core/errors";
import { createRequestContextFromAuthenticatedUser, type RequestContext } from "../core/requestContext";
import type { AuthRepository, TokenHasher } from "./authContracts";

export type ResolveSessionContextInput = {
  requestId: string;
  authorizationHeader?: string;
};

export type SessionContextResolver = {
  resolve(input: ResolveSessionContextInput): Promise<RequestContext>;
};

function extractBearerToken(authorizationHeader?: string): string {
  if (!authorizationHeader) {
    throw new ApiError("AUTH_REQUIRED", 401, "Authorization bearer token is required.");
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
  if (scheme !== "Bearer" || !token) {
    throw new ApiError("AUTH_REQUIRED", 401, "Authorization header must use Bearer token format.");
  }

  return token;
}

export function createSessionContextResolver(repository: AuthRepository, tokenHasher: TokenHasher): SessionContextResolver {
  return {
    async resolve(input) {
      const token = extractBearerToken(input.authorizationHeader);
      const tokenHash = await tokenHasher.hashToken(token);
      const resolved = await repository.findSessionByTokenHash(tokenHash);

      if (!resolved || resolved.session.status !== "active") {
        throw new ApiError("AUTH_REQUIRED", 401, "Session is invalid or expired.");
      }

      if (new Date(resolved.session.expiresAt).getTime() <= Date.now()) {
        throw new ApiError("AUTH_REQUIRED", 401, "Session is invalid or expired.");
      }

      return createRequestContextFromAuthenticatedUser(input.requestId, resolved.user, resolved.tenant.companyName);
    },
  };
}
