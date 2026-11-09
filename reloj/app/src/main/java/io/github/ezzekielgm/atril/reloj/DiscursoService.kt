package io.github.ezzekielgm.atril.reloj

import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.ServiceCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Mientras se da el discurso: mantiene el reloj despierto (sin encender la pantalla) y vibra en cada
 * aviso a su hora exacta, aunque se salga de la app o se apague la pantalla. Si el sistema lo cierra,
 * vuelve a arrancar y sigue con la sesión guardada.
 */
class DiscursoService : Service() {
    private val alcance = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var trabajo: Job? = null
    private var despierto: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val s = Almacen.sesion(this)
        if (s == null || !s.enMarcha) {
            stopSelf()
            return START_NOT_STICKY
        }
        val seg = ((System.currentTimeMillis() - s.inicio) / 1000).toInt()
        ServiceCompat.startForeground(
            this, Avisos.NOTIFICACION, Avisos.notificacion(this, s, parteActual(s.partes, seg)),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
        )
        // Despierto hasta 4 minutos después del final (los avisos de «te pasas»)
        val hasta = s.inicio + (s.totalSeg + 240) * 1000L - System.currentTimeMillis()
        despierto?.let { if (it.isHeld) it.release() }
        despierto = getSystemService(PowerManager::class.java)
            ?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "atril:discurso")
            ?.apply { acquire(hasta.coerceIn(60_000L, 4 * 3600_000L)) }
        trabajo?.cancel()
        trabajo = alcance.launch { avisar(s) }
        return START_STICKY
    }

    private suspend fun avisar(s: Sesion) {
        for (m in Avisos.momentos(s)) {
            // Los que ya pasaron hace rato no se repiten (p. ej. si el sistema reinició el servicio)
            if (m.hora < System.currentTimeMillis() - 3000) continue
            while (true) {
                val falta = m.hora - System.currentTimeMillis()
                if (falta <= 0) break
                delay(minOf(falta, 30_000L))
            }
            Avisos.vibrar(this, m.aviso)
            if (m.aviso == Aviso.PARTE) {
                getSystemService(NotificationManager::class.java)
                    ?.notify(Avisos.NOTIFICACION, Avisos.notificacion(this, s, m.parte))
            }
        }
        stopSelf()
    }

    override fun onDestroy() {
        trabajo?.cancel()
        alcance.cancel()
        despierto?.let { if (it.isHeld) it.release() }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }
}
