/**
 * FINANZAS 2026 — Apps Script backend
 * ─────────────────────────────────────────────────────
 * Google Sheet como base de datos para la app.
 *
 * CAMBIO v5:
 * - doGet mantiene JSON normal cuando no se envía callback.
 * - doGet devuelve JSONP cuando recibe ?callback=...
 *   Esto permite IMPORTAR desde Android/iOS/desktop sin CORS.
 */

const SHEET_NAMES = {
  ingresos: 'Ingresos',
  gastosFijos: 'Gastos Fijos',
  gastosVariables: 'Gastos Variables',
  proyeccion: 'Proyección'
};

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#0e7490')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function clearDataRows(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet
      .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
      .clearContent();
  }
}

/**
 * Recibe el POST de la app y reescribe las hojas.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // INGRESOS
    if (data.ingresos) {
      const sh = getOrCreateSheet(
        SHEET_NAMES.ingresos,
        ['Mes', 'Fecha', 'Valor', 'Descripción']
      );

      clearDataRows(sh);

      const rows = data.ingresos.map(i => [
        i.mes,
        i.fecha || '',
        i.valor,
        i.desc || ''
      ]);

      if (rows.length) {
        sh.getRange(2, 1, rows.length, 4).setValues(rows);
      }
    }

    // GASTOS FIJOS
    if (data.gastosFijos) {
      const sh = getOrCreateSheet(
        SHEET_NAMES.gastosFijos,
        ['Ítem', 'Ubicación', 'Valor', 'Fecha límite']
      );

      clearDataRows(sh);

      const rows = data.gastosFijos.map(f => [
        f.item,
        f.ubi,
        f.valor,
        f.fechaLimite || ''
      ]);

      if (rows.length) {
        sh.getRange(2, 1, rows.length, 4).setValues(rows);
      }
    }

    // GASTOS VARIABLES
    if (data.gastosVariables) {
      const sh = getOrCreateSheet(
        SHEET_NAMES.gastosVariables,
        ['Mes', 'Fecha', 'Categoría', 'Valor', 'Descripción']
      );

      clearDataRows(sh);

      const rows = data.gastosVariables.map(g => [
        g.mes,
        g.fecha || '',
        g.cat,
        g.valor,
        g.desc || ''
      ]);

      if (rows.length) {
        sh.getRange(2, 1, rows.length, 5).setValues(rows);
      }
    }

    // PROYECCIÓN
    if (data.proyeccion) {
      const sh = getOrCreateSheet(
        SHEET_NAMES.proyeccion,
        ['Mes', 'Ingresos', 'Fijos', 'Variables', 'Total', 'Saldo']
      );

      clearDataRows(sh);

      const rows = data.proyeccion.map(p => [
        p.mes,
        p.ingresos,
        p.fijos,
        p.variables,
        p.total,
        p.saldo
      ]);

      if (rows.length) {
        sh.getRange(2, 1, rows.length, 6).setValues(rows);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Lee los datos de Google Sheets.
 *
 * Sin callback:
 *   devuelve JSON normal.
 *
 * Con callback:
 *   devuelve JSONP para que la PWA pueda importar
 *   sin depender de CORS/fetch.
 */
function doGet(e) {
  const callback =
    e &&
    e.parameter &&
    e.parameter.callback
      ? String(e.parameter.callback)
      : '';

  const callbackValido =
    callback &&
    /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback);

  try {
    if (callback && !callbackValido) {
      throw new Error('Callback inválido');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = {};

    // INGRESOS
    const ingSheet = ss.getSheetByName(SHEET_NAMES.ingresos);

    if (ingSheet && ingSheet.getLastRow() > 1) {
      const vals = ingSheet
        .getRange(2, 1, ingSheet.getLastRow() - 1, 4)
        .getValues();

      result.ingresos = vals
        .filter(r => r[2] !== '' && r[2] !== null)
        .map(r => ({
          mes: r[0],
          fecha: r[1],
          valor: r[2],
          desc: r[3]
        }));
    }

    // GASTOS FIJOS
    const fijSheet = ss.getSheetByName(SHEET_NAMES.gastosFijos);

    if (fijSheet && fijSheet.getLastRow() > 1) {
      const vals = fijSheet
        .getRange(2, 1, fijSheet.getLastRow() - 1, 4)
        .getValues();

      result.gastosFijos = vals
        .filter(r => r[0] !== '' && r[0] !== null)
        .map(r => ({
          item: r[0],
          ubi: r[1],
          valor: r[2],
          fechaLimite: r[3]
        }));
    }

    // GASTOS VARIABLES
    const varSheet = ss.getSheetByName(SHEET_NAMES.gastosVariables);

    if (varSheet && varSheet.getLastRow() > 1) {
      const vals = varSheet
        .getRange(2, 1, varSheet.getLastRow() - 1, 5)
        .getValues();

      result.gastosVariables = vals
        .filter(r => r[3] !== '' && r[3] !== null)
        .map(r => ({
          mes: r[0],
          fecha: r[1],
          cat: r[2],
          valor: r[3],
          desc: r[4]
        }));
    }

    const payload = {
      status: 'ok',
      data: result
    };

    // JSONP para la PWA
    if (callbackValido) {
      return ContentService
        .createTextOutput(
          callback + '(' + JSON.stringify(payload) + ');'
        )
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    // JSON normal
    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const payload = {
      status: 'error',
      message: err.toString()
    };

    if (callbackValido) {
      return ContentService
        .createTextOutput(
          callback + '(' + JSON.stringify(payload) + ');'
        )
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Prueba manual.
 */
function testSetup() {
  const testData = {
    ingresos: [
      {
        mes: 'Junio',
        fecha: '2026-06-01',
        valor: 1000000,
        desc: 'Prueba'
      }
    ],
    gastosFijos: [
      {
        item: 'Prueba Luz',
        ubi: 'Tunja',
        valor: 50000,
        fechaLimite: '15'
      }
    ],
    gastosVariables: [
      {
        mes: 'Junio',
        fecha: '2026-06-05',
        cat: 'Almuerzo',
        valor: 15000,
        desc: 'Prueba'
      }
    ],
    proyeccion: [
      {
        mes: 'Junio',
        ingresos: 1000000,
        fijos: 50000,
        variables: 15000,
        total: 65000,
        saldo: 935000
      }
    ]
  };

  doPost({
    postData: {
      contents: JSON.stringify(testData)
    }
  });

  Logger.log('Hojas creadas/actualizadas con datos de prueba');
}
