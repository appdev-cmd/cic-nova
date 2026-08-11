/**
 * supabaseService.ts
 * Service layer gọi Supabase Cloud trực tiếp từ frontend.
 * Thay thế tất cả REST API calls đến backend Python.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ================== AUTH ==================

export async function supabaseLogin(username: string, password: string) {
  // Query users table directly with username
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .limit(1);

  if (error) throw new Error(error.message);
  if (!users || users.length === 0) {
    throw new Error('Tên đăng nhập không tồn tại.');
  }

  const user = users[0];

  // Verify password using PBKDF2 (same as backend)
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error('Mật khẩu không đúng.');
  }

  // Generate a simple session token (for UI state, not for RLS)
  const sessionToken = btoa(JSON.stringify({
    user_id: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24h
  }));

  return {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    },
    token: sessionToken
  };
}

export async function supabaseRegisterInit(username: string, password: string, name: string) {
  const passwordHash = await hashPassword(password);
  
  const { data, error } = await supabase
    .from('users')
    .insert([{
      username,
      password_hash: passwordHash,
      name,
      role: 'admin'
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('Tên đăng nhập đã tồn tại.');
    throw new Error(error.message);
  }

  return data;
}

export async function supabaseCheckSetup() {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  return { initialized: (count ?? 0) > 0 };
}

// Password hashing utilities (PBKDF2-SHA256, hex encoding, compatible with Python backend)
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bytesToHex(salt);
  const iterations = 600000;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );

  const hashHex = bytesToHex(new Uint8Array(derivedBits));
  return `pbkdf2_sha256$${iterations}$${saltHex}$${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Support format: pbkdf2_sha256$iterations$salt_hex$hash_hex
    if (storedHash.startsWith('pbkdf2_sha256$')) {
      const parts = storedHash.split('$');
      if (parts.length !== 4) return false;

      const iterations = parseInt(parts[1]);
      const saltHex = parts[2];
      const expectedHashHex = parts[3];

      const salt = hexToBytes(saltHex);

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        256
      );

      const computedHashHex = bytesToHex(new Uint8Array(derivedBits));
      return computedHashHex === expectedHashHex;
    }

    // Backward compatibility: salt_hex.hash_hex format
    const [saltHex, hashHex] = storedHash.split('.');
    if (!saltHex || !hashHex) return false;

    const salt = hexToBytes(saltHex);
    const iterations = 100000;

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    );

    const computedHashHex = bytesToHex(new Uint8Array(derivedBits));
    return computedHashHex === hashHex;
  } catch {
    return false;
  }
}


// ================== PROJECTS ==================

export async function getProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createProject(project: { name: string; description?: string; price_book_id?: number | null }) {
  const { data, error } = await supabase
    .from('projects')
    .insert([{
      name: project.name,
      description: project.description || '',
      price_book_id: project.price_book_id || null,
      has_opera_bom: false,
      target_profit_margin: 10,
      target_total_price: 0,
      pct_company: 2.0,
      pct_contingency: 2.0,
      pct_warranty: 1.5,
      pct_other: 1.0
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateProject(id: number, updates: any) {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteProject(id: number) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}


// ================== PROJECT DOORS ==================

export async function getProjectDoors(projectId: number) {
  const { data, error } = await supabase
    .from('project_doors')
    .select('*')
    .eq('project_id', projectId)
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function addProjectDoor(projectId: number, door: any) {
  const { data, error } = await supabase
    .from('project_doors')
    .insert([{
      project_id: projectId,
      code: door.code,
      template_id: parseInt(door.template_id),
      width: parseFloat(door.width),
      height: parseFloat(door.height),
      width1: door.width1 ? parseFloat(door.width1) : null,
      height1: door.height1 ? parseFloat(door.height1) : null,
      width2: door.width2 ? parseFloat(door.width2) : null,
      height2: door.height2 ? parseFloat(door.height2) : null,
      qty: parseInt(door.qty) || 1,
      description: door.description || null
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateProjectDoor(doorId: number, updates: any) {
  const cleanUpdates: any = {};
  if (updates.code !== undefined) cleanUpdates.code = updates.code;
  if (updates.template_id !== undefined) cleanUpdates.template_id = parseInt(updates.template_id);
  if (updates.width !== undefined) cleanUpdates.width = parseFloat(updates.width);
  if (updates.height !== undefined) cleanUpdates.height = parseFloat(updates.height);
  if (updates.width1 !== undefined) cleanUpdates.width1 = updates.width1 ? parseFloat(updates.width1) : null;
  if (updates.height1 !== undefined) cleanUpdates.height1 = updates.height1 ? parseFloat(updates.height1) : null;
  if (updates.width2 !== undefined) cleanUpdates.width2 = updates.width2 ? parseFloat(updates.width2) : null;
  if (updates.height2 !== undefined) cleanUpdates.height2 = updates.height2 ? parseFloat(updates.height2) : null;
  if (updates.qty !== undefined) cleanUpdates.qty = parseInt(updates.qty) || 1;
  if (updates.description !== undefined) cleanUpdates.description = updates.description;
  if (updates.override_transport_cost !== undefined) cleanUpdates.override_transport_cost = updates.override_transport_cost;
  if (updates.override_installation_cost !== undefined) cleanUpdates.override_installation_cost = updates.override_installation_cost;
  if (updates.override_labor_cost !== undefined) cleanUpdates.override_labor_cost = updates.override_labor_cost;
  if (updates.price_per_m2 !== undefined) cleanUpdates.price_per_m2 = updates.price_per_m2;

  const { data, error } = await supabase
    .from('project_doors')
    .update(cleanUpdates)
    .eq('id', doorId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteProjectDoor(doorId: number) {
  const { error } = await supabase
    .from('project_doors')
    .delete()
    .eq('id', doorId);

  if (error) throw new Error(error.message);
}


// ================== TEMPLATES ==================

export async function getTemplates() {
  const { data, error } = await supabase
    .from('templates')
    .select('*, systems(name)')
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(t => ({
    ...t,
    system_name: t.systems?.name || 'N/A'
  }));
}

export async function getTemplateFormulas(templateId: number) {
  const [profilesRes, accessoriesRes] = await Promise.all([
    supabase.from('profile_formulas').select('*').eq('template_id', templateId).order('id'),
    supabase.from('accessory_formulas').select('*').eq('template_id', templateId).order('id')
  ]);

  return {
    profiles: profilesRes.data || [],
    accessories: accessoriesRes.data || []
  };
}


// ================== MATERIALS ==================

export async function getMaterials() {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('code', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createMaterial(material: any) {
  const { data, error } = await supabase
    .from('materials')
    .insert([material])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateMaterial(id: number, updates: any) {
  const { data, error } = await supabase
    .from('materials')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteMaterial(id: number) {
  const { error } = await supabase
    .from('materials')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}


// ================== PRICE BOOKS ==================

export async function getPriceBooks() {
  const { data, error } = await supabase
    .from('price_books')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getPriceBookItems(priceBookId: number) {
  const { data, error } = await supabase
    .from('material_price_book_items')
    .select('*, materials(name, unit, weight_per_m)')
    .eq('price_book_id', priceBookId);

  if (error) throw new Error(error.message);
  return data || [];
}


// ================== INDIRECT COSTS ==================

export async function getIndirectCostConfigs() {
  const { data, error } = await supabase
    .from('indirect_cost_configs')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getProjectIndirectCosts(projectId: number) {
  const { data, error } = await supabase
    .from('project_indirect_cost_selections')
    .select('*')
    .eq('project_id', projectId);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveProjectIndirectCosts(projectId: number, selections: any[]) {
  // Delete existing selections
  await supabase
    .from('project_indirect_cost_selections')
    .delete()
    .eq('project_id', projectId);

  if (selections.length === 0) return [];

  // Insert new selections
  const rows = selections.map(s => ({
    project_id: projectId,
    cost_type: s.cost_type,
    indirect_cost_config_id: s.indirect_cost_config_id === 'custom' ? null : (s.indirect_cost_config_id || null),
    custom_value: s.custom_value !== '' && s.custom_value !== null && s.custom_value !== undefined
      ? parseFloat(s.custom_value) : null
  }));

  const { data, error } = await supabase
    .from('project_indirect_cost_selections')
    .insert(rows)
    .select();

  if (error) throw new Error(error.message);
  return data || [];
}


// ================== OPERA MATERIALS ==================

export async function getOperaMaterials(projectId: number) {
  const { data, error } = await supabase
    .from('project_opera_materials')
    .select('*')
    .eq('project_id', projectId)
    .order('typology_name', { ascending: true });

  if (error) throw new Error(error.message);

  const materials = data || [];

  // Build summary by unique code
  const codeMap: Record<string, any> = {};
  materials.forEach(m => {
    if (!codeMap[m.code]) {
      codeMap[m.code] = {
        code: m.code,
        name: m.name || m.description || m.code,
        quantity_unit: m.quantity_unit,
        total_quantity: 0,
        unit_price: m.unit_price,
        mapped_material_id: m.mapped_material_id,
        typologies: []
      };
    }
    codeMap[m.code].total_quantity += (m.quantity || 0);
    if (!codeMap[m.code].typologies.includes(m.typology_name)) {
      codeMap[m.code].typologies.push(m.typology_name);
    }
  });

  return {
    materials,
    summary: Object.values(codeMap)
  };
}

export async function saveOperaMaterials(projectId: number, materials: any[]) {
  // Delete existing
  await supabase
    .from('project_opera_materials')
    .delete()
    .eq('project_id', projectId);

  if (materials.length === 0) return;

  // Insert new materials in batches of 500
  const batchSize = 500;
  for (let i = 0; i < materials.length; i += batchSize) {
    const batch = materials.slice(i, i + batchSize).map(m => ({
      project_id: projectId,
      typology_name: m.typology_name || m.typology || 'Unknown',
      code: m.code,
      name: m.name || null,
      description: m.description || null,
      quantity: m.quantity || m.pieces || 0,
      quantity_unit: m.quantity_unit || m.unit || 'pc',
      unit_weight: m.unit_weight || null,
      color: m.color || null,
      width: m.width || null,
      height: m.height || null,
      unit_price: m.unit_price || null,
      mapped_material_id: m.mapped_material_id || null
    }));

    const { error } = await supabase
      .from('project_opera_materials')
      .insert(batch);

    if (error) throw new Error(error.message);
  }

  // Mark project as having opera BOM
  await supabase
    .from('projects')
    .update({ has_opera_bom: true })
    .eq('id', projectId);
}

export async function updateOperaMaterialPrices(projectId: number, updates: { code: string; unit_price: number; mapped_material_id?: number | null }[]) {
  for (const update of updates) {
    const updateData: any = { unit_price: update.unit_price };
    if (update.mapped_material_id !== undefined) {
      updateData.mapped_material_id = update.mapped_material_id;
    }

    await supabase
      .from('project_opera_materials')
      .update(updateData)
      .eq('project_id', projectId)
      .eq('code', update.code);
  }
}


// ================== QUOTE VERSIONS ==================

export async function getQuoteVersions(projectId: number) {
  const { data, error } = await supabase
    .from('quote_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createQuoteVersion(projectId: number, version: any) {
  // Get next version number
  const { data: existing } = await supabase
    .from('quote_versions')
    .select('version_number')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersion = (existing && existing.length > 0 ? existing[0].version_number : 0) + 1;

  const { data, error } = await supabase
    .from('quote_versions')
    .insert([{
      project_id: projectId,
      version_number: nextVersion,
      status: 'draft',
      note: version.note || '',
      snapshot_json: version.snapshot_json || {},
      total_area: version.total_area || 0,
      total_cost: version.total_cost || 0,
      total_price: version.total_price || 0,
      created_by: version.created_by || null,
      created_by_name: version.created_by_name || null
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateQuoteVersionStatus(versionId: number, status: string, user?: any) {
  const updates: any = { status };
  const now = new Date().toISOString();

  if (status === 'approved') {
    updates.approved_by = user?.id;
    updates.approved_by_name = user?.name;
    updates.approved_at = now;
  } else if (status === 'sent') {
    updates.sent_by = user?.id;
    updates.sent_by_name = user?.name;
    updates.sent_at = now;
  } else if (status === 'accepted') {
    updates.accepted_by = user?.id;
    updates.accepted_by_name = user?.name;
    updates.accepted_at = now;
  }

  const { data, error } = await supabase
    .from('quote_versions')
    .update(updates)
    .eq('id', versionId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}


// ================== DATA QUALITY ==================

export async function getDataQuality(projectId: number) {
  // Check for unmapped opera materials
  const { data: unmapped } = await supabase
    .from('project_opera_materials')
    .select('code, name')
    .eq('project_id', projectId)
    .is('mapped_material_id', null)
    .is('unit_price', null);

  // Check for doors without templates
  const { data: doors } = await supabase
    .from('project_doors')
    .select('id, code, template_id')
    .eq('project_id', projectId);

  const doorsWithoutTemplate = (doors || []).filter(d => !d.template_id);

  // Unique unmapped material codes
  const unmappedCodes = new Set<string>();
  (unmapped || []).forEach(m => unmappedCodes.add(m.code));

  return {
    healthy: unmappedCodes.size === 0 && doorsWithoutTemplate.length === 0,
    unmapped_materials: Array.from(unmappedCodes).map(code => {
      const m = (unmapped || []).find(u => u.code === code);
      return { code, name: m?.name || code };
    }),
    doors_without_template: doorsWithoutTemplate,
    total_doors: (doors || []).length,
    total_opera_materials: unmappedCodes.size // approximate
  };
}


// ================== SYSTEMS ==================

export async function getSystems() {
  const { data, error } = await supabase
    .from('systems')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}


// ================== PROJECT MATERIAL PRICES ==================

export async function getProjectMaterialPrices(projectId: number) {
  const { data, error } = await supabase
    .from('project_material_prices')
    .select('*')
    .eq('project_id', projectId);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function upsertProjectMaterialPrice(projectId: number, materialCode: string, price: number) {
  const { data, error } = await supabase
    .from('project_material_prices')
    .upsert({
      project_id: projectId,
      material_code: materialCode,
      price
    }, { onConflict: 'project_id,material_code' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}


// ================== USERS ==================

export async function getUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, name, role, created_at')
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createUser(user: { username: string; password: string; name: string; role: string }) {
  const passwordHash = await hashPassword(user.password);

  const { data, error } = await supabase
    .from('users')
    .insert([{
      username: user.username,
      password_hash: passwordHash,
      name: user.name,
      role: user.role
    }])
    .select('id, username, name, role, created_at')
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('Tên đăng nhập đã tồn tại.');
    throw new Error(error.message);
  }
  return data;
}

export async function updateUser(id: number, updates: { name?: string; role?: string; password?: string }) {
  const updateData: any = {};
  if (updates.name) updateData.name = updates.name;
  if (updates.role) updateData.role = updates.role;
  if (updates.password) updateData.password_hash = await hashPassword(updates.password);

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select('id, username, name, role, created_at')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteUser(id: number) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
