import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { prisma } from './src/config/prisma';

dotenv.config();

export const INITIAL_CATEGORIES = [
  { id: 'cat-001', nombre: 'Cuadernos y Libretas', descripcion: 'Cuadernos engargolados, cosidos, universitarios y de materias' },
  { id: 'cat-002', nombre: 'Escritura y Corrección', descripcion: 'Lápices, lapiceros, marcadores, resaltadores y borradores' },
  { id: 'cat-003', nombre: 'Papelería y Resmas', descripcion: 'Resmas bond, cartulinas, foamy, papel construcción y de regalo' },
  { id: 'cat-004', nombre: 'Mochilas y Estuches', descripcion: 'Mochilas escolares, cartucheras, loncheras y bultos' },
  { id: 'cat-005', nombre: 'Arte y Manualidades', descripcion: 'Pinturas acrílicas, acuarelas, pinceles, silicona y plastilina' },
];

export const INITIAL_SUPPLIERS = [
  {
    id: 'prov-001',
    nombre: 'Distribuidora Papelera Hispamer S.A.',
    ruc: 'J0310000123456',
    telefono: '+505 2278-1234',
    email: 'ventas@hispamer.com.ni',
    direccion: 'Managua, Rotonda Rubén Darío 2c abajo',
    estado: true,
  },
  {
    id: 'prov-002',
    nombre: 'Papelería y Suministros Castellanos Nicaragua',
    ruc: 'J0310000987654',
    telefono: '+505 2250-9988',
    email: 'pedidos@castellanos.ni',
    direccion: 'Managua, Plaza España Módulo E-4',
    estado: true,
  },
  {
    id: 'prov-003',
    nombre: 'Comercializadora Escolar & Arte Gutenberg',
    ruc: 'J0310000456789',
    telefono: '+505 2311-4455',
    email: 'contacto@gutenberg.com.ni',
    direccion: 'León, De la Catedral 1c al Norte',
    estado: true,
  },
];

export const INITIAL_PRODUCTS = [
  {
    id: 'prod-001',
    nombre: 'Cuaderno Universitario Líder 200 Págs Cosido Rayado',
    codigoBarras: '7411002230012',
    sku: 'CUAD-LID-200R',
    descripcion: 'Cuaderno con pasta dura resistente, papel bond blanco de alta blancura',
    categoriaId: 'cat-001',
    precioVenta: 75.0,
    costo: 50.0,
    stock: 120,
    stockMinimo: 15,
    unidadMedida: 'Unidad',
    imagenUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80',
    estado: true,
  },
  {
    id: 'prod-002',
    nombre: 'Cuaderno Universitario Líder 200 Págs Cuadriculado',
    codigoBarras: '7411002230029',
    sku: 'CUAD-LID-200C',
    descripcion: 'Cuaderno espiral cuadro grande para matemáticas y cálculo',
    categoriaId: 'cat-001',
    precioVenta: 78.0,
    costo: 52.0,
    stock: 95,
    stockMinimo: 15,
    unidadMedida: 'Unidad',
    imagenUrl: 'https://images.unsplash.com/photo-1588702547923-7093a6c3ba33?auto=format&fit=crop&w=400&q=80',
    estado: true,
  },
  {
    id: 'prod-003',
    nombre: 'Resma Papel Bond Chamex Carta 75g (500 Hojas)',
    codigoBarras: '7891048035222',
    sku: 'PAP-CHAM-75C',
    descripcion: 'Papel bond multiuso para fotocopias e impresiones de nitidez láser',
    categoriaId: 'cat-003',
    precioVenta: 185.0,
    costo: 140.0,
    stock: 45,
    stockMinimo: 10,
    unidadMedida: 'Resma',
    imagenUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=400&q=80',
    estado: true,
  },
  {
    id: 'prod-004',
    nombre: 'Caja Lapiceros Bic Cristal Azul (12 Unidades)',
    codigoBarras: '070330113884',
    sku: 'LAP-BIC-AZ12',
    descripcion: 'Punta media 1.0mm, tinta suave duradera clásica de uso escolar y oficina',
    categoriaId: 'cat-002',
    precioVenta: 120.0,
    costo: 85.0,
    stock: 60,
    stockMinimo: 10,
    unidadMedida: 'Caja',
    imagenUrl: 'https://images.unsplash.com/photo-1585336261026-7756f7ef5bf5?auto=format&fit=crop&w=400&q=80',
    estado: true,
  },
  {
    id: 'prod-005',
    nombre: 'Caja Lápices de Color Prismacolor Junior 24 Colores',
    codigoBarras: '7501006528741',
    sku: 'COL-PRIS-24',
    descripcion: 'Minas suaves y resistentes de 4mm, colores intensos y mezclables',
    categoriaId: 'cat-005',
    precioVenta: 260.0,
    costo: 195.0,
    stock: 25,
    stockMinimo: 5,
    unidadMedida: 'Caja',
    imagenUrl: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=400&q=80',
    estado: true,
  },
  {
    id: 'prod-006',
    nombre: 'Mochila Escolar Totto Acuarela Resistente',
    codigoBarras: '7704758362145',
    sku: 'MOC-TOT-ACU',
    descripcion: 'Compartimento para laptop 14", lona impermeable y correas ergonómicas',
    categoriaId: 'cat-004',
    precioVenta: 950.0,
    costo: 720.0,
    stock: 8,
    stockMinimo: 3,
    unidadMedida: 'Unidad',
    imagenUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80',
    estado: true,
  },
  {
    id: 'prod-007',
    nombre: 'Borrador de Nata Pelikan Blanco Grande WS-30',
    codigoBarras: '4012700720444',
    sku: 'BOR-PEL-WS30',
    descripcion: 'No mancha ni rompe el papel, libre de látex y residuos suaves',
    categoriaId: 'cat-002',
    precioVenta: 15.0,
    costo: 8.5,
    stock: 80,
    stockMinimo: 20,
    unidadMedida: 'Unidad',
    imagenUrl: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=400&q=80',
    estado: true,
  },
];

