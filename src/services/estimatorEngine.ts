export interface DoorItem {
  id: string | number;
  code: string;
  template_id?: number | string;
  template_name?: string;
  door_type?: string;
  width: number; // mm
  height: number; // mm
  qty: number;
  description?: string;
  override_transport_cost?: number;
  override_installation_cost?: number;
  override_labor_cost?: number;
  price_per_m2?: number;
}

export interface MaterialPriceItem {
  material_code: string;
  material_name?: string;
  unit?: string;
  price: number;
  weight?: number;
}

export interface OperaMaterialItem {
  id?: number | string;
  project_id?: number | string;
  typology_name: string;
  code: string;
  name?: string;
  description?: string;
  quantity: number;
  quantity_unit?: string;
  unit_weight?: number;
  color?: string;
  width?: number;
  height?: number;
  unit_price?: number;
}

export interface DoorEstimateResult {
  door_id: string | number;
  code: string;
  door_name: string;
  door_type: string;
  width: number;
  height: number;
  qty: number;
  area_m2: number;
  total_area_m2: number;
  cost_aluminum: number;
  cost_glass: number;
  cost_accessories: number;
  cost_labor: number;
  cost_transport: number;
  cost_installation: number;
  cost_indirect: number;
  total_cost: number;
  unit_cost_per_m2: number;
  price_per_m2: number;
  total_price: number;
  materials_breakdown: {
    profiles: any[];
    accessories: any[];
    glass: any[];
  };
}

export interface ProjectEstimateResult {
  doors: DoorEstimateResult[];
  total_area_m2: number;
  total_cost_aluminum: number;
  total_cost_glass: number;
  total_cost_accessories: number;
  total_cost_labor: number;
  total_cost_transport: number;
  total_cost_installation: number;
  total_cost_indirect: number;
  total_project_cost: number;
  total_project_price: number;
  average_price_per_m2: number;
}

export function determineDoorType(code: string = '', name: string = ''): string {
  const codeUpper = (code || '').toUpperCase();
  const nameUpper = (name || '').toUpperCase();

  if (codeUpper.includes('VKT') || nameUpper.includes('VÁCH') || nameUpper.includes('VKT')) {
    return 'VÁCH KÍNH';
  }
  if (
    codeUpper.includes('SWA') ||
    codeUpper.includes('WA') ||
    codeUpper.includes('CS') ||
    nameUpper.includes('SỔ')
  ) {
    return 'CỬA SỔ';
  }
  if (
    codeUpper.includes('SDA') ||
    codeUpper.includes('DA') ||
    codeUpper.includes('CD') ||
    nameUpper.includes('ĐI') ||
    nameUpper.includes('CỬA ĐI')
  ) {
    return 'CỬA ĐI';
  }
  if (nameUpper.includes('WINDOW')) return 'CỬA SỔ';
  if (nameUpper.includes('DOOR')) return 'CỬA ĐI';

  return 'CỬA SỔ';
}

