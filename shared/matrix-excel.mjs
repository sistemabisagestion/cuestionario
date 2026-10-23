// Read ZIP central-directory metadata before decompression. Reject ZIP64,
// encryption, macros, external links and oversized expanded workbooks.
export function checkExcelContainer(buffer, { maxBytes = 1048576, maxExpandedBytes = 8 * 1048576 } = {}) {
  if (buffer.byteLength > maxBytes) throw new Error(`El archivo supera ${Math.round(maxBytes / 1048576)} MB.`);
  const view = new DataView(buffer);
  if (view.byteLength < 4) throw new Error('Archivo Excel inválido.');
  if (view.getUint32(0, true) !== 0x04034b50) {
    if (view.getUint32(0, true) !== 0xe011cfd0) throw new Error('Se requiere un archivo .xlsx o .xls válido.');
    return; // Legacy XLS: compressed file size and worker timeout still bounded.
  }
  let end = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('Excel ZIP inválido.');
  const count = view.getUint16(end + 10, true);
  let pos = view.getUint32(end + 16, true), total = 0;
  if (count > 200 || count === 65535) throw new Error('Excel demasiado complejo.');
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50) throw new Error('Directorio Excel inválido.');
    const flags = view.getUint16(pos + 8, true);
    const size = view.getUint32(pos + 24, true);
    total += size;
    const nameLength = view.getUint16(pos + 28, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, pos + 46, nameLength));
    if ((flags & 1) || size === 0xffffffff || total > maxExpandedBytes || /vbaProject|externalLinks|\.bin$/i.test(name)) throw new Error(`Excel con contenido no permitido o superior a ${Math.round(maxExpandedBytes / 1048576)} MB descomprimido.`);
    pos += 46 + nameLength + view.getUint16(pos + 30, true) + view.getUint16(pos + 32, true);
  }
}

// Plain Cargo/Estándar sheet written by scripts/recover-matrices.mjs.
export function matrixWorkbook(XLSX, mapping) {
  const rows = [['Cargo', 'Estándar'], ...mapping.flatMap(item => item.estandares.map(code => [item.cargo, code]))];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 35 }, { wch: 28 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Matriz');
  return workbook;
}
