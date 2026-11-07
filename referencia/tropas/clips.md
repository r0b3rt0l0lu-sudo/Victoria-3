# Clips de animación

Fase t ∈ [0,1). Bucles horneados a 16 fps y clips sin bucle a 24 fps (máx. 96 fotogramas). Eventos: [t, nombre].

## Esqueleto «soldado» (12 partes)

| Clip | Duración (s) | Bucle | Eventos |
|---|---|---|---|
| idle | 3.4 | sí |  |
| idle_oficial | 3.4 | sí |  |
| marcha | 1 | sí | paso 0, paso 0.5 |
| apuntar | 0.5 | no |  |
| disparar_A | 9 | sí | disparo 0.1, morder_cartucho 0.27, cebar 0.31, polvora 0.44, baqueta 0.58, baqueta_fuera 0.72, al_hombro 0.84, apuntar 0.92 |
| disparar_B | 4.5 | sí | disparo 0.1, abrir_cierre 0.3, cartucho 0.4, cerrar_cierre 0.52, apuntar 0.75 |
| disparar_D | 2.4 | sí | disparo 0.22, cerrojo_atras 0.4, cerrojo_adelante 0.56, apuntar 0.72 |
| cargar_bayoneta | 0.62 | sí | paso 0, paso 0.5, grito 0 |
| formar | 1.6 | no | alto 0.62, descansen_armas 0.85 |
| melee_1 | 1.1 | sí | golpe 0.5 |
| melee_2 | 1 | sí | golpe 0.45 |
| cuadro | 3 | sí |  |
| ponerse_a_cubierto | 3 | sí |  |
| asomarse | 1.2 | no | asomado 0.7 |
| herido | 3 | sí | quejido 0 |
| caer_muerto_atras | 1.3 | no | impacto 0, cuerpo_al_suelo 0.72 |
| caer_muerto_adelante | 1.3 | no | impacto 0, cuerpo_al_suelo 0.75 |
| caer_muerto_rodillas | 1.8 | no | impacto 0, de_rodillas 0.4, cuerpo_al_suelo 0.9 |
| caer_muerto_costado | 1.2 | no | impacto 0, cuerpo_al_suelo 0.75 |
| tirar_arma | 0.7 | no | arma_tirada 0.4 |
| huir | 0.6 | sí | paso 0, paso 0.5 |
| rendirse | 2 | sí |  |
| marcha_atado | 1.25 | sí | paso 0, paso 0.5 |
| saludar | 2.4 | sí | presenten_armas 0.2 |
| saludar_espada | 2.4 | sí | saludo 0.2 |
| celebrar | 1 | sí | hurra 0.3 |
| ordenar | 2.2 | sí | orden 0.2 |
| observar_catalejo | 4 | sí | observa 0.15 |
| ondear | 2.8 | sí |  |
| caer_con_estandarte | 1.6 | no | impacto 0, estandarte_al_suelo 0.75 |
| recoger_estandarte | 1.6 | no | recoge 0.4, enarbola 0.95 |
| cavar | 1.6 | sí | palada 0.3, lanza_tierra 0.8 |
| camilla_delante | 1.1 | sí | paso 0, paso 0.5 |
| camilla_detras | 1.1 | sí | paso 0, paso 0.5 |
| srv_escobillon | 6 | sí | limpiar 0.14, atacar 0.34 |
| srv_cargador | 6 | sí | cargar 0.2 |
| srv_apuntador | 6 | sí | punteria 0.52 |
| srv_artillero | 6 | sí | fuego 0.62 |
| srv_jefe | 6 | sí | orden_de_fuego 0.6 |
| srv_mg_tirador | 0.5 | sí | rafaga 0, rafaga 0.5 |
| srv_mg_municion | 2 | sí | cinta 0.5 |
| marcha_rapida | 0.7 | sí | paso 0, paso 0.5 |
| recargar_A | 5.8 | sí | morder_cartucho 0.10937500000000003, cebar 0.171875, polvora 0.37500000000000006, baqueta 0.59375, baqueta_fuera 0.8125000000000001 |
| recargar_D | 1 | sí | cerrojo_atras 0.20000000000000007, cerrojo_adelante 0.6000000000000002 |
| disparar_rodilla_A | 9 | sí | disparo 0.1, morder_cartucho 0.27, cebar 0.31, polvora 0.44, baqueta 0.58, baqueta_fuera 0.72, al_hombro 0.84, apuntar 0.92 |
| disparar_rodilla_B | 4.5 | sí | disparo 0.1, abrir_cierre 0.3, cartucho 0.4, cerrar_cierre 0.52, apuntar 0.75 |
| disparar_rodilla | 2.4 | sí | disparo 0.22, cerrojo_atras 0.4, cerrojo_adelante 0.56, apuntar 0.72 |
| agacharse | 3 | sí |  |
| disparo_desde_parapeto | 2.4 | sí | disparo 0.22, cerrojo_atras 0.4, cerrojo_adelante 0.56, apuntar 0.72 |
| manos_arriba | 2 | sí |  |
| srv_caido | 1.2 | no | impacto 0, cuerpo_al_suelo 0.75 |

