const token = process.env.LOYVERSE_TOKEN;

if (!token) {
    console.log("❌ No se encontró el token de Loyverse.");
    process.exit(1);
}

const configuracion = require("./promociones.json");

const API = "https://api.loyverse.com/v1.0";

const diasSemana = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado"
];


async function obtenerArticulos() {

    const response = await fetch(`${API}/items`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`Error consultando Loyverse: ${response.status}`);
    }

    const datos = await response.json();

    return datos.items || [];
}


async function cambiarDisponibilidad(item, disponible) {

    for (const variante of item.variants || []) {

        for (const tienda of variante.stores || []) {
            tienda.available_for_sale = disponible;
        }
    }

    const response = await fetch(`${API}/items`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(item)
    });

    const resultado = await response.json();

    if (!response.ok) {

        console.log(
            `❌ Error actualizando ${item.item_name}:`,
            JSON.stringify(resultado, null, 2)
        );

        return false;
    }

    console.log(
        `✅ ${item.item_name} → ${disponible ? "DISPONIBLE" : "NO DISPONIBLE"}`
    );

    return true;
}


function obtenerFechaMexico() {

    const ahora = new Date();

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(ahora);
}


async function main() {

    console.log("\n=================================");
    console.log("AUTOMATIZADOR DE PROMOCIONES");
    console.log("=================================\n");

    if (!configuracion.activo) {

        console.log("⛔ Automatización desactivada.");
        return;
    }

    const fecha = obtenerFechaMexico();

    console.log(`Fecha México: ${fecha}`);

    if (
        fecha < configuracion.inicio ||
        fecha > configuracion.fin
    ) {

        console.log("⏹️ Fuera del período configurado.");
        return;
    }

    const ahora = new Date();

    const dia = new Intl.DateTimeFormat("es-MX", {
        timeZone: "America/Mexico_City",
        weekday: "long"
    })
    .format(ahora)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

    console.log(`Día México: ${dia}\n`);

    const articulos = await obtenerArticulos();

    for (const promocion of configuracion.promociones) {

        const esDiaPromocion =
            promocion.dias.includes(dia);

        console.log("---------------------------------");
        console.log(promocion.nombre);
        console.log(
            `Promoción activa hoy: ${esDiaPromocion ? "SÍ" : "NO"}`
        );

        const articuloNormal = articulos.find(
            item =>
                item.variants?.some(
                    variante =>
                        variante.sku === promocion.skuNormal
                )
        );

        const articuloPromocion = articulos.find(
            item =>
                item.variants?.some(
                    variante =>
                        variante.sku === promocion.skuPromocion
                )
        );

        if (!articuloNormal) {
            console.log(
                `❌ No encontrado SKU ${promocion.skuNormal}`
            );
            continue;
        }

        if (!articuloPromocion) {
            console.log(
                `❌ No encontrado SKU ${promocion.skuPromocion}`
            );
            continue;
        }

        /*
         * Día de promoción:
         *
         * Normal      → OFF
         * Promoción   → ON
         *
         * Día normal:
         *
         * Normal      → ON
         * Promoción   → OFF
         */

        await cambiarDisponibilidad(
            articuloNormal,
            !esDiaPromocion
        );

        await cambiarDisponibilidad(
            articuloPromocion,
            esDiaPromocion
        );
    }

    console.log("\n=================================");
    console.log("Proceso terminado.");
    console.log("=================================\n");
}


main().catch(error => {

    console.error("❌ Error general:", error.message);

});