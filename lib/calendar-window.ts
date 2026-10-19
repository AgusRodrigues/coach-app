// Cuantos meses se cargan del calendario a cada lado del mes que estas mirando.
//
//   1  ->  3 meses en total (el mes, el anterior y el siguiente)
//   2  ->  5 meses
//   3  ->  7 meses
//
// Mas meses = mas cosas que se pueden ver al instante, pero tambien mas datos en cada carga.
// Este unico valor lo usan la pagina del servidor (que meses pedir) y el calendario del
// telefono (hasta donde alcanza lo cargado), asi que siempre coinciden.
//
// Ojo: Supabase devuelve como maximo 1000 filas por consulta. Con valores altos y muchos
// eventos repetidos, el calendario podria quedar cortado sin avisar.
export const MONTHS_AROUND = 1
