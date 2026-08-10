export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  price_book_id?: string | number;
  pct_company?: number;
  pct_warranty?: number;
  pct_other?: number;
}

export interface Door {
  id: number;
  project_id: number;
  code: string;
  template_code: string;
  template_name: string;
  width: number;
  height: number;
  qty: number;
  width1?: number;
  height1?: number;
  width2?: number;
  height2?: number;
  description?: string;
  custom_transport?: number;
  custom_installation?: number;
  custom_fabrication?: number;
}

export interface PriceBook {
  id: string | number;
  name: string;
  description?: string;
  created_at?: string;
}

export interface MaterialItem {
  id: number;
  code: string;
  name: string;
  unit: string;
  default_price: number;
  custom_price?: number;
}

export interface IndirectCostConfig {
  id: string | number;
  cost_type: 'transport' | 'installation' | 'fabrication' | 'contingency';
  option_name: string;
  value_type: 'percent' | 'fixed_m2' | 'fixed_total';
  value: number;
}

export interface ProjectIndirectSelection {
  id: number;
  project_id: number;
  cost_type: string;
  indirect_cost_config_id: string | number;
  custom_value?: number;
}

export interface CalculationResult {
  code: string;
  name: string;
  template_code: string;
  width: number;
  height: number;
  qty: number;
  total_area: number;
  total_cost: number;
  price_per_m2: number;
  total_price: number;
  margin: number;
  // Cost breakdown
  mat_aluminum_cost: number;
  mat_glass_cost: number;
  mat_accessory_cost: number;
  labor_fabrication_cost: number;
  labor_installation_cost: number;
  transport_cost: number;
  contingency_cost: number;
}
