// Medicion de tiempos, para encontrar donde se va la demora.
//
// No hace nada salvo que la variable de entorno DEBUG_TIMING valga "1".
// Cuando esta activa, los tiempos aparecen en los registros (Logs) de Vercel como:
//   [timing] calendario: 3 consultas: 84 ms
//
// Uso:  const res = await timed('etiqueta', supabase.from('tabla').select('*'))
const ENABLED = process.env.DEBUG_TIMING === '1'

export async function timed<T>(label: string, work: PromiseLike<T>): Promise<T> {
  if (!ENABLED) return work

  const start = performance.now()
  try {
    return await work
  } finally {
    console.log(`[timing] ${label}: ${Math.round(performance.now() - start)} ms`)
  }
}
