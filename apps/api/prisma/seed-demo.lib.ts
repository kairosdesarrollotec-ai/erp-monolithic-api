/**
 * Funciones PURAS del seed de demostracion local (seed-demo.ts): guardas de seguridad y construccion del
 * conjunto de datos. Sin acceso a base de datos ni a red, para poder probarlas con un test unitario.
 *
 * Todos los datos son FICTICIOS y llevan la marca «DEMO». Nada de esto debe ejecutarse contra produccion.
 */
import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';

export const DEMO_MARK = 'DEMO';
export const DEMO_ACTOR = 'demo-seed';
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Politica inicial de reserva (CURRENT_RESERVATION_DEPOSIT_POLICY): 300.00 PEN. */
export const DEMO_RESERVATION_AMOUNT = '300.00';

// ---------------------------------------------------------------------------
// Guardas de seguridad
// ---------------------------------------------------------------------------

export function assertNotProduction(env: Readonly<Record<string, string | undefined>>): void {
  if ((env.NODE_ENV ?? '').toLowerCase() === 'production') {
    throw new Error('seed-demo: NODE_ENV=production. Este seed es SOLO para desarrollo local; abortado.');
  }
}

/**
 * Acepta unicamente URLs de Postgres cuyo host sea localhost / 127.0.0.1 / ::1. Rechaza URLs ilegibles, multi-host
 * y el parametro `?host=` (que sobreescribe el host real en libpq / Prisma).
 */
