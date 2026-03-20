import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // We only want to protect the /admin route (and sub-routes)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    
    // Check if the user has the admin cookie
    const hasAdminAccess = request.cookies.get('admin_access')?.value === 'true';

    // If they are not accessing the login page and don't have access, redirect to login
    if (!hasAdminAccess && request.nextUrl.pathname !== '/admin/login') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // If they have access and are trying to hit login, redirect to admin
    if (hasAdminAccess && request.nextUrl.pathname === '/admin/login') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