export function calculateProjectEstimates(
  doors: DoorItem[],
  operaMaterials: OperaMaterialItem[],
  priceMap: Record<string, MaterialPriceItem>,
  options: {
    targetProfitMargin?: number;
    pctCompany?: number;
    pctContingency?: number;
    pctWarranty?: number;
    pctOther?: number;
  } = {}
): ProjectEstimateResult {
  const {
    targetProfitMargin = 10,
    pctCompany = 2,
    pctContingency = 2,
    pctWarranty = 1.5,
    pctOther = 1,
  } = options;

  let projectTotalArea = 0;
  const doorResults: DoorEstimateResult[] = [];

  const operaMaterialsByTypology: Record<string, OperaMaterialItem[]> = {};
  for (const mat of operaMaterials) {
    const typo = (mat.typology_name || '').trim();
    if (!operaMaterialsByTypology[typo]) {
      operaMaterialsByTypology[typo] = [];
    }
    operaMaterialsByTypology[typo].push(mat);
  }

  for (const door of doors) {
    const w_m = door.width < 10 ? door.width : door.width / 1000;
    const h_m = door.height < 10 ? door.height : door.height / 1000;
    const singleArea = w_m * h_m;
    const totalDoorArea = singleArea * door.qty;
    projectTotalArea += totalDoorArea;

    const typoName = door.code || door.template_name || '';
    const matList = operaMaterialsByTypology[typoName] || [];

    let costAluminum = 0;
    let costGlass = 0;
    let costAccessories = 0;
    let costLabor = 0;

    const profilesBreakdown: any[] = [];
    const accessoriesBreakdown: any[] = [];
    const glassBreakdown: any[] = [];

    for (const mat of matList) {
      const code = mat.code;
      const priceInfo = priceMap[code] || { price: mat.unit_price || 0, weight: mat.unit_weight || 0 };
      const unitPrice = priceInfo.price || mat.unit_price || 0;
      const unitWeight = priceInfo.weight || mat.unit_weight || 0;
      const name = mat.name || mat.description || code;
      const unit = mat.quantity_unit || 'pc';

      const lineTotalQty = mat.quantity;
      const lineCost = lineTotalQty * unitPrice;

      const lowerName = (name || '').toLowerCase();
      const lowerUnit = unit.toLowerCase();

      if (lowerUnit === 'm' || lowerName.includes('nhôm') || lowerName.includes('khung') || lowerName.includes('cánh')) {
        costAluminum += lineCost;
        profilesBreakdown.push({
          code,
          name,
          qty: lineTotalQty,
          unit,
          unitPrice,
          unitWeight,
          lineCost,
        });
      } else if (lowerUnit === 'm2' || lowerName.includes('kính') || lowerName.includes('glass')) {
        costGlass += lineCost;
        glassBreakdown.push({
          code,
          name,
          qty: lineTotalQty,
          unit,
          unitPrice,
          lineCost,
        });
      } else {
        costAccessories += lineCost;
        accessoriesBreakdown.push({
          code,
          name,
          qty: lineTotalQty,
          unit,
          unitPrice,
          lineCost,
        });
      }
    }

    costLabor = (costAluminum + costGlass + costAccessories) * 0.15; // 15% labor
    const costTransport = door.override_transport_cost ?? (totalDoorArea * 50000);
    const costInstallation = door.override_installation_cost ?? (totalDoorArea * 150000);

    const indirectPctSum = (pctCompany + pctContingency + pctWarranty + pctOther) / 100;
    const costIndirect = (costAluminum + costGlass + costAccessories + costLabor) * indirectPctSum;

    const doorTotalCost = costAluminum + costGlass + costAccessories + costLabor + costTransport + costInstallation + costIndirect;
    const unitCostPerM2 = totalDoorArea > 0 ? doorTotalCost / totalDoorArea : 0;

    const doorTotalPrice = doorTotalCost * (1 + targetProfitMargin / 100);
    const pricePerM2 = totalDoorArea > 0 ? doorTotalPrice / totalDoorArea : 0;

    doorResults.push({
      door_id: door.id,
      code: door.code,
      door_name: door.template_name || door.code,
      door_type: door.door_type || determineDoorType(door.code, door.template_name),
      width: door.width,
      height: door.height,
      qty: door.qty,
      area_m2: singleArea,
      total_area_m2: totalDoorArea,
      cost_aluminum: costAluminum,
      cost_glass: costGlass,
      cost_accessories: costAccessories,
      cost_labor: costLabor,
      cost_transport: costTransport,
      cost_installation: costInstallation,
      cost_indirect: costIndirect,
      total_cost: doorTotalCost,
      unit_cost_per_m2: unitCostPerM2,
      price_per_m2: pricePerM2,
      total_price: doorTotalPrice,
      materials_breakdown: {
        profiles: profilesBreakdown,
        accessories: accessoriesBreakdown,
        glass: glassBreakdown,
      },
    });
  }

  const totalCostAluminum = doorResults.reduce((s, d) => s + d.cost_aluminum, 0);
  const totalCostGlass = doorResults.reduce((s, d) => s + d.cost_glass, 0);
  const totalCostAccessories = doorResults.reduce((s, d) => s + d.cost_accessories, 0);
  const totalCostLabor = doorResults.reduce((s, d) => s + d.cost_labor, 0);
  const totalCostTransport = doorResults.reduce((s, d) => s + d.cost_transport, 0);
  const totalCostInstallation = doorResults.reduce((s, d) => s + d.cost_installation, 0);
  const totalCostIndirect = doorResults.reduce((s, d) => s + d.cost_indirect, 0);
  const totalProjectCost = doorResults.reduce((s, d) => s + d.total_cost, 0);
  const totalProjectPrice = doorResults.reduce((s, d) => s + d.total_price, 0);

  const averagePricePerM2 = projectTotalArea > 0 ? totalProjectPrice / projectTotalArea : 0;

  return {
    doors: doorResults,
    total_area_m2: projectTotalArea,
    total_cost_aluminum: totalCostAluminum,
    total_cost_glass: totalCostGlass,
    total_cost_accessories: totalCostAccessories,
    total_cost_labor: totalCostLabor,
    total_cost_transport: totalCostTransport,
    total_cost_installation: totalCostInstallation,
    total_cost_indirect: totalCostIndirect,
    total_project_cost: totalProjectCost,
    total_project_price: totalProjectPrice,
    average_price_per_m2: averagePricePerM2,
  };
}
