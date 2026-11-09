package io.github.ezzekielgm.atril.reloj

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.wear.ongoing.OngoingActivity

/** Qué toca avisar y cómo vibra cada aviso. */
enum class Aviso(val patron: LongArray) {
    EMPIEZA(longArrayOf(0, 80)),
    PARTE(longArrayOf(0, 180, 140, 180)),                 // dos toques: pasa a la parte siguiente
    MINUTO(longArrayOf(0, 120, 100, 120, 100, 120)),      // tres toques cortos: queda un minuto
    FIN(longArrayOf(0, 900)),                             // uno largo: se acabó el tiempo
    PASADO(longArrayOf(0, 500, 200, 500)),                // dos largos: cada minuto que te pasas (3 veces)
}

/** Un aviso a una hora: `parte` es la parte que empieza (en PARTE). */
data class Momento(val hora: Long, val aviso: Aviso, val parte: Int = -1)

object Avisos {
    const val CANAL = "en_marcha"
    const val NOTIFICACION = 1

    /** Todos los avisos del discurso, en orden. */
    fun momentos(s: Sesion): List<Momento> {
        val res = mutableListOf<Momento>()
        val f = finales(s.partes)
        val total = s.totalSeg
        for (i in 0 until f.size - 1) res += Momento(s.inicio + f[i] * 1000L, Aviso.PARTE, i + 1)
        // «Queda un minuto», salvo que coincida con el paso a la última parte (ya avisa ese)
        val minuto = s.inicio + (total - 60) * 1000L
        if (total > 90 && res.none { kotlin.math.abs(it.hora - minuto) < 5000 }) res += Momento(minuto, Aviso.MINUTO)
        res += Momento(s.inicio + total * 1000L, Aviso.FIN)
        for (k in 1..3) res += Momento(s.inicio + (total + 60 * k) * 1000L, Aviso.PASADO)
        return res.sortedBy { it.hora }
    }

    fun vibrar(ctx: Context, aviso: Aviso) {
        val v: Vibrator? = if (Build.VERSION.SDK_INT >= 31) {
            ctx.getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            ctx.getSystemService(Vibrator::class.java)
        }
        if (v == null || !v.hasVibrator()) return
        val efecto = VibrationEffect.createWaveform(aviso.patron, -1)
        // Como una alarma, para que vibre aunque el reloj esté en «No molestar» o en modo cine
        if (Build.VERSION.SDK_INT >= 33) {
            v.vibrate(efecto, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM))
        } else {
            @Suppress("DEPRECATION")
            v.vibrate(efecto, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
        }
    }

    private fun crearCanal(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(CANAL) == null) {
            val c = NotificationChannel(CANAL, "Discurso en marcha", NotificationManager.IMPORTANCE_LOW)
            c.enableVibration(false)
            c.setSound(null, null)
            nm.createNotificationChannel(c)
        }
    }

    /** El aviso «en marcha» (y su icono en la esfera), con lo que queda y la parte en la que vas. */
    fun notificacion(ctx: Context, s: Sesion, parte: Int): android.app.Notification {
        crearCanal(ctx)
        val abrir = PendingIntent.getActivity(
            ctx, 0,
            Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val p = parte.coerceIn(0, s.partes.size - 1)
        val b = NotificationCompat.Builder(ctx, CANAL)
            .setSmallIcon(R.drawable.ic_reloj)
            .setContentTitle("Discurso en marcha")
            .setContentText("Parte ${p + 1} de ${s.partes.size} · ${s.partes[p].nombre}")
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setContentIntent(abrir)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setWhen(s.inicio + s.totalSeg * 1000L)
        OngoingActivity.Builder(ctx, NOTIFICACION, b)
            .setStaticIcon(R.drawable.ic_reloj)
            .setTouchIntent(abrir)
            .build()
            .apply(ctx)
        return b.build()
    }

    fun arrancarServicio(ctx: Context) {
        ContextCompat.startForegroundService(ctx, Intent(ctx, DiscursoService::class.java))
    }

    fun pararServicio(ctx: Context) {
        ctx.stopService(Intent(ctx, DiscursoService::class.java))
    }
}

/** Empezar, pausar, seguir y terminar el discurso (guarda la sesión y arranca o para los avisos). */
object Motor {
    fun preparar(ctx: Context, plan: Plan): Sesion {
        val ahora = System.currentTimeMillis()
        val s = Sesion(plan.partes, ahora, ahora)
        Almacen.guardarSesion(ctx, s)
        return s
    }

    fun empezar(ctx: Context, s: Sesion): Sesion {
        val ahora = System.currentTimeMillis()
        val nueva = s.copy(inicio = s.inicio + (ahora - s.pausadoEn), pausadoEn = 0L)
        Almacen.guardarSesion(ctx, nueva)
        Avisos.vibrar(ctx, Aviso.EMPIEZA)
        Avisos.arrancarServicio(ctx)
        return nueva
    }

    fun pausar(ctx: Context, s: Sesion): Sesion {
        val nueva = s.copy(pausadoEn = System.currentTimeMillis())
        Almacen.guardarSesion(ctx, nueva)
        Avisos.pararServicio(ctx)
        return nueva
    }

    fun terminar(ctx: Context) {
        Almacen.guardarSesion(ctx, null)
        Avisos.pararServicio(ctx)
    }
}
