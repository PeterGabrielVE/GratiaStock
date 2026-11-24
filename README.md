# ✝️ GratiaStock — Control de Inventario, Pagos e Inversiones Católicas

Aplicación móvil y multiplataforma construida con **React Native + Expo (SDK 58) + Expo Router + SQLite + TypeScript** diseñada especialmente para librerías parroquiales, tiendas de artículos religiosos, grupos de apostolado y distribuidores de productos católicos.

## ✨ Funcionalidades Principales

1. **Control de Stock Católico y Kardex (`Stock`)**
   - Catálogo especializado por categorías: *Biblias Católicas* (Latinoamericana, Jerusalén, Navarra, Joven/Dios Habla Hoy), *Camándulas y Rosarios*, *Libros y Devocionarios*, *Imágenes y Crucifijos*, *Medallas y Escapularios* y *Velones y Liturgia*.
   - Registro de SKU, edición/material (ej. *Letra Grande Tapa Dura*, *Madera de Olivo*), ubicación/estante, proveedor, precio costo, precio venta, margen automático y alerta de **Stock Mínimo**.
   - **Ajustes rápidos de inventario** (+ Entrada / - Salida) con trazabilidad completa en el **Historial Kardex**.

2. **Ventas, Pagos, Abonos y Cuentas por Cobrar (`Pagos`)**
   - Carrito multi-producto con validación de existencias y descuentos.
   - Soporte tanto para **Ventas de Contado** como **Ventas por Abonos / Apartados / Crédito** con plazo de vencimiento.
   - Registro de múltiples abonos parciales por venta (`Efectivo`, `Transferencia`, `Pago Móvil`, `Tarjeta`, `Divisas / Zelle`), cálculo automático de saldo restante y generación de comprobante/estado de cuenta listo para pegar en WhatsApp.
   - Anulación de ventas con reintegro automático de unidades al inventario.

3. **Inversiones y Compras de Mercancía (`Inversión`)**
   - Control de capital invertido en compra de lotes, mobiliario/vitrinas, fletes o ferias parroquiales.
   - Opción de **sumar automáticamente unidades al stock** de un producto al registrar una compra de mercancía.
   - Seguimiento de saldos pendientes por pagar a proveedores/editoriales y porcentaje de recuperación de capital.

4. **Directorio de Proveedores y Editoriales (`Proveed.`)**
   - Ficha completa con contacto, ciudad, especialidad, condiciones comerciales y métricas automáticas (productos vinculados, total comprado y saldo pendiente).
   - Botones directos para abrir **WhatsApp**, **Llamada telefónica** o **Correo electrónico**.

5. **Datos, Estadísticas, Exportación CSV/JSON y Opciones (`Datos/Exp`)**
   - Analítica por período (`7 días`, `30 días`, `Todo`): Ventas facturadas, utilidad bruta estimada, efectivo cobrado, patrimonio en inventario, Top productos más vendidos, ventas por categoría e ingresos por método de pago.
   - **Exportación a CSV (UTF-8 con BOM para Excel / Google Sheets)**:
     - Catálogo e Inventario Valorizado
     - Ventas y Cuentas por Cobrar
     - Historial de Pagos y Abonos
     - Inversiones y Compras
     - Directorio de Proveedores
     - Kardex de Movimientos
   - **Respaldo Completo en JSON**: Exportación e importación/restauración completa desde el dispositivo.
   - **Opciones personalizables**: Nombre de la librería/parroquia, símbolo de moneda (`$`, `S/`, `COP$`, `MXN$`, `Bs.`, `€`, `Q`, `RD$`), umbral de stock bajo y restauración de datos de ejemplo.

## 🚀 Cómo Ejecutar el Proyecto

```bash
# Iniciar servidor de desarrollo Expo (Android, iOS, Expo Go o Web)
npm start

# Abrir directamente en Android / iOS / Web
npm run android
npm run ios
npm run web

# Verificar tipado TypeScript y Linter
npm run typecheck
npm run lint
```
