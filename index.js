const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

function dateOnly(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/*
  Revisa diariamente los gastos fijos pendientes.
  Envía avisos a 5 días, 2 días y el día del vencimiento.
  La configuración se lee desde:
  users/{uid}/app/data/notificationSettings
*/
exports.checkFixedExpenseReminders = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "America/Bogota",
    region: "us-central1"
  },
  async () => {
    const usersSnap = await db.collection("users").get();
    const today = dateOnly(new Date());
    const jobs = [];

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;

      const [settingsSnap, fixedSnap, devicesSnap] = await Promise.all([
        db.doc(`users/${uid}/app/data/notificationSettings`).get(),
        db.doc(`users/${uid}/app/data/gastosFijos`).get(),
        db.collection(`users/${uid}/devices`).get()
      ]);

      const settings = settingsSnap.exists ? settingsSnap.data() : {};
      if (settings.enabled === false) continue;

      const tokens = devicesSnap.docs
        .map(d => d.data()?.token)
        .filter(Boolean);

      if (!tokens.length) continue;

      const data = fixedSnap.exists ? fixedSnap.data() : {};
      const items = Array.isArray(data.items) ? data.items : Object.values(data);

      for (const item of items) {
        if (!item || item.pagado === true || item.pendiente === false) continue;

        const due = toDate(item.fechaVencimiento || item.vencimiento || item.fecha);
        if (!due) continue;

        const diff = Math.round((dateOnly(due) - today) / 86400000);
        const enabledForDay =
          (diff === 5 && settings.days5 !== false) ||
          (diff === 2 && settings.days2 !== false) ||
          (diff === 0 && settings.dueDay !== false);

        if (!enabledForDay) continue;

        const nombre = item.nombre || item.concepto || item.descripcion || "Factura";
        const valor = Number(item.valor ?? item.monto ?? item.amount ?? 0);
        const formatted = new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0
        }).format(valor);

        const body = diff === 0
          ? `${nombre} vence hoy. Valor: ${formatted}.`
          : `${nombre} vence en ${diff} días. Valor: ${formatted}.`;

        jobs.push(
          getMessaging().sendEachForMulticast({
            tokens,
            notification: {
              title: diff === 0 ? "🚨 Factura vence hoy" : "🔔 Factura próxima a vencer",
              body
            },
            data: {
              url: "/Finanzas/",
              daysRemaining: String(diff),
              expenseId: String(item.id ?? item._id ?? nombre)
            }
          })
        );
      }
    }

    await Promise.all(jobs);
    return null;
  }
);
