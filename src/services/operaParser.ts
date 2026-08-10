import * as XLSX from 'xlsx';
import { OperaMaterialItem, DoorItem } from './estimatorEngine';

export interface ParsedOperaResult {
  doors: DoorItem[];
  materials: OperaMaterialItem[];
  uniqueMaterialPrices: Record<string, { name: string; unit: string; price: number; weight: number }>;
}

export async function parseOperaFile(file: File): Promise<ParsedOperaResult> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.xml')) {
    const text = await file.text();
    return parseOperaXMLText(text);
  } else {
    const arrayBuffer = await file.arrayBuffer();
    return parseOperaExcelArrayBuffer(arrayBuffer);
  }
}

export function parseOperaXMLText(xmlText: string): ParsedOperaResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  const doors: DoorItem[] = [];
  const materials: OperaMaterialItem[] = [];
  const uniqueMaterialPrices: Record<string, { name: string; unit: string; price: number; weight: number }> = {};

  // Extract materials
  const matNodes = doc.querySelectorAll('material');
  matNodes.forEach((mat) => {
    const code = (
      mat.querySelector('mat_alternative_code')?.textContent ||
      mat.querySelector('mat_supplier_code')?.textContent ||
      ''
    ).trim();
    const name = (
      mat.querySelector('mat_name')?.textContent ||
      mat.querySelector('mat_description')?.textContent ||
      ''
    ).trim();
    const unit = (mat.querySelector('mat_unit')?.textContent || 'pc').trim();
    const priceVal = mat.querySelector('mat_price')?.textContent || mat.querySelector('mat_full_price')?.textContent || '0';
    const weightVal = mat.querySelector('mat_unit_weight')?.textContent || mat.querySelector('mat_weight')?.textContent || '0';

    const price = parseFloat(priceVal) || 0;
    const weight = parseFloat(weightVal) || 0;

    if (code && code !== 'nan') {
      uniqueMaterialPrices[code] = { name, unit, price, weight };
    }
  });

  // Extract components (doors)
  const compNodes = doc.querySelectorAll('component');
  compNodes.forEach((comp, idx) => {
    const cmpPos = (comp.querySelector('cmp_position')?.textContent || `DOOR_${idx + 1}`).trim();
    const cmpName = (comp.querySelector('cmp_name')?.textContent || cmpPos).trim();
    const width = parseFloat(comp.querySelector('cmp_width')?.textContent || '1000');
    const height = parseFloat(comp.querySelector('cmp_height')?.textContent || '2000');
    const qty = parseInt(comp.querySelector('cmp_quantity')?.textContent || '1', 10);
    const desc = (comp.querySelector('cmp_description')?.textContent || comp.querySelector('cmp_notes')?.textContent || '').trim();

    doors.push({
      id: idx + 1,
      code: cmpPos,
      template_name: cmpName,
      width: width > 0 ? width : 1000,
      height: height > 0 ? height : 2000,
      qty: qty > 0 ? qty : 1,
      description: desc,
    });

    const compMats = comp.querySelectorAll('materials > material');
    compMats.forEach((mat) => {
      const code = (
        mat.querySelector('mat_alternative_code')?.textContent ||
        mat.querySelector('mat_supplier_code')?.textContent ||
        ''
      ).trim();
      const name = (
        mat.querySelector('mat_name')?.textContent ||
        mat.querySelector('mat_description')?.textContent ||
        ''
      ).trim();
      const unit = (mat.querySelector('mat_unit')?.textContent || 'pc').trim();
      const qVal = parseFloat(mat.querySelector('mat_quantity')?.textContent || '0');
      const wVal = parseFloat(mat.querySelector('mat_unit_weight')?.textContent || '0');
      const pVal = parseFloat(mat.querySelector('mat_price')?.textContent || '0');

      if (code) {
        materials.push({
          typology_name: cmpPos,
          code,
          name,
          quantity: qVal,
          quantity_unit: unit,
          unit_weight: wVal,
          unit_price: pVal,
        });
      }
    });
  });

  return { doors, materials, uniqueMaterialPrices };
}

export function parseOperaExcelArrayBuffer(buffer: ArrayBuffer): ParsedOperaResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const doors: DoorItem[] = [];
  const materials: OperaMaterialItem[] = [];
  const uniqueMaterialPrices: Record<string, { name: string; unit: string; price: number; weight: number }> = {};

  const doorGroupMap: Record<string, { width: number; height: number; qty: number; desc: string }> = {};

  rawData.forEach((row, idx) => {
    const typoName = String(row['Typology Name'] || row['Typology'] || row['Cửa'] || row['Code'] || '').trim();
    const code = String(row['Code'] || row['Mã'] || '').trim();
    const desc = String(row['Description'] || row['Name'] || row['Mô tả'] || '').trim();
    const unit = String(row['QuantityUnit'] || row['Unit'] || row['Đơn vị'] || 'pc').trim();

    const qty = parseFloat(row['Quantity'] || row['Số lượng'] || 0) || 0;
    const unitWeight = parseFloat(row['Unit Weight'] || row['Trọng lượng'] || 0) || 0;
    const unitPrice = parseFloat(row['Price'] || row['Đơn giá'] || 0) || 0;

    const w = parseFloat(row['Width'] || row['Rộng'] || 0) || 0;
    const h = parseFloat(row['Height'] || row['Cao'] || 0) || 0;

    if (code && code !== 'nan') {
      uniqueMaterialPrices[code] = {
        name: desc || code,
        unit,
        price: unitPrice,
        weight: unitWeight,
      };
    }

    if (typoName && typoName !== 'nan') {
      if (!doorGroupMap[typoName]) {
        doorGroupMap[typoName] = { width: w || 1000, height: h || 2000, qty: 1, desc: '' };
      }
      if (w > 0) doorGroupMap[typoName].width = w;
      if (h > 0) doorGroupMap[typoName].height = h;

      if (code && code !== 'nan') {
        materials.push({
          typology_name: typoName,
          code,
          name: desc || code,
          quantity: qty,
          quantity_unit: unit,
          unit_weight: unitWeight,
          unit_price: unitPrice,
        });
      }
    }
  });

  let idCounter = 1;
  for (const [code, info] of Object.entries(doorGroupMap)) {
    doors.push({
      id: idCounter++,
      code,
      template_name: code,
      width: info.width > 0 ? info.width : 1000,
      height: info.height > 0 ? info.height : 2000,
      qty: info.qty > 0 ? info.qty : 1,
      description: info.desc,
    });
  }

  return { doors, materials, uniqueMaterialPrices };
}
