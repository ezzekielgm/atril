package io.github.ezzekielgm.atril.reloj

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.itemsIndexed
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import kotlinx.coroutines.delay
import kotlin.math.abs

// Los mismos colores que el semáforo de Atril
val Verde = Color(0xFF2E7D32)
val VerdeClaro = Color(0xFF66BB6A)
val Ambar = Color(0xFFF5A524)
val Rojo = Color(0xFFE5484D)
val Azul = Color(0xFF3B82F6)
val Gris = Color(0xFFB0B7C3)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Para el aviso «en marcha» en la esfera
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        setContent { MaterialTheme { App() } }
    }
}

@Composable
fun App() {
    val ctx = LocalContext.current
    var planes by remember { mutableStateOf(Almacen.planes(ctx)) }
    var sesion by remember { mutableStateOf(Almacen.sesion(ctx)) }
    var editando by remember { mutableStateOf<Plan?>(null) }

    val guardar = { lista: List<Plan> -> planes = lista; Almacen.guardarPlanes(ctx, lista) }
    val actual = sesion
    val plan = editando

    when {
        plan != null -> {
            BackHandler { editando = null }
            Editor(
                plan = plan,
                esNuevo = planes.none { it.id == plan.id },
                onGuardar = { p ->
                    guardar(if (planes.any { it.id == p.id }) planes.map { if (it.id == p.id) p else it } else planes + p)
                    editando = null
                },
                onBorrar = { p -> guardar(planes.filter { it.id != p.id }); editando = null },
            )
        }
        actual != null -> Cronometro(
            s = actual,
            onCambio = { sesion = it },
            onEditar = { p -> Motor.terminar(ctx); sesion = null; editando = p },
            planDe = { s -> planes.firstOrNull { it.partes == s.partes } },
        )
        else -> Lista(
            planes = planes,
            onElegir = { p -> sesion = Motor.preparar(ctx, p) },
            onNuevo = {
                editando = Plan("p" + System.currentTimeMillis(), ponerNombres(listOf(Parte("", 60), Parte("", 180), Parte("", 60))))
            },
        )
    }
}

