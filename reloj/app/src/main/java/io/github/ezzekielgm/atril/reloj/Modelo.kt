package io.github.ezzekielgm.atril.reloj

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Una parte del discurso: su nombre y cuántos segundos tiene. */
data class Parte(val nombre: String, val seg: Int)

/** Un plan: las partes de un tipo de discurso (p. ej. 10 minutos: introducción, 3 puntos y conclusión). */
data class Plan(val id: String, val partes: List<Parte>) {
    val totalSeg: Int get() = partes.sumOf { it.seg }
}

/**
 * El discurso que se está dando. `inicio` es la hora (ms) a la que habría empezado si no se hubiera
 * pausado nunca; `pausadoEn` es cuándo se pausó (0 = en marcha). Sin empezar: pausadoEn == inicio.
 */
data class Sesion(val partes: List<Parte>, val inicio: Long, val pausadoEn: Long) {
    val enMarcha: Boolean get() = pausadoEn == 0L
    val totalSeg: Int get() = partes.sumOf { it.seg }
    fun transcurridoMs(ahora: Long): Long = (if (enMarcha) ahora else pausadoEn) - inicio
}

/** «10 min» o «2:30». */
fun duracion(seg: Int): String = if (seg % 60 == 0) "${seg / 60} min" else mmss(seg)

/** «4:05». */
fun mmss(seg: Int): String {
    val s = kotlin.math.abs(seg)
    return "%d:%02d".format(s / 60, s % 60)
}

/** Final de cada parte, en segundos desde el principio. */
fun finales(partes: List<Parte>): IntArray {
    var acum = 0
    return IntArray(partes.size) { i -> acum += partes[i].seg; acum }
}

/** La parte en la que se va a los `seg` segundos (la última si ya se ha pasado). */
fun parteActual(partes: List<Parte>, seg: Int): Int {
    val f = finales(partes)
    for (i in f.indices) if (seg < f[i]) return i
    return partes.size - 1
}

/** Nombres según el sitio: Introducción, Punto 1, Punto 2…, Conclusión. */
fun ponerNombres(partes: List<Parte>): List<Parte> = partes.mapIndexed { i, p ->
    val nombre = when {
        partes.size == 1 -> "Discurso"
        i == 0 -> "Introducción"
        i == partes.size - 1 -> "Conclusión"
        partes.size == 3 -> "Desarrollo"
        else -> "Punto $i"
    }
    p.copy(nombre = nombre)
}

/** Planes y discurso en marcha, guardados en el reloj. */
object Almacen {
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("atril", Context.MODE_PRIVATE)

    private val DE_SERIE = listOf(
        Plan("p5", ponerNombres(listOf(Parte("", 60), Parte("", 180), Parte("", 60)))),
        Plan("p10", ponerNombres(listOf(Parte("", 60), Parte("", 180), Parte("", 180), Parte("", 120), Parte("", 60)))),
        Plan("p30", ponerNombres(listOf(Parte("", 180), Parte("", 480), Parte("", 480), Parte("", 480), Parte("", 180)))),
    )

    private fun partesAJson(partes: List<Parte>) = JSONArray().apply {
        partes.forEach { put(JSONObject().put("n", it.nombre).put("s", it.seg)) }
    }

    private fun partesDeJson(a: JSONArray) = List(a.length()) { i ->
        val o = a.getJSONObject(i)
        Parte(o.optString("n"), o.optInt("s", 60).coerceIn(30, 3600))
    }

    fun planes(ctx: Context): List<Plan> {
        val txt = prefs(ctx).getString("planes", null) ?: return DE_SERIE
        return try {
            val a = JSONArray(txt)
            List(a.length()) { i ->
                val o = a.getJSONObject(i)
                Plan(o.getString("id"), partesDeJson(o.getJSONArray("partes")))
            }.filter { it.partes.isNotEmpty() }
        } catch (e: Exception) {
            DE_SERIE
        }
    }

    fun guardarPlanes(ctx: Context, planes: List<Plan>) {
        val a = JSONArray()
        planes.forEach { a.put(JSONObject().put("id", it.id).put("partes", partesAJson(it.partes))) }
        prefs(ctx).edit().putString("planes", a.toString()).apply()
    }

    fun sesion(ctx: Context): Sesion? {
        val txt = prefs(ctx).getString("sesion", null) ?: return null
        return try {
            val o = JSONObject(txt)
            Sesion(partesDeJson(o.getJSONArray("partes")), o.getLong("inicio"), o.getLong("pausado"))
        } catch (e: Exception) {
            null
        }
    }

    fun guardarSesion(ctx: Context, s: Sesion?) {
        val e = prefs(ctx).edit()
        if (s == null) e.remove("sesion")
        else e.putString("sesion", JSONObject().put("partes", partesAJson(s.partes)).put("inicio", s.inicio).put("pausado", s.pausadoEn).toString())
        e.commit()
    }
}