export function assertLocalDatabaseUrl(label: string, rawUrl: string | undefined): void {
  if (!rawUrl) {
    throw new Error(`seed-demo: falta ${label}; no se puede verificar que la base sea local.`);
  }
  if (rawUrl.includes(',')) {
    throw new Error(`seed-demo: ${label} parece tener varios hosts; solo se permite un host local.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`seed-demo: ${label} no es una URL valida; no se puede verificar que la base sea local.`);
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(`seed-demo: ${label} no es una URL de Postgres.`);
  }
  const hostOverride = parsed.searchParams.get('host');
  const host = (hostOverride ?? parsed.hostname).toLowerCase();
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`seed-demo: ${label} apunta a «${host}», que no es localhost. Abortado: solo se siembra en local.`);
  }
}

/** Lee un archivo .env simple (CLAVE=valor, comillas opcionales, comentarios #). No expande variables. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    out[m[1]] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Identificadores y fechas deterministas
// ---------------------------------------------------------------------------

/** UUID determinista (formato v5-like) por empresa + clave: permite re-ejecutar el seed sin duplicar. */
export function demoId(companyId: string, key: string): string {
  const hex = createHash('sha1').update(`kairos-demo:${companyId}:${key}`).digest('hex');
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * HOUR_MS);
}

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

/** Fecha calendario (America/Lima, UTC-5 sin horario de verano) como Date a medianoche UTC, para columnas @db.Date. */
export function limaCalendarDate(instant: Date): Date {
  const lima = new Date(instant.getTime() - 5 * HOUR_MS);
  return new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate()));
}

// ---------------------------------------------------------------------------
// Conjunto de datos
// ---------------------------------------------------------------------------

export interface DemoContext {
  organizationId: string;
  companyId: string;
  branchId: string;
  now: Date;
}

export interface DemoDataset {
  hrAreas: Prisma.HrAreaCreateManyInput[];
  customers: Prisma.CustomerCreateManyInput[];
  vehicles: Prisma.VehicleCreateManyInput[];
  employees: Prisma.EmployeeCreateManyInput[];
  templates: Prisma.TemplateCreateManyInput[];
  inquiries: Prisma.InquiryCreateManyInput[];
  reservations: Prisma.ReservationCreateManyInput[];
  vehicleCommitments: Prisma.VehicleCommitmentCreateManyInput[];
  rentals: Prisma.RentalCreateManyInput[];
  rentalParties: Prisma.RentalPartyCreateManyInput[];
  rentalContracts: Prisma.RentalContractCreateManyInput[];
  rentalDeposits: Prisma.RentalDepositCreateManyInput[];
  notaryEvaluations: Prisma.NotaryEvaluationCreateManyInput[];
}

/** Catalogo H-02 de VeloxRent (mismo contenido que la migracion 20261019000900_hr_areas_catalog). */
export const DEMO_HR_AREAS: ReadonlyArray<{ code: string; name: string; description: string; sortOrder: number }> = [
  { code: 'ADMINISTRACION', name: 'Administración', description: 'Órgano de apoyo: gestión administrativa de la empresa', sortOrder: 10 },
  { code: 'TALENTO_HUMANO', name: 'Talento Humano', description: 'Órgano de apoyo: nombre formal de Recursos Humanos', sortOrder: 20 },
  { code: 'SERVICIOS_GENERALES', name: 'Servicios Generales', description: 'Órgano de apoyo: limpieza y áreas afines', sortOrder: 30 },
  { code: 'DESARROLLO_DE_TECNOLOGIA', name: 'Desarrollo de Tecnología', description: 'Órgano de apoyo: antes «Tecnología VeloxRent»; aquí encaja el proyecto Kairos', sortOrder: 40 },
  { code: 'ATENCION_AL_CLIENTE', name: 'Atención al cliente', description: 'Órgano de línea', sortOrder: 50 },
  { code: 'MARKETING', name: 'Marketing', description: 'Órgano de línea', sortOrder: 60 },
  { code: 'OPERACIONES', name: 'Operaciones', description: 'Órgano de línea', sortOrder: 70 },
];

interface VehicleSeed {
  key: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  category: string;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
  dailyRate: string;
  depositMinimum: string;
  passengerCapacity: number | null;
  fuelPrice: string;
}

const VEHICLES: readonly VehicleSeed[] = [
  { key: 'veh-rio', plate: 'DEM-101', brand: 'Kia', model: 'Rio DEMO', year: 2022, color: 'Blanco', category: 'SEDAN', status: 'AVAILABLE', dailyRate: '120.00', depositMinimum: '1000.00', passengerCapacity: 5, fuelPrice: '6.50' },
  { key: 'veh-yaris', plate: 'DEM-102', brand: 'Toyota', model: 'Yaris DEMO', year: 2023, color: 'Gris', category: 'SEDAN', status: 'AVAILABLE', dailyRate: '130.00', depositMinimum: '1000.00', passengerCapacity: 5, fuelPrice: '6.50' },
  { key: 'veh-spark', plate: 'DEM-103', brand: 'Chevrolet', model: 'Spark DEMO (2 plazas)', year: 2021, color: 'Rojo', category: 'HATCHBACK', status: 'AVAILABLE', dailyRate: '90.00', depositMinimum: '800.00', passengerCapacity: 2, fuelPrice: '6.50' },
  { key: 'veh-accent-legacy', plate: 'DEM-104', brand: 'Hyundai', model: 'Accent DEMO (sin capacidad)', year: 2019, color: 'Negro', category: 'SEDAN', status: 'AVAILABLE', dailyRate: '110.00', depositMinimum: '900.00', passengerCapacity: null, fuelPrice: '6.50' },
  { key: 'veh-swift-lowdeposit', plate: 'DEM-105', brand: 'Suzuki', model: 'Swift DEMO (garantía baja)', year: 2022, color: 'Azul', category: 'HATCHBACK', status: 'AVAILABLE', dailyRate: '100.00', depositMinimum: '250.00', passengerCapacity: 5, fuelPrice: '6.50' },
  { key: 'veh-versa-maint', plate: 'DEM-106', brand: 'Nissan', model: 'Versa DEMO (mantenimiento)', year: 2020, color: 'Plata', category: 'SEDAN', status: 'MAINTENANCE', dailyRate: '105.00', depositMinimum: '900.00', passengerCapacity: 5, fuelPrice: '6.50' },
  { key: 'veh-soluto-res', plate: 'DEM-107', brand: 'Kia', model: 'Soluto DEMO (reserva confirmada)', year: 2023, color: 'Blanco', category: 'SEDAN', status: 'AVAILABLE', dailyRate: '95.00', depositMinimum: '900.00', passengerCapacity: 5, fuelPrice: '6.50' },
  { key: 'veh-mazda-draft', plate: 'DEM-108', brand: 'Mazda', model: '2 DEMO (reserva borrador)', year: 2022, color: 'Gris', category: 'HATCHBACK', status: 'AVAILABLE', dailyRate: '115.00', depositMinimum: '1000.00', passengerCapacity: 5, fuelPrice: '6.50' },
  { key: 'veh-hilux-active', plate: 'DEM-201', brand: 'Toyota', model: 'Hilux DEMO (alquiler activo)', year: 2023, color: 'Blanco', category: 'PICKUP', status: 'RENTED', dailyRate: '250.00', depositMinimum: '2000.00', passengerCapacity: 5, fuelPrice: '6.80' },
  { key: 'veh-picanto-late', plate: 'DEM-202', brand: 'Kia', model: 'Picanto DEMO (alquiler con retraso)', year: 2022, color: 'Verde', category: 'HATCHBACK', status: 'RENTED', dailyRate: '85.00', depositMinimum: '800.00', passengerCapacity: 4, fuelPrice: '6.50' },
  { key: 'veh-tucson-driver', plate: 'DEM-203', brand: 'Hyundai', model: 'Tucson DEMO (con conductor)', year: 2023, color: 'Negro', category: 'SUV', status: 'RENTED', dailyRate: '220.00', depositMinimum: '1800.00', passengerCapacity: 5, fuelPrice: '6.80' },
  { key: 'veh-sail-contract', plate: 'DEM-204', brand: 'Chevrolet', model: 'Sail DEMO (contrato pendiente)', year: 2022, color: 'Plata', category: 'SEDAN', status: 'AVAILABLE', dailyRate: '100.00', depositMinimum: '900.00', passengerCapacity: 5, fuelPrice: '6.50' },
];

export function buildDemoDataset(ctx: DemoContext): DemoDataset {
  const { organizationId, companyId, branchId, now } = ctx;
  const id = (key: string): string => demoId(companyId, key);
  const scope = { organizationId, operatingCompanyId: companyId };

  const hrAreas: Prisma.HrAreaCreateManyInput[] = DEMO_HR_AREAS.map((a) => ({
    id: id(`area-${a.code}`),
    ...scope,
    code: a.code,
    name: a.name,
    description: a.description,
    sortOrder: a.sortOrder,
  }));

  const customers: Prisma.CustomerCreateManyInput[] = [
    { id: id('cus-1'), ...scope, fullName: 'DEMO Cliente Nacional Uno', documentType: 'DNI', documentNumber: '99000001', nationality: 'PERUANO', email: 'demo.cliente1@example.invalid', phone: '900000001', address: 'Dirección ficticia 1 (DEMO)' },
    { id: id('cus-2'), ...scope, fullName: 'DEMO Cliente Nacional Dos', documentType: 'DNI', documentNumber: '99000002', nationality: 'PERUANO', email: 'demo.cliente2@example.invalid', phone: '900000002' },
    { id: id('cus-3'), ...scope, fullName: 'DEMO Cliente Extranjero', documentType: 'PASAPORTE', documentNumber: 'DEMO-PAS-0003', nationality: 'EXTRANJERO', countryEntryDate: limaCalendarDate(addDays(now, -10)), email: 'demo.extranjero@example.invalid', phone: '900000003' },
    { id: id('cus-4'), ...scope, fullName: 'DEMO Empresa Cliente S.A.C.', documentType: 'RUC', documentNumber: '20999999991', nationality: 'PERUANO', email: 'demo.empresa@example.invalid', phone: '900000004' },
    { id: id('cus-5-rojo'), ...scope, fullName: 'DEMO Cliente Lista Roja', documentType: 'DNI', documentNumber: '99000005', nationality: 'PERUANO', status: 'ROJO', phone: '900000005' },
    { id: id('cus-6'), ...scope, fullName: 'DEMO Cliente Acompañante', documentType: 'DNI', documentNumber: '99000006', nationality: 'PERUANO', phone: '900000006' },
    { id: id('cus-7'), ...scope, fullName: 'DEMO Cliente Conductor Real', documentType: 'DNI', documentNumber: '99000007', nationality: 'PERUANO', phone: '900000007' },
  ];

  const vehicles: Prisma.VehicleCreateManyInput[] = VEHICLES.map((v) => ({
    id: id(v.key),
    ...scope,
    branchId,
    plate: v.plate,
    brand: v.brand,
    model: v.model,
    year: v.year,
    color: v.color,
    category: v.category,
    status: v.status,
    dailyRate: v.dailyRate,
    depositMinimum: v.depositMinimum,
    passengerCapacity: v.passengerCapacity,
    fuelPrice: v.fuelPrice,
  }));

  const employeeBase = { ...scope, branchId, hireDate: limaCalendarDate(addDays(now, -400)) };
  const employees: Prisma.EmployeeCreateManyInput[] = [
    { id: id('emp-1'), ...employeeBase, documentType: 'DNI', documentNumber: '99100001', fullName: 'DEMO Ana Operaciones', areaId: 'OPERACIONES', areaName: 'Operaciones', jobTitle: 'Asesora de operaciones (DEMO)', status: 'PLANILLA', payrollStartedAt: addDays(now, -300), baseSalary: '1500.00' },
    { id: id('emp-2'), ...employeeBase, documentType: 'DNI', documentNumber: '99100002', fullName: 'DEMO Beto Operaciones', areaId: 'OPERACIONES', areaName: 'Operaciones', jobTitle: 'Operador de patio (DEMO)', status: 'PLANILLA', payrollStartedAt: addDays(now, -300), baseSalary: '1400.00' },
    { id: id('emp-3'), ...employeeBase, documentType: 'DNI', documentNumber: '99100003', fullName: 'DEMO Carla Marketing', areaId: 'MARKETING', areaName: 'Marketing', jobTitle: 'Analista de marketing (DEMO)', status: 'PLANILLA', payrollStartedAt: addDays(now, -300), baseSalary: '1600.00' },
    { id: id('emp-4'), ...employeeBase, hireDate: limaCalendarDate(addDays(now, -30)), documentType: 'DNI', documentNumber: '99100004', fullName: 'DEMO Diego Atención', areaId: 'ATENCION_AL_CLIENTE', areaName: 'Atención al cliente', jobTitle: 'Asesor de atención (DEMO)', status: 'PERIODO_PRUEBA', baseSalary: '1300.00' },
    { id: id('emp-5'), ...employeeBase, documentType: 'DNI', documentNumber: '99100005', fullName: 'DEMO Elena Talento Humano', areaId: 'TALENTO_HUMANO', areaName: 'Talento Humano', jobTitle: 'Analista de talento (DEMO)', status: 'PLANILLA', payrollStartedAt: addDays(now, -300), baseSalary: '1700.00' },
  ];

  const contractTemplateId = id('tpl-rental-contract');
  const templates: Prisma.TemplateCreateManyInput[] = [
    { id: contractTemplateId, organizationId, companyId, type: 'RENTAL_CONTRACT', name: 'DEMO Contrato de alquiler (plantilla de prueba)', version: 1, status: 'ACTIVE', documentFormat: 'PDF', effectiveFrom: addDays(now, -1), createdBy: DEMO_ACTOR, updatedBy: DEMO_ACTOR },
  ];

  const inquiries: Prisma.InquiryCreateManyInput[] = [
    { id: id('inq-1'), ...scope, branchId, customerId: id('cus-2'), channel: 'PRESENCIAL', touristUse: true, destination: 'Cusco (DEMO)', estimatedDays: 3, travelStartDate: limaCalendarDate(addDays(now, 5)), partySize: 3, status: 'REGISTRADA', createdBy: DEMO_ACTOR },
  ];

  const resConfirmedId = id('res-confirmed');
  const resDraftId = id('res-draft');
  const reservationBase = { ...scope, branchId, channelMode: 'PRESENCIAL' as const, requiredPaymentAmount: DEMO_RESERVATION_AMOUNT, currency: 'PEN', paymentPolicyVersion: 1, createdBy: DEMO_ACTOR };
  const reservations: Prisma.ReservationCreateManyInput[] = [
    { id: resConfirmedId, ...reservationBase, customerId: id('cus-1'), vehicleId: id('veh-soluto-res'), status: 'CONFIRMED', startAt: addDays(now, 3), endAt: addDays(now, 6), paymentValidatedAt: addHours(now, -2), documentsCompletedAt: addHours(now, -1), confirmedAt: now },
    { id: resDraftId, ...reservationBase, customerId: id('cus-2'), vehicleId: id('veh-mazda-draft'), status: 'DRAFT', startAt: addDays(now, 10), endAt: addDays(now, 13) },
  ];
  const vehicleCommitments: Prisma.VehicleCommitmentCreateManyInput[] = [
    { id: id('commit-res-confirmed'), organizationId, vehicleId: id('veh-soluto-res'), sourceType: 'RESERVATION', sourceId: resConfirmedId, status: 'CONSOLIDATED', startsAt: addDays(now, 3), endsAt: addDays(now, 6) },
  ];

  const rentalBase = { ...scope, branchId, planCode: 'NORMAL', createdBy: DEMO_ACTOR, updatedBy: DEMO_ACTOR };
  const rentActiveId = id('rent-active');
  const rentLateId = id('rent-late');
  const rentDriverId = id('rent-company-driver');
  const rentContractingId = id('rent-contracting');
  const rentals: Prisma.RentalCreateManyInput[] = [
    { id: rentActiveId, ...rentalBase, customerId: id('cus-1'), vehicleId: id('veh-hilux-active'), status: 'ACTIVE', startAt: addDays(now, -2), expectedEndAt: addDays(now, 60) },
    { id: rentLateId, ...rentalBase, customerId: id('cus-2'), vehicleId: id('veh-picanto-late'), status: 'ACTIVE', startAt: addDays(now, -4), expectedEndAt: addHours(now, -3) },
    { id: rentDriverId, ...rentalBase, customerId: id('cus-3'), vehicleId: id('veh-tucson-driver'), status: 'ACTIVE', startAt: addDays(now, -1), expectedEndAt: addDays(now, 7), companyDriverDailyRate: '150.00' },
    { id: rentContractingId, ...rentalBase, customerId: id('cus-4'), vehicleId: id('veh-sail-contract'), status: 'CONTRACTING' },
  ];
  const rentalParties: Prisma.RentalPartyCreateManyInput[] = rentals.map((r) => ({
    id: id(`party-${r.id}`),
    rentalId: r.id as string,
    customerId: r.customerId,
    role: 'SIGNER',
  }));
  const signed = (key: string, variant: string, depositRequired: boolean): Prisma.RentalContractCreateManyInput => ({
    id: id(`contract-${key}`),
    rentalId: id(key),
    templateId: contractTemplateId,
    documentRef: `DEMO-CONTRATO-${key}`,
    status: 'SIGNED',
    signedAt: addDays(now, -2),
    contractVariant: variant,
    depositRequired,
  });
  const rentalContracts: Prisma.RentalContractCreateManyInput[] = [
    signed('rent-active', 'NATURAL_NO_DRIVER', true),
    signed('rent-late', 'NATURAL_NO_DRIVER', true),
    signed('rent-company-driver', 'NATURAL_WITH_DRIVER', false),
  ];
  const rentalDeposits: Prisma.RentalDepositCreateManyInput[] = [
    { id: id('deposit-active'), rentalId: rentActiveId, originalAmount: '2000.00', currency: 'PEN', status: 'HELD' },
    { id: id('deposit-late'), rentalId: rentLateId, originalAmount: '800.00', currency: 'PEN', status: 'HELD' },
  ];
  const notaryEvaluations: Prisma.NotaryEvaluationCreateManyInput[] = [
    { id: id('notary-contracting'), rentalId: rentContractingId, policyVersion: 1, result: 'DOUBLE_DEPOSIT', reason: 'DEMO: cliente nuevo o sin validación biométrica completa; aplica doble depósito de garantía.' },
  ];

  return { hrAreas, customers, vehicles, employees, templates, inquiries, reservations, vehicleCommitments, rentals, rentalParties, rentalContracts, rentalDeposits, notaryEvaluations };
}