@Composable
fun Lista(planes: List<Plan>, onElegir: (Plan) -> Unit, onNuevo: () -> Unit) {
    val estado = rememberScalingLazyListState()
    ScalingLazyColumn(state = estado, modifier = Modifier.fillMaxSize().background(Color.Black)) {
        item { ListHeader { Text("Atril · discursos", color = Gris) } }
        itemsIndexed(planes) { _, p ->
            Chip(
                onClick = { onElegir(p) },
                label = { Text(duracion(p.totalSeg), fontWeight = FontWeight.Bold) },
                secondaryLabel = { Text(p.partes.joinToString(" · ") { duracion(it.seg) }, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                colors = ChipDefaults.primaryChipColors(backgroundColor = Color(0xFF1E3A8A)),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            CompactChip(
                onClick = onNuevo,
                label = { Text("Nuevo") },
                colors = ChipDefaults.secondaryChipColors(),
            )
        }
    }
}

@Composable
fun Cronometro(s: Sesion, onCambio: (Sesion?) -> Unit, onEditar: (Plan) -> Unit, planDe: (Sesion) -> Plan?) {
    val ctx = LocalContext.current
    var ahora by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(s) {
        while (true) {
            ahora = System.currentTimeMillis()
            delay(250)
        }
    }
    val total = s.totalSeg
    val seg = (s.transcurridoMs(ahora) / 1000).toInt()
    val queda = total - seg
    val k = parteActual(s.partes, seg)
    val quedaParte = finales(s.partes)[k] - seg
    val sinEmpezar = !s.enMarcha && seg == 0
    val color = when {
        queda < 0 -> Rojo
        queda <= maxOf(60, total / 10) -> Ambar
        else -> VerdeClaro
    }
    val estadoActual by rememberUpdatedState(s)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .pointerInput(Unit) {
                // En marcha, solo una pulsación larga pausa (un roce de la manga no hace nada)
                detectTapGestures(onLongPress = { if (estadoActual.enMarcha) onCambio(Motor.pausar(ctx, estadoActual)) })
            },
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(
            progress = if (total > 0) (seg.toFloat() / total).coerceIn(0f, 1f) else 0f,
            modifier = Modifier.fillMaxSize().padding(3.dp),
            indicatorColor = color,
            trackColor = Color(0x33FFFFFF),
            strokeWidth = 7.dp,
        )
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(horizontal = 26.dp)) {
            Text(
                if (queda < 0) "Te pasas" else "Parte ${k + 1} de ${s.partes.size}",
                color = Gris, fontSize = 13.sp,
            )
            Text(
                if (queda < 0) "Termina ya" else s.partes[k].nombre,
                color = Color.White, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            Text(
                (if (queda < 0) "+" else "") + mmss(queda),
                color = if (sinEmpezar) Color.White else color,
                fontSize = 46.sp, fontWeight = FontWeight.Bold,
            )
            when {
                sinEmpezar -> {
                    Text("${s.partes.size} partes", color = Gris, fontSize = 12.sp)
                    Spacer(Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        CompactChip(
                            onClick = { Motor.terminar(ctx); onCambio(null) },
                            label = { Text("Volver") },
                            colors = ChipDefaults.secondaryChipColors(),
                        )
                        Button(
                            onClick = { onCambio(Motor.empezar(ctx, s)) },
                            colors = ButtonDefaults.buttonColors(backgroundColor = Verde),
                            modifier = Modifier.size(52.dp),
                        ) { Text("▶", fontSize = 20.sp) }
                        CompactChip(
                            onClick = { planDe(s)?.let(onEditar) },
                            label = { Text("Editar") },
                            colors = ChipDefaults.secondaryChipColors(),
                        )
                    }
                }
                s.enMarcha -> {
                    Text(
                        if (queda < 0) "mantén pulsado para pausar" else "parte: ${mmss(quedaParte.coerceAtLeast(0))} · mantén para pausar",
                        color = Gris, fontSize = 11.sp, textAlign = TextAlign.Center,
                    )
                }
                else -> {
                    Text("En pausa", color = Ambar, fontSize = 12.sp)
                    Spacer(Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CompactChip(
                            onClick = { Motor.terminar(ctx); onCambio(null) },
                            label = { Text("Terminar") },
                            colors = ChipDefaults.secondaryChipColors(),
                        )
                        CompactChip(
                            onClick = { onCambio(Motor.empezar(ctx, s)) },
                            label = { Text("Seguir") },
                            colors = ChipDefaults.primaryChipColors(backgroundColor = Verde),
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun Editor(plan: Plan, esNuevo: Boolean, onGuardar: (Plan) -> Unit, onBorrar: (Plan) -> Unit) {
    var partes by remember { mutableStateOf(plan.partes) }
    var elegida by remember { mutableIntStateOf(-1) }

    if (elegida in partes.indices) {
        BackHandler { elegida = -1 }
        AjustarParte(
            parte = partes[elegida],
            puedeQuitar = partes.size > 1,
            onCambio = { seg -> partes = partes.mapIndexed { i, p -> if (i == elegida) p.copy(seg = seg) else p } },
            onQuitar = { partes = ponerNombres(partes.filterIndexed { i, _ -> i != elegida }); elegida = -1 },
            onListo = { elegida = -1 },
        )
        return
    }

    val estado = rememberScalingLazyListState()
    ScalingLazyColumn(state = estado, modifier = Modifier.fillMaxSize().background(Color.Black)) {
        item { ListHeader { Text("Total ${duracion(partes.sumOf { it.seg })}", color = Color.White) } }
        itemsIndexed(partes) { i, p ->
            Chip(
                onClick = { elegida = i },
                label = { Text(p.nombre) },
                secondaryLabel = { Text(duracion(p.seg)) },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            CompactChip(
                onClick = {
                    if (partes.size < 20) {
                        // La parte nueva va antes de la conclusión
                        val pos = if (partes.size >= 2) partes.size - 1 else partes.size
                        partes = ponerNombres(partes.toMutableList().apply { add(pos, Parte("", 180)) })
                    }
                },
                label = { Text("Añadir parte") },
                colors = ChipDefaults.secondaryChipColors(),
            )
        }
        item {
            Chip(
                onClick = { onGuardar(plan.copy(partes = partes)) },
                label = { Text("Guardar", fontWeight = FontWeight.Bold) },
                colors = ChipDefaults.primaryChipColors(backgroundColor = Color(0xFF1D4ED8)),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (!esNuevo) {
            item {
                CompactChip(
                    onClick = { onBorrar(plan) },
                    label = { Text("Borrar", color = Rojo) },
                    colors = ChipDefaults.secondaryChipColors(),
                )
            }
        }
    }
}

/** Los minutos de una parte: con el bisel (de 30 en 30 segundos) o con − y +. */
@Composable
fun AjustarParte(parte: Parte, puedeQuitar: Boolean, onCambio: (Int) -> Unit, onQuitar: () -> Unit, onListo: () -> Unit) {
    val foco = remember { FocusRequester() }
    var acumulado by remember { mutableFloatStateOf(0f) }
    val actual by rememberUpdatedState(parte)
    val cambiar = { paso: Int -> onCambio((actual.seg + paso).coerceIn(30, 3600)) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .onRotaryScrollEvent { e ->
                acumulado += e.verticalScrollPixels
                if (abs(acumulado) >= 24f) {
                    cambiar(if (acumulado > 0) 30 else -30)
                    acumulado = 0f
                }
                true
            }
            .focusRequester(foco)
            .focusable(),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(parte.nombre, color = Gris, fontSize = 14.sp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Button(onClick = { cambiar(-30) }, modifier = Modifier.size(40.dp), colors = ButtonDefaults.secondaryButtonColors()) { Text("−", fontSize = 20.sp) }
                Text(mmss(parte.seg), color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(96.dp), textAlign = TextAlign.Center)
                Button(onClick = { cambiar(30) }, modifier = Modifier.size(40.dp), colors = ButtonDefaults.secondaryButtonColors()) { Text("+", fontSize = 20.sp) }
            }
            Text("Gira el bisel para cambiarlo", color = Gris, fontSize = 11.sp)
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (puedeQuitar) {
                    CompactChip(onClick = onQuitar, label = { Text("Quitar", color = Rojo) }, colors = ChipDefaults.secondaryChipColors())
                }
                CompactChip(onClick = onListo, label = { Text("Listo") }, colors = ChipDefaults.primaryChipColors(backgroundColor = Azul))
            }
        }
    }
    LaunchedEffect(Unit) { foco.requestFocus() }
}
