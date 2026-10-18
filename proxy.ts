import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next.js 16+: este archivo se llama proxy.ts y la funcion proxy.
// Si tu version de Next.js es anterior a la 16, renombralo a middleware.ts
// y la funcion a "middleware".
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: no pongas codigo entre createServerClient y getClaims().
  // En el servidor usar siempre getClaims(), nunca getSession().
  const { data } = await supabase.auth.getClaims()
  const isLoggedIn = !!data?.claims

  const path = request.nextUrl.pathname
  const isPublicRoute = path.startsWith('/login') || path.startsWith('/auth')

  // Sin sesion y fuera de las rutas publicas: redirigir al login
  if (!isLoggedIn && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Todas las rutas salvo archivos estaticos e imagenes
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
