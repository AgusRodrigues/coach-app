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
  const PUBLIC_PREFIXES = ['/login', '/auth', '/offline', '/icons', '/privacidad', '/terminos']
  const PUBLIC_FILES = ['/manifest.webmanifest', '/sw.js']
  const isPublicRoute =
    PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix)) || PUBLIC_FILES.includes(path)

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
    // Todas las rutas salvo archivos estaticos, imagenes y los archivos de la PWA
    // (manifiesto, service worker, pantalla sin conexion e iconos), que tienen que
    // ser publicos: el navegador los pide sin sesion.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
