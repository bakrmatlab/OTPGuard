import { webAccountConfigured } from './account-config';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
const middleware = clerkMiddleware();
export default function proxy(...args: Parameters<typeof middleware>) {
  return webAccountConfigured() ? middleware(...args) : NextResponse.next();
}
export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js|png|jpg|ico)).*)'],
};