## Esqueleto «jinete» (18 partes)

| Clip | Duración (s) | Bucle | Eventos |
|---|---|---|---|
| idle | 4 | sí |  |
| paso | 1.2 | sí | casco 0, casco 0.25, casco 0.5, casco 0.75 |
| trote | 0.7 | sí | casco 0, casco 0.5 |
| galope | 0.55 | sí | casco 0, casco 0.3, casco 0.6 |
| frenar | 0.9 | no | frenazo 0.4 |
| encabritado | 1.8 | no | relincho 0.3 |
| caballo_caido | 1.6 | no | impacto 0, al_suelo 0.7 |
| entregar_orden | 2.5 | sí | entrega 0.5 |
| observar_catalejo | 4 | sí | observa 0.15 |
| carga | 0.55 | sí | casco 0, casco 0.3, casco 0.6, grito 0 |
| carga_lanza | 0.55 | sí | casco 0, casco 0.3, casco 0.6, grito 0 |
| galope_largo | 0.62 | sí | casco 0, casco 0.3, casco 0.6 |
| galope_de_mando | 0.55 | sí | casco 0, casco 0.3, casco 0.6, orden 0.3 |
| huida | 0.55 | sí | casco 0, casco 0.3, casco 0.6 |
| caida_del_general | 1.6 | no | impacto 0, al_suelo 0.7 |
| abatido | 1.6 | no | impacto 0, al_suelo 0.7 |

## Esqueleto «canon» (4 partes)

| Clip | Duración (s) | Bucle | Eventos |
|---|---|---|---|
| en_bateria | 4 | sí |  |
| servicio | 6 | sí | fuego 0.62, retroceso 0.66, volver_a_posicion 0.85 |
| servicio_rc | 6 | sí | fuego 0.62, retroceso 0.64 |
| remolque | 1 | sí |  |
| enganchar | 1.2 | no | enganchado 1 |
| desenganchar | 1.2 | no | en_bateria 1 |
| fuego_mg | 0.5 | sí | disparo 0, disparo 0.25, disparo 0.5, disparo 0.75 |
| pieza_destruida | 1.2 | no | explosion 0 |
| servicio_D | 6 | sí | fuego 0.62, retroceso 0.64 |

## Esqueleto «tanque» (5 partes)

| Clip | Duración (s) | Bucle | Eventos |
|---|---|---|---|
| avanzar | 1.2 | sí |  |
| girar_torreta | 6 | sí |  |
| disparar | 3 | sí | disparo 0.31 |
| inmovilizado | 4 | sí | humo 0, humo 0.5 |
| destruido | 1.5 | no | explosion 0, incendio 0.3 |

## Esqueleto «markI» (8 partes)

| Clip | Duración (s) | Bucle | Eventos |
|---|---|---|---|
| avanzar | 2 | sí |  |
| disparar | 4 | sí | disparo_izquierda 0.31, disparo_derecha 0.63 |
| inmovilizado | 4 | sí | humo 0, humo 0.5 |
| destruido | 1.5 | no | explosion 0, incendio 0.3 |

## Esqueleto «tiro» (17 partes)

| Clip | Duración (s) | Bucle | Eventos |
|---|---|---|---|
| parado | 4 | sí |  |
| paso | 1.2 | sí | casco 0, casco 0.5 |
| trote | 0.7 | sí | casco 0, casco 0.5 |

## Esqueleto «estatico» (1 partes)

| Clip | Duración (s) | Bucle | Eventos |
|---|---|---|---|
| reposo | 1 | sí |  |