async function seed() {
  console.log('--- Sembrando Datos Reales de Librería y Papelería ---');

  // 1. Usuarios iniciales (con hashes seguros desde variables de entorno)
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const cajeroPassword = process.env.INITIAL_CAJERO_PASSWORD;

  if (!adminPassword || !cajeroPassword) {
    console.error('❌ Error: INITIAL_ADMIN_PASSWORD y INITIAL_CAJERO_PASSWORD deben estar definidos en las variables de entorno.');
    process.exit(1);
  }

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const cajeroHash = await bcrypt.hash(cajeroPassword, 10);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@jinstock.ni' },
    update: { passwordHash: adminHash, verificado: true, estado: true },
    create: {
      nombre: 'Administrador Principal',
      email: 'admin@jinstock.ni',
      passwordHash: adminHash,
      rol: 'ADMINISTRADOR',
      estado: true,
      verificado: true,
    },
  });

  const cajero = await prisma.usuario.upsert({
    where: { email: 'cajero@jinstock.ni' },
    update: { passwordHash: cajeroHash, verificado: true, estado: true },
    create: {
      nombre: 'Cajero Estación Central',
      email: 'cajero@jinstock.ni',
      passwordHash: cajeroHash,
      rol: 'CAJERO',
      estado: true,
      verificado: true,
    },
  });

  console.log(`✅ Usuarios sembrados: ${admin.email}, ${cajero.email}`);

  // 2. Categorías
  for (const cat of INITIAL_CATEGORIES) {
    await prisma.categoria.upsert({
      where: { id: cat.id },
      update: { nombre: cat.nombre, descripcion: cat.descripcion },
      create: { ...cat, estado: true },
    });
  }
  console.log(`✅ ${INITIAL_CATEGORIES.length} Categorías sembradas.`);

  // 3. Proveedores
  for (const sup of INITIAL_SUPPLIERS) {
    await prisma.proveedor.upsert({
      where: { id: sup.id },
      update: { nombre: sup.nombre, ruc: sup.ruc, telefono: sup.telefono, email: sup.email, direccion: sup.direccion },
      create: { ...sup },
    });
  }
  console.log(`✅ ${INITIAL_SUPPLIERS.length} Proveedores sembrados.`);

  // 4. Productos
  for (const prod of INITIAL_PRODUCTS) {
    await prisma.producto.upsert({
      where: { id: prod.id },
      update: {
        nombre: prod.nombre,
        precioVenta: prod.precioVenta,
        costo: prod.costo,
        stock: prod.stock,
        stockMinimo: prod.stockMinimo,
      },
      create: { ...prod },
    });
  }
  console.log(`✅ ${INITIAL_PRODUCTS.length} Productos de papelería sembrados.`);

  console.log('🎉 Seed completo de base de datos exitoso.');
}

if (process.env.NODE_ENV !== 'test') {
  seed()
    .catch((e) => {
      console.error('❌ Error ejecutando seed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
