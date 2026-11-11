# Clips de la época E — punto de control 1

Hechos = ya horneados y visibles en el visor. Propuestos = se harán en la segunda entrega.
Fase t ∈ [0,1); eventos [nombre t]. Mezcla entre clips: 0,22 s (configurable 0,15–0,3). Desfase aleatorio por instancia.

## A pie (esqueleto soldado) — hechos

También sirven en E los de A–D: idle, marcha, marcha_rapida, apuntar, rendirse, herido, ordenar, saludar, celebrar, caer_muerto_* (4), huir.

| Clip | s | Bucle | Eventos |
|---|---|---|---|
| disparar | 2.4 | sí | disparo 0.22, cerrojo_atras 0.4, cerrojo_adelante 0.56, apuntar 0.72 |
| recarga | 1 | sí | cerrojo_atras 0.2, cerrojo_adelante 0.6 |
| tumbarse | 1 | no | rodilla 0.4, cuerpo_a_tierra 0.9 |
| disparar_tumbado | 2.4 | sí | disparo 0.22, cerrojo_atras 0.4, cerrojo_adelante 0.56 |
| avance_agachado | 0.8 | sí | paso 0, paso 0.5 |
| lanzar_granada | 1.4 | no | lanzar 0.55 |
| cubrirse | 3 | sí |  |
| cuerpo_a_cuerpo_bayoneta | 1 | sí | golpe 0.45 |
| morir_1 | 1.3 | no | impacto 0, cuerpo_al_suelo 0.72 |
| morir_2 | 1.3 | no | impacto 0, cuerpo_al_suelo 0.75 |
| disparar_rafaga | 1.2 | sí | rafaga 0, disparo 0.07, disparo 0.21, disparo 0.35, casquillos 0.42 |
| srv_at_cargador | 3 | sí | cargar 0.15 |
| srv_at_apuntador | 3 | sí | punteria 0.38 |
| srv_at_jefe | 3 | sí | orden_de_fuego 0.44 |
| srv_E_cargador | 5 | sí | cargar 0.18 |
| srv_E_atacador | 5 | sí | limpiar 0.12, atacar 0.3 |
| srv_E_cierre | 5 | sí | fuego 0.55 |
| srv_E_apuntador | 5 | sí | punteria 0.46 |
| srv_E_municionero | 5 | sí | recoge_proyectil 0.45, entrega 0.92 |

## Camión / jeep / moto (esqueleto vehiculo) — hechos

| Clip | s | Bucle | Eventos |
|---|---|---|---|
| ralenti | 1 | sí |  |
| avanzar | 0.9 | sí |  |
| frenar | 0.8 | no | frenazo 0.3 |
| descargar_tropas | 2 | no | bajan 0.15, vacio 0.6 |
| cargar_tropas | 2 | no | suben 0.1, lleno 0.8 |
| destruido | 1.5 | no | explosion 0, humo 0.3 |
| volcado | 1.5 | no | explosion 0, vuelco 0.9 |

## Semioruga (esqueleto semioruga) — hechos

| Clip | s | Bucle | Eventos |
|---|---|---|---|
| ralenti | 1 | sí |  |
| avanzar | 1 | sí |  |
| frenar | 0.8 | no | frenazo 0.3 |
| disparar_ametralladora | 1.2 | sí | rafaga 0, rafaga 0.25, rafaga 0.5, rafaga 0.75 |
| descargar_tropas | 2 | no | bajan 0.15, vacio 0.6 |
| cargar_tropas | 2 | no | suben 0.1, lleno 0.8 |
| destruido | 1.5 | no | explosion 0, humo 0.3 |

## Tanque y cazacarros (esqueleto blindado) — hechos

| Clip | s | Bucle | Eventos |
|---|---|---|---|
| ralenti | 1 | sí |  |
| avanzar | 1.2 | sí |  |
| retroceder | 1.2 | sí |  |
| girar_sobre_el_eje | 1.2 | sí |  |
| girar_torreta | 6 | sí | motor_torreta 0.05 |
| disparar_canon | 3 | sí | disparo 0.31, fogonazo 0.33, humo 0.36, extraer_casquillo 0.7 |
| disparar_ametralladora | 0.6 | sí | rafaga 0, disparo 0.17, disparo 0.33, disparo 0.5, disparo 0.67, disparo 0.83 |
| inmovilizado | 4 | sí | humo_negro 0, humo_negro 0.5 |
| incendiado | 2 | sí | fuego 0, humo_negro 0.25, fuego 0.5, humo_negro 0.75 |
| destruido | 1.6 | no | explosion 0, incendio 0.25, carcasa_humeante 0.6 |
| comandante_asomado | 4 | sí | observa 0.3 |

## Artillería (esqueleto canon) — hechos

| Clip | s | Bucle | Eventos |
|---|---|---|---|
| servicio_at | 3 | sí | cargar 0.15, cierre 0.25, apuntar 0.35, fuego 0.45, retroceso 0.47, extraer_casquillo 0.6 |
| servicio_E | 5 | sí | cargar 0.15, atacar 0.3, cierre 0.4, fuego 0.55, retroceso 0.57, extraer_casquillo 0.75 |
| elevar_antiaereo | 2 | no | elevado 1 |
| en_bateria | 4 | sí |  |
| remolque | 1 | sí |  |
| enganchar | 1.2 | no | enganchado 1 |
| desenganchar | 1.2 | no | en_bateria 1 |
| pieza_destruida | 1.2 | no | explosion 0 |

## Propuestos para la segunda entrega

- A pie: cadaver (pose fija), caer_herido (transición a herido), bajar_del_vehiculo (1,0 s, eventos pie_en_tierra), subir_al_vehiculo (1,2 s), observar_con_prismaticos (4 s), hablar_por_radio (4 s, evento mensaje), marcha con arma al hombro para ametrallador.
- Ametralladora: montar (1,5 s, evento listo), cambiar_cinta / cambiar_cargador (3 s, evento cinta), atascarse (2 s, eventos atasco y desatasco), disparar_rafaga de la pesada con 2 servidores (trípode, evento disparo cada 0,08 s, cinta que avanza).
- Caballería E: paso, trote, galope, carga_sable, desmontar, caballo_caido (se reutiliza el esqueleto jinete con carabina y sin lanza).
- Artillería: servicio del antiaéreo con giro de la plataforma, enganchar y desenganchar al tractor, pieza_destruida E.
- Vehículos: girar_sobre_el_eje con orugas en sentidos opuestos (ya en el shader), descargar_tropas sincronizado con bajar_del_vehiculo de cada soldado, lanzacohetes (salva de 16 cohetes, evento por cohete).
