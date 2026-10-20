import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { AppConfig } from './config.js';
import type { Role, User } from './domain.js';
import { id, now } from './domain.js';
import type { Store } from './repository.js';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
      correlationId?: string;
    }
  }
}

export async function passwordHash(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function passwordMatches(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function publicUser(user: User): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

export function issueToken(user: User, config: AppConfig): string {
  return jwt.sign({ ...publicUser(user), sub: user.id }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'carbonproof-ai',
    audience: 'carbonproof-api',
  });
}

export function authenticate(config: AppConfig, store: Store) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const header = request.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      next();
      return;
    }
    try {
      const payload = jwt.verify(header.slice(7), config.JWT_SECRET, {
        issuer: 'carbonproof-ai',
        audience: 'carbonproof-api',
      });
      if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
        next();
        return;
      }
      const user = store.users.get(payload.sub);
      if (user?.status === 'ACTIVE') request.auth = publicUser(user);
    } catch {
      // Invalid tokens are treated as unauthenticated. Protected routes return 401.
    }
    next();
  };
}

export function requireAuth(...roles: Role[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.auth) {
      next(
        Object.assign(new Error('Authentication is required.'), {
          statusCode: 401,
          code: 'AUTH_REQUIRED',
        }),
      );
      return;
    }
    if (roles.length > 0 && !roles.includes(request.auth.role)) {
      next(
        Object.assign(new Error('You do not have permission for this action.'), {
          statusCode: 403,
          code: 'FORBIDDEN',
        }),
      );
      return;
    }
    next();
  };
}

export async function createUser(
  store: Store,
  input: { email: string; displayName: string; password: string; role?: Role },
): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if ([...store.users.values()].some((user) => user.email === email)) {
    throw Object.assign(new Error('A user with this email already exists.'), {
      statusCode: 409,
      code: 'USER_EXISTS',
    });
  }
  const timestamp = now();
  const user: User = {
    id: id(),
    email,
    displayName: input.displayName.trim(),
    passwordHash: await passwordHash(input.password),
    role: input.role ?? 'CONTRIBUTOR',
    status: 'ACTIVE',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.users.set(user.id, user);
  return user;
}
